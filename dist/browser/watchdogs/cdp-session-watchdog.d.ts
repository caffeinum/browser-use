import { BrowserConnectedEvent, BrowserStoppedEvent } from '../events.js';
import { BaseWatchdog } from './base.js';
export declare class CDPSessionWatchdog extends BaseWatchdog {
    static LISTENS_TO: (typeof BrowserConnectedEvent | typeof BrowserStoppedEvent)[];
    private _rootCdpSession;
    private _listeners;
    private _knownTargets;
    on_BrowserConnectedEvent(): Promise<void>;
    on_BrowserStoppedEvent(): Promise<void>;
    protected onDetached(): void;
    private _ensureCdpMonitoring;
    private _teardownCdpMonitoring;
    private _dispatchEventSafely;
}
