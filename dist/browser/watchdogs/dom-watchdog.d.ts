import { BrowserErrorEvent, BrowserStateRequestEvent, TabCreatedEvent } from '../events.js';
import { BaseWatchdog } from './base.js';
export declare class DOMWatchdog extends BaseWatchdog {
    static LISTENS_TO: (typeof BrowserStateRequestEvent | typeof TabCreatedEvent)[];
    static EMITS: (typeof BrowserErrorEvent)[];
    on_TabCreatedEvent(): Promise<null>;
    on_BrowserStateRequestEvent(event: BrowserStateRequestEvent): Promise<import("../views.js").BrowserStateSummary>;
}
