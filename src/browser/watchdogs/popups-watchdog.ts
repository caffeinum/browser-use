import { BrowserStoppedEvent, TabCreatedEvent } from '../events.js';
import type { Page } from '../types.js';
import { BaseWatchdog } from './base.js';

type CDPSessionLike = {
  send?: (method: string, params?: Record<string, unknown>) => Promise<any>;
  on?: (event: string, listener: (payload: any) => void) => void;
  off?: (event: string, listener: (payload: any) => void) => void;
  detach?: () => Promise<void>;
};

export class PopupsWatchdog extends BaseWatchdog {
  static override LISTENS_TO = [TabCreatedEvent, BrowserStoppedEvent];
  private _dialogListenersRegistered = new Set<string>();
  private _cdpDialogSessions = new Map<
    string,
    {
      session: CDPSessionLike;
      handler: (payload: any) => void;
    }
  >();

  async on_TabCreatedEvent(event: TabCreatedEvent) {
    const page = (await this.browser_session.get_current_page()) as Page | null;
    if (!page) {
      return;
    }

    const attachDialogHandler = (this.browser_session as any)
      ?._attachDialogHandler;
    if (typeof attachDialogHandler === 'function') {
      attachDialogHandler.call(this.browser_session, page);
    }

    await this._attachCdpDialogHandler(event.target_id, page);
  }

  async on_BrowserStoppedEvent() {
    await this._detachCdpDialogHandlers();
  }

  protected override onDetached() {
    this.runBackground(
      'detach CDP dialog handlers',
      this._detachCdpDialogHandlers()
    );
  }

  private async _attachCdpDialogHandler(targetId: string, page: Page) {
    if (this._dialogListenersRegistered.has(targetId)) {
      return;
    }

    try {
      const session = (await this.browser_session.get_or_create_cdp_session(
        page
      )) as CDPSessionLike;
      await session.send?.('Page.enable');

      const handler = (payload: any) => {
        this.runBackground(
          'handle javascript dialog',
          this._handleJavascriptDialog(payload, session)
        );
      };
      session.on?.('Page.javascriptDialogOpening', handler);

      this._dialogListenersRegistered.add(targetId);
      this._cdpDialogSessions.set(targetId, {
        session,
        handler,
      });
    } catch (error) {
      this.browser_session.logger.debug(
        `[PopupsWatchdog] Failed to attach CDP dialog handler: ${(error as Error).message}`
      );
    }
  }

  private async _detachCdpDialogHandlers() {
    for (const [targetId, binding] of [...this._cdpDialogSessions.entries()]) {
      binding.session.off?.('Page.javascriptDialogOpening', binding.handler);
      try {
        await binding.session.detach?.();
      } catch {
        // Ignore detach failures during cleanup.
      }
      this._cdpDialogSessions.delete(targetId);
    }
    this._dialogListenersRegistered.clear();
  }

  private async _handleJavascriptDialog(payload: any, session: CDPSessionLike) {
    const dialogType =
      typeof payload?.type === 'string' ? payload.type : 'alert';
    const message = typeof payload?.message === 'string' ? payload.message : '';
    const shouldAccept = ['alert', 'confirm', 'beforeunload'].includes(
      dialogType
    );

    const captureClosedPopupMessage = (this.browser_session as any)
      ?._captureClosedPopupMessage;
    if (typeof captureClosedPopupMessage === 'function' && message) {
      captureClosedPopupMessage.call(this.browser_session, dialogType, message);
    }

    try {
      await session.send?.('Page.handleJavaScriptDialog', {
        accept: shouldAccept,
      });
    } catch (error) {
      this.browser_session.logger.debug(
        `[PopupsWatchdog] Failed to handle JavaScript dialog: ${(error as Error).message}`
      );
    }
  }
}
