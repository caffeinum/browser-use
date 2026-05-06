import { BrowserConnectedEvent, BrowserErrorEvent } from '../events.js';
import { BaseWatchdog } from './base.js';
export declare class PermissionsWatchdog extends BaseWatchdog {
    static LISTENS_TO: (typeof BrowserConnectedEvent)[];
    static EMITS: (typeof BrowserErrorEvent)[];
    on_BrowserConnectedEvent(): Promise<void>;
    private _grantPermissionsViaCdp;
}
