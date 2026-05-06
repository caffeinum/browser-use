import { BrowserErrorEvent, CloseTabEvent, NavigateToUrlEvent, NavigationCompleteEvent, TabCreatedEvent } from '../events.js';
import { BaseWatchdog } from './base.js';
export declare class SecurityWatchdog extends BaseWatchdog {
    static LISTENS_TO: (typeof NavigateToUrlEvent | typeof TabCreatedEvent)[];
    static EMITS: (typeof CloseTabEvent | typeof BrowserErrorEvent)[];
    on_NavigateToUrlEvent(event: NavigateToUrlEvent): Promise<void>;
    on_NavigationCompleteEvent(event: NavigationCompleteEvent): Promise<void>;
    on_TabCreatedEvent(event: TabCreatedEvent): Promise<void>;
    private _getUrlDenialReason;
}
