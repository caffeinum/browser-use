import { BrowserConnectedEvent, BrowserStoppedEvent, CaptchaSolverFinishedEvent, CaptchaSolverStartedEvent, } from '../events.js';
import { BaseWatchdog } from './base.js';
export class CaptchaWatchdog extends BaseWatchdog {
    static LISTENS_TO = [BrowserConnectedEvent, BrowserStoppedEvent];
    static EMITS = [
        CaptchaSolverStartedEvent,
        CaptchaSolverFinishedEvent,
    ];
    _cdpSession = null;
    _handlers = [];
    _captchaSolving = false;
    _captchaInfo = {
        vendor: 'unknown',
        url: '',
        target_id: '',
    };
    _captchaResult = 'unknown';
    _captchaDurationMs = 0;
    _waiters = new Set();
    async on_BrowserConnectedEvent() {
        if (this._cdpSession) {
            return;
        }
        const page = await this.browser_session.get_current_page();
        if (!page) {
            return;
        }
        try {
            const cdpSession = (await this.browser_session.get_or_create_cdp_session(page));
            const onStarted = (payload) => {
                this._captchaSolving = true;
                this._captchaResult = 'unknown';
                this._captchaDurationMs = 0;
                this._captchaInfo = {
                    vendor: String(payload?.vendor ?? 'unknown'),
                    url: String(payload?.url ?? ''),
                    target_id: String(payload?.targetId ?? ''),
                };
                void this.event_bus.dispatch(new CaptchaSolverStartedEvent({
                    target_id: this._captchaInfo.target_id,
                    vendor: this._captchaInfo.vendor,
                    url: this._captchaInfo.url,
                    started_at: Number(payload?.startedAt ?? Date.now()),
                }));
            };
            const onFinished = (payload) => {
                this._captchaSolving = false;
                this._captchaDurationMs = Number(payload?.durationMs ?? 0);
                this._captchaResult = payload?.success ? 'success' : 'failed';
                const vendor = String(payload?.vendor ?? this._captchaInfo.vendor);
                const url = String(payload?.url ?? this._captchaInfo.url);
                const targetId = String(payload?.targetId ?? this._captchaInfo.target_id);
                for (const resolve of this._waiters) {
                    resolve();
                }
                this._waiters.clear();
                void this.event_bus.dispatch(new CaptchaSolverFinishedEvent({
                    target_id: targetId,
                    vendor,
                    url,
                    duration_ms: this._captchaDurationMs,
                    finished_at: Number(payload?.finishedAt ?? Date.now()),
                    success: Boolean(payload?.success),
                }));
            };
            cdpSession.on?.('BrowserUse.captchaSolverStarted', onStarted);
            cdpSession.on?.('BrowserUse.captchaSolverFinished', onFinished);
            this._cdpSession = cdpSession;
            this._handlers = [
                { event: 'BrowserUse.captchaSolverStarted', handler: onStarted },
                { event: 'BrowserUse.captchaSolverFinished', handler: onFinished },
            ];
        }
        catch (error) {
            this.browser_session.logger.debug(`CaptchaWatchdog monitoring unavailable: ${error.message}`);
            await this.on_BrowserStoppedEvent();
        }
    }
    async on_BrowserStoppedEvent() {
        this._captchaSolving = false;
        this._captchaResult = 'unknown';
        this._captchaDurationMs = 0;
        this._captchaInfo = { vendor: 'unknown', url: '', target_id: '' };
        for (const resolve of this._waiters) {
            resolve();
        }
        this._waiters.clear();
        if (!this._cdpSession) {
            return;
        }
        for (const { event, handler } of this._handlers) {
            this._cdpSession.off?.(event, handler);
        }
        this._handlers = [];
        try {
            await this._cdpSession.detach?.();
        }
        catch {
            // Ignore detach errors during shutdown.
        }
        finally {
            this._cdpSession = null;
        }
    }
    onDetached() {
        void this.on_BrowserStoppedEvent();
    }
    async wait_if_captcha_solving(timeoutSeconds = 120) {
        if (!this._captchaSolving) {
            return null;
        }
        const vendor = this._captchaInfo.vendor;
        const url = this._captchaInfo.url;
        const timeoutMs = Math.max(0, timeoutSeconds * 1000);
        try {
            await new Promise((resolve, reject) => {
                const onResolved = () => {
                    cleanup();
                    resolve();
                };
                const timeoutHandle = setTimeout(() => {
                    cleanup();
                    reject(new Error('timeout'));
                }, timeoutMs);
                const cleanup = () => {
                    clearTimeout(timeoutHandle);
                    this._waiters.delete(onResolved);
                };
                this._waiters.add(onResolved);
            });
            return {
                waited: true,
                vendor,
                url,
                duration_ms: this._captchaDurationMs,
                result: this._captchaResult,
            };
        }
        catch {
            this._captchaSolving = false;
            this._waiters.clear();
            return {
                waited: true,
                vendor,
                url,
                duration_ms: timeoutMs,
                result: 'timeout',
            };
        }
    }
}
