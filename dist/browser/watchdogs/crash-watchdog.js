import { BrowserConnectedEvent, BrowserErrorEvent, BrowserStoppedEvent, TabClosedEvent, TabCreatedEvent, TargetCrashedEvent, } from '../events.js';
import { BaseWatchdog } from './base.js';
export class CrashWatchdog extends BaseWatchdog {
    static LISTENS_TO = [
        BrowserConnectedEvent,
        BrowserStoppedEvent,
        TabCreatedEvent,
        TabClosedEvent,
    ];
    static EMITS = [TargetCrashedEvent, BrowserErrorEvent];
    _pageListeners = new Map();
    _pendingRequests = new Map();
    _requestIds = new WeakMap();
    _requestCounter = 0;
    _healthInterval = null;
    _networkTimeoutMs = 10_000;
    _healthCheckIntervalMs = 5_000;
    _consecutiveUnresponsiveChecks = 0;
    _unresponsiveThreshold = 2;
    _monitoringInProgress = false;
    async on_BrowserConnectedEvent() {
        this._attachToKnownPages();
        this._startHealthMonitor();
    }
    async on_TabCreatedEvent() {
        this._attachToKnownPages();
    }
    async on_TabClosedEvent() {
        this._dropDetachedPages();
    }
    async on_BrowserStoppedEvent() {
        this._detachAllPages();
        this._stopHealthMonitor();
        this._pendingRequests.clear();
        this._consecutiveUnresponsiveChecks = 0;
    }
    onDetached() {
        this._detachAllPages();
        this._stopHealthMonitor();
        this._pendingRequests.clear();
        this._consecutiveUnresponsiveChecks = 0;
    }
    _attachToKnownPages() {
        for (const page of this._getKnownPages()) {
            this._attachPage(page);
        }
    }
    _dropDetachedPages() {
        const livePages = new Set(this._getKnownPages());
        for (const [page, listeners] of [...this._pageListeners.entries()]) {
            if (livePages.has(page)) {
                continue;
            }
            this._detachPageListeners(page, listeners);
            this._pageListeners.delete(page);
        }
    }
    _detachAllPages() {
        for (const [page, listeners] of [...this._pageListeners.entries()]) {
            this._detachPageListeners(page, listeners);
        }
        this._pageListeners.clear();
    }
    _attachPage(page) {
        if (this._pageListeners.has(page)) {
            return;
        }
        if (typeof page?.on !== 'function') {
            return;
        }
        const crashListener = (payload) => {
            void this._handlePageCrash(page, payload);
        };
        const requestListener = (payload) => {
            this._trackRequestStart(payload);
        };
        const requestFinishedListener = (payload) => {
            this._trackRequestDone(payload);
        };
        const requestFailedListener = (payload) => {
            this._trackRequestDone(payload);
        };
        const responseListener = () => {
            // Keep hook for future detailed response-based crash heuristics.
        };
        page.on('crash', crashListener);
        page.on('request', requestListener);
        page.on('requestfinished', requestFinishedListener);
        page.on('requestfailed', requestFailedListener);
        page.on('response', responseListener);
        this._pageListeners.set(page, {
            crash: crashListener,
            request: requestListener,
            requestfinished: requestFinishedListener,
            requestfailed: requestFailedListener,
            response: responseListener,
        });
    }
    _detachPageListeners(page, listeners) {
        if (typeof page.off === 'function') {
            page.off('crash', listeners.crash);
            page.off('request', listeners.request);
            page.off('requestfinished', listeners.requestfinished);
            page.off('requestfailed', listeners.requestfailed);
            page.off('response', listeners.response);
            return;
        }
        if (typeof page.removeListener === 'function') {
            page.removeListener('crash', listeners.crash);
            page.removeListener('request', listeners.request);
            page.removeListener('requestfinished', listeners.requestfinished);
            page.removeListener('requestfailed', listeners.requestfailed);
            page.removeListener('response', listeners.response);
        }
    }
    _getKnownPages() {
        const pagesFromContext = typeof this.browser_session.browser_context?.pages === 'function'
            ? this.browser_session.browser_context.pages()
            : [];
        const activePage = this.browser_session.agent_current_page;
        if (!activePage) {
            return pagesFromContext;
        }
        if (pagesFromContext.includes(activePage)) {
            return pagesFromContext;
        }
        return [...pagesFromContext, activePage];
    }
    async _handlePageCrash(page, payload) {
        const target_id = this._resolveTargetId(page);
        const url = this._safePageUrl(page) ?? this.browser_session.active_tab?.url ?? '';
        const errorMessage = this._normalizeCrashError(payload);
        await this.event_bus.dispatch(new TargetCrashedEvent({
            target_id,
            error: errorMessage,
        }));
        await this.event_bus.dispatch(new BrowserErrorEvent({
            error_type: 'TargetCrash',
            message: errorMessage,
            details: {
                target_id,
                url,
            },
        }));
    }
    _resolveTargetId(page) {
        const pageUrl = this._safePageUrl(page);
        if (pageUrl) {
            const tabByUrl = this.browser_session.tabs.find((tab) => tab.url === pageUrl && tab.target_id);
            if (tabByUrl?.target_id) {
                return tabByUrl.target_id;
            }
        }
        const activeTargetId = this.browser_session.active_tab?.target_id;
        if (activeTargetId) {
            return activeTargetId;
        }
        return (this.browser_session.session_manager.get_focused_target_id() ??
            'unknown_target');
    }
    _safePageUrl(page) {
        try {
            return typeof page.url === 'function' ? page.url() : null;
        }
        catch {
            return null;
        }
    }
    _normalizeCrashError(payload) {
        if (payload instanceof Error) {
            return payload.message || 'Target crashed';
        }
        if (typeof payload === 'string' && payload.trim().length > 0) {
            return payload.trim();
        }
        if (payload && typeof payload === 'object' && 'message' in payload) {
            const candidate = payload.message;
            if (typeof candidate === 'string' && candidate.trim().length > 0) {
                return candidate.trim();
            }
        }
        return 'Target crashed';
    }
    _trackRequestStart(request) {
        const requestObject = request;
        if (!requestObject || typeof requestObject !== 'object') {
            return;
        }
        const requestId = `req-${this._requestCounter++}`;
        const url = typeof request?.url === 'function'
            ? request.url()
            : (this.browser_session.active_tab?.url ?? '');
        const method = typeof request?.method === 'function' ? request.method() : 'GET';
        this._requestIds.set(requestObject, requestId);
        this._pendingRequests.set(requestId, {
            url: typeof url === 'string' ? url : '',
            method: typeof method === 'string' ? method : 'GET',
            started_at: Date.now(),
        });
    }
    _trackRequestDone(request) {
        const requestObject = request;
        if (!requestObject || typeof requestObject !== 'object') {
            return;
        }
        const requestId = this._requestIds.get(requestObject);
        if (!requestId) {
            return;
        }
        this._requestIds.delete(requestObject);
        this._pendingRequests.delete(requestId);
    }
    _startHealthMonitor() {
        if (this._healthInterval) {
            return;
        }
        this._healthInterval = setInterval(() => {
            void this._runHealthCheck();
        }, this._healthCheckIntervalMs);
    }
    _stopHealthMonitor() {
        if (!this._healthInterval) {
            return;
        }
        clearInterval(this._healthInterval);
        this._healthInterval = null;
    }
    async _runHealthCheck() {
        if (this._monitoringInProgress) {
            return;
        }
        this._monitoringInProgress = true;
        try {
            await this._checkNetworkTimeouts();
            await this._checkPageResponsiveness();
        }
        finally {
            this._monitoringInProgress = false;
        }
    }
    async _checkNetworkTimeouts() {
        const now = Date.now();
        for (const [requestId, metadata] of [...this._pendingRequests.entries()]) {
            const ageMs = now - metadata.started_at;
            if (ageMs < this._networkTimeoutMs) {
                continue;
            }
            this._pendingRequests.delete(requestId);
            await this.event_bus.dispatch(new BrowserErrorEvent({
                error_type: 'NetworkTimeout',
                message: `Request timed out after ${Math.round(ageMs / 1000)}s`,
                details: {
                    request_id: requestId,
                    url: metadata.url,
                    method: metadata.method,
                    timeout_ms: this._networkTimeoutMs,
                },
            }));
        }
    }
    async _checkPageResponsiveness() {
        const page = (await this.browser_session.get_current_page());
        if (!page?.evaluate) {
            return;
        }
        const timeoutMs = 2_000;
        try {
            await Promise.race([
                page.evaluate(() => document.readyState),
                new Promise((_, reject) => {
                    setTimeout(() => {
                        reject(new Error('Page responsiveness check timed out'));
                    }, timeoutMs);
                }),
            ]);
            this._consecutiveUnresponsiveChecks = 0;
        }
        catch (error) {
            this._consecutiveUnresponsiveChecks += 1;
            if (this._consecutiveUnresponsiveChecks < this._unresponsiveThreshold) {
                return;
            }
            this._consecutiveUnresponsiveChecks = 0;
            await this.event_bus.dispatch(new BrowserErrorEvent({
                error_type: 'TargetUnresponsive',
                message: error.message || 'Target became unresponsive',
                details: {
                    url: this._safePageUrl(page) ??
                        this.browser_session.active_tab?.url ??
                        '',
                    timeout_ms: timeoutMs,
                },
            }));
        }
    }
}
