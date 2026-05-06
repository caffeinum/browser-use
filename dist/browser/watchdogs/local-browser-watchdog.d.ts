import { BrowserKillEvent, BrowserLaunchEvent } from '../events.js';
import { BaseWatchdog } from './base.js';
export declare class LocalBrowserWatchdog extends BaseWatchdog {
    static LISTENS_TO: (typeof BrowserLaunchEvent | typeof BrowserKillEvent)[];
    on_BrowserLaunchEvent(): Promise<{
        cdp_url: string;
    }>;
    on_BrowserKillEvent(): Promise<void>;
    on_BrowserStopEvent(): void;
}
