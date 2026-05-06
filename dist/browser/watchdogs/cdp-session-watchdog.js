import { BrowserConnectedEvent, BrowserStoppedEvent, NavigationCompleteEvent, TabClosedEvent, TabCreatedEvent, } from '../events.js';
import { BaseWatchdog } from './base.js';
export class CDPSessionWatchdog extends BaseWatchdog {
    static LISTENS_TO = [BrowserConnectedEvent, BrowserStoppedEvent];
    _rootCdpSession = null;
    _listeners = [];
    _knownTargets = new Map();
    async on_BrowserConnectedEvent() {
        await this._ensureCdpMonitoring();
    }
    async on_BrowserStoppedEvent() {
        await this._teardownCdpMonitoring();
    }
    onDetached() {
        void this._teardownCdpMonitoring();
    }
    async _ensureCdpMonitoring() {
        if (this._rootCdpSession) {
            return;
        }
        if (!this.browser_session.browser_context?.newCDPSession) {
            return;
        }
        const page = await this.browser_session.get_current_page();
        if (!page) {
            return;
        }
        try {
            const cdpSession = (await this.browser_session.get_or_create_cdp_session(page));
            this._rootCdpSession = cdpSession;
            await cdpSession.send?.('Target.setDiscoverTargets', {
                discover: true,
                filter: [{ type: 'page' }, { type: 'iframe' }],
            });
            const targetsPayload = await cdpSession.send?.('Target.getTargets');
            const targetInfos = Array.isArray(targetsPayload?.targetInfos)
                ? targetsPayload.targetInfos
                : [];
            for (const targetInfo of targetInfos) {
                const target_id = String(targetInfo?.targetId ?? '');
                if (!target_id) {
                    continue;
                }
                this.browser_session.session_manager.handle_target_info_changed({
                    target_id,
                    target_type: typeof targetInfo?.type === 'string' ? targetInfo.type : 'page',
                    url: typeof targetInfo?.url === 'string' ? targetInfo.url : '',
                    title: typeof targetInfo?.title === 'string' ? targetInfo.title : '',
                });
                this._knownTargets.set(target_id, {
                    target_type: typeof targetInfo?.type === 'string' ? targetInfo.type : 'page',
                    url: typeof targetInfo?.url === 'string' ? targetInfo.url : '',
                });
            }
            const onAttached = (payload) => {
                const targetInfo = payload?.targetInfo ?? {};
                const target_id = String(targetInfo?.targetId ?? '');
                if (!target_id) {
                    return;
                }
                const target_type = typeof targetInfo?.type === 'string' ? targetInfo.type : 'page';
                const url = typeof targetInfo?.url === 'string' ? targetInfo.url : '';
                const isNewTarget = !this._knownTargets.has(target_id);
                this._knownTargets.set(target_id, {
                    target_type,
                    url,
                });
                this.browser_session.session_manager.handle_target_attached({
                    target_id,
                    session_id: typeof payload?.sessionId === 'string' ? payload.sessionId : null,
                    target_type,
                    url,
                    title: typeof targetInfo?.title === 'string' ? targetInfo.title : '',
                });
                if (isNewTarget && target_type === 'page') {
                    this._dispatchEventSafely(new TabCreatedEvent({
                        target_id,
                        url,
                    }));
                }
            };
            const onDetached = (payload) => {
                const target_id = String(payload?.targetId ?? '');
                if (!target_id) {
                    return;
                }
                const knownTarget = this._knownTargets.get(target_id);
                this._knownTargets.delete(target_id);
                this.browser_session.session_manager.handle_target_detached({
                    target_id,
                    session_id: typeof payload?.sessionId === 'string' ? payload.sessionId : null,
                });
                if (knownTarget?.target_type === 'page') {
                    this._dispatchEventSafely(new TabClosedEvent({
                        target_id,
                    }));
                }
            };
            const onTargetInfoChanged = (payload) => {
                const targetInfo = payload?.targetInfo ?? {};
                const target_id = String(targetInfo?.targetId ?? '');
                if (!target_id) {
                    return;
                }
                const knownTarget = this._knownTargets.get(target_id);
                const target_type = typeof targetInfo?.type === 'string'
                    ? targetInfo.type
                    : (knownTarget?.target_type ?? 'page');
                const url = typeof targetInfo?.url === 'string'
                    ? targetInfo.url
                    : (knownTarget?.url ?? '');
                this._knownTargets.set(target_id, {
                    target_type,
                    url,
                });
                this.browser_session.session_manager.handle_target_info_changed({
                    target_id,
                    target_type,
                    url,
                    title: typeof targetInfo?.title === 'string' ? targetInfo.title : '',
                });
                if (!knownTarget && target_type === 'page') {
                    this._dispatchEventSafely(new TabCreatedEvent({
                        target_id,
                        url,
                    }));
                    return;
                }
                if (knownTarget?.target_type === 'page' && knownTarget.url !== url) {
                    this._dispatchEventSafely(new NavigationCompleteEvent({
                        target_id,
                        url,
                        status: null,
                        error_message: null,
                        loading_status: null,
                    }));
                }
            };
            cdpSession.on?.('Target.attachedToTarget', onAttached);
            cdpSession.on?.('Target.detachedFromTarget', onDetached);
            cdpSession.on?.('Target.targetInfoChanged', onTargetInfoChanged);
            this._listeners = [
                { event: 'Target.attachedToTarget', handler: onAttached },
                { event: 'Target.detachedFromTarget', handler: onDetached },
                { event: 'Target.targetInfoChanged', handler: onTargetInfoChanged },
            ];
        }
        catch (error) {
            this.browser_session.logger.debug(`CDPSessionWatchdog monitoring unavailable: ${error.message}`);
            await this._teardownCdpMonitoring();
        }
    }
    async _teardownCdpMonitoring() {
        if (!this._rootCdpSession) {
            return;
        }
        for (const listener of this._listeners) {
            this._rootCdpSession.off?.(listener.event, listener.handler);
        }
        this._listeners = [];
        try {
            await this._rootCdpSession.detach?.();
        }
        catch {
            // Ignore CDP detach errors during shutdown.
        }
        finally {
            this._rootCdpSession = null;
            this._knownTargets.clear();
        }
    }
    _dispatchEventSafely(event) {
        void this.event_bus.dispatch(event).catch((error) => {
            this.browser_session.logger.debug(`CDPSessionWatchdog failed to dispatch ${String(event?.event_name ?? 'event')}: ${error.message}`);
        });
    }
}
