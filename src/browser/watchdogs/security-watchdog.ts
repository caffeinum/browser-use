import {
  BrowserErrorEvent,
  CloseTabEvent,
  NavigateToUrlEvent,
  NavigationCompleteEvent,
  TabCreatedEvent,
} from '../events.js';
import { BaseWatchdog } from './base.js';

export class SecurityWatchdog extends BaseWatchdog {
  static override LISTENS_TO = [
    NavigateToUrlEvent,
    NavigationCompleteEvent,
    TabCreatedEvent,
  ];

  static override EMITS = [BrowserErrorEvent, CloseTabEvent];

  async on_NavigateToUrlEvent(event: NavigateToUrlEvent) {
    const denialReason = this._getUrlDenialReason(event.url);
    if (!denialReason) {
      return;
    }

    await this.event_bus.dispatch(
      new BrowserErrorEvent({
        error_type: 'NavigationBlocked',
        message: `Navigation blocked to disallowed URL: ${event.url}`,
        details: {
          url: event.url,
          reason: denialReason,
        },
      })
    );
    throw new Error(`Navigation to ${event.url} blocked by security policy`);
  }

  async on_NavigationCompleteEvent(event: NavigationCompleteEvent) {
    const denialReason = this._getUrlDenialReason(event.url);
    if (!denialReason) {
      return;
    }

    await this.event_bus.dispatch(
      new BrowserErrorEvent({
        error_type: 'NavigationBlocked',
        message: `Navigation blocked to non-allowed URL: ${event.url}`,
        details: {
          url: event.url,
          target_id: event.target_id,
          reason: denialReason,
        },
      })
    );

    if (!this._isActiveTarget(event.target_id)) {
      await this.event_bus.dispatch(
        new CloseTabEvent({
          target_id: event.target_id,
        })
      );
      return;
    }

    try {
      await this.browser_session.navigate_to('about:blank');
    } catch (error) {
      this.browser_session.logger.debug(
        `SecurityWatchdog failed to redirect to about:blank: ${(error as Error).message}`
      );
    }
  }

  async on_TabCreatedEvent(event: TabCreatedEvent) {
    const denialReason = this._getUrlDenialReason(event.url);
    if (!denialReason) {
      return;
    }

    await this.event_bus.dispatch(
      new BrowserErrorEvent({
        error_type: 'TabCreationBlocked',
        message: `Tab created with non-allowed URL: ${event.url}`,
        details: {
          url: event.url,
          target_id: event.target_id,
          reason: denialReason,
        },
      })
    );

    await this.event_bus.dispatch(
      new CloseTabEvent({
        target_id: event.target_id,
      })
    );
  }

  private _getUrlDenialReason(url: string): string | null {
    const session = this.browser_session as any;
    if (typeof session._get_url_access_denial_reason === 'function') {
      try {
        return session._get_url_access_denial_reason(url);
      } catch {
        // Ignore private method failures and fallback to boolean check.
      }
    }

    if (typeof session._is_url_allowed === 'function') {
      try {
        return session._is_url_allowed(url) ? null : 'blocked';
      } catch {
        return 'blocked';
      }
    }

    return null;
  }

  private _isActiveTarget(targetId: string | null | undefined): boolean {
    if (!targetId) {
      return true;
    }

    const activeTab = this.browser_session.active_tab;
    if (!activeTab) {
      return true;
    }

    return activeTab.target_id === targetId || activeTab.tab_id === targetId;
  }
}
