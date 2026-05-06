import { BrowserConnectedEvent, BrowserStoppedEvent, CaptchaSolverFinishedEvent, CaptchaSolverStartedEvent } from '../events.js';
import { BaseWatchdog } from './base.js';
type CaptchaResultType = 'success' | 'failed' | 'timeout' | 'unknown';
export interface CaptchaWaitResult {
    waited: boolean;
    vendor: string;
    url: string;
    duration_ms: number;
    result: CaptchaResultType;
}
export declare class CaptchaWatchdog extends BaseWatchdog {
    static LISTENS_TO: (typeof BrowserConnectedEvent | typeof BrowserStoppedEvent)[];
    static EMITS: (typeof CaptchaSolverStartedEvent | typeof CaptchaSolverFinishedEvent)[];
    private _cdpSession;
    private _handlers;
    private _captchaSolving;
    private _captchaInfo;
    private _captchaResult;
    private _captchaDurationMs;
    private _waiters;
    on_BrowserConnectedEvent(): Promise<void>;
    on_BrowserStoppedEvent(): Promise<void>;
    protected onDetached(): void;
    wait_if_captcha_solving(timeoutSeconds?: number): Promise<CaptchaWaitResult | null>;
}
export {};
