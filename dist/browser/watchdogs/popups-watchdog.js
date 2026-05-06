import { BrowserStoppedEvent, TabCreatedEvent } from '../events.js';
import { BaseWatchdog } from './base.js';
export class PopupsWatchdog extends BaseWatchdog {
    static LISTENS_TO = [TabCreatedEvent, BrowserStoppedEvent];
    _dialogListenersRegistered = new Set();
    _cdpDialogSessions = new Map();
    async on_TabCreatedEvent(event) {
        const page = (await this.browser_session.get_current_page());
        if (!page) {
            return;
        }
        const attachDialogHandler = this.browser_session
            ?._attachDialogHandler;
        if (typeof attachDialogHandler === 'function') {
            attachDialogHandler.call(this.browser_session, page);
        }
        await this._attachCdpDialogHandler(event.target_id, page);
    }
    async on_BrowserStoppedEvent() {
        await this._detachCdpDialogHandlers();
    }
    onDetached() {
        void this._detachCdpDialogHandlers();
    }
    async _attachCdpDialogHandler(targetId, page) {
        if (this._dialogListenersRegistered.has(targetId)) {
            return;
        }
        try {
            const session = (await this.browser_session.get_or_create_cdp_session(page));
            await session.send?.('Page.enable');
            const handler = (payload) => {
                void this._handleJavascriptDialog(payload, session);
            };
            session.on?.('Page.javascriptDialogOpening', handler);
            this._dialogListenersRegistered.add(targetId);
            this._cdpDialogSessions.set(targetId, {
                session,
                handler,
            });
        }
        catch (error) {
            this.browser_session.logger.debug(`[PopupsWatchdog] Failed to attach CDP dialog handler: ${error.message}`);
        }
    }
    async _detachCdpDialogHandlers() {
        for (const [targetId, binding] of [...this._cdpDialogSessions.entries()]) {
            binding.session.off?.('Page.javascriptDialogOpening', binding.handler);
            try {
                await binding.session.detach?.();
            }
            catch {
                // Ignore detach failures during cleanup.
            }
            this._cdpDialogSessions.delete(targetId);
        }
        this._dialogListenersRegistered.clear();
    }
    async _handleJavascriptDialog(payload, session) {
        const dialogType = typeof payload?.type === 'string' ? payload.type : 'alert';
        const message = typeof payload?.message === 'string' ? payload.message : '';
        const shouldAccept = ['alert', 'confirm', 'beforeunload'].includes(dialogType);
        const captureClosedPopupMessage = this.browser_session
            ?._captureClosedPopupMessage;
        if (typeof captureClosedPopupMessage === 'function' && message) {
            captureClosedPopupMessage.call(this.browser_session, dialogType, message);
        }
        try {
            await session.send?.('Page.handleJavaScriptDialog', {
                accept: shouldAccept,
            });
        }
        catch (error) {
            this.browser_session.logger.debug(`[PopupsWatchdog] Failed to handle JavaScript dialog: ${error.message}`);
        }
    }
}
