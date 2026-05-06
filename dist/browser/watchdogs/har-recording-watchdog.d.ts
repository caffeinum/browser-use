import { BrowserConnectedEvent, BrowserStopEvent, BrowserStartEvent, BrowserStoppedEvent } from '../events.js';
import { BaseWatchdog } from './base.js';
export declare class HarRecordingWatchdog extends BaseWatchdog {
    static LISTENS_TO: (typeof BrowserStartEvent | typeof BrowserStopEvent | typeof BrowserConnectedEvent | typeof BrowserStoppedEvent)[];
    private _harPath;
    private _cdpSession;
    private _listeners;
    private _entries;
    on_BrowserStartEvent(): Promise<void>;
    on_BrowserConnectedEvent(): Promise<void>;
    on_BrowserStopEvent(): Promise<void>;
    on_BrowserStoppedEvent(): Promise<void>;
    protected onDetached(): void;
    private _resolveConfiguredHarPath;
    private _resolveAndPrepareHarPath;
    private _startCdpCaptureIfNeeded;
    private _writeHarFallbackIfNeeded;
    private _teardownCapture;
}
