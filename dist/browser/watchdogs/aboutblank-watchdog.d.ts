import { AboutBlankDVDScreensaverShownEvent, BrowserStopEvent, BrowserStoppedEvent, NavigateToUrlEvent, TabClosedEvent, TabCreatedEvent } from '../events.js';
import { BaseWatchdog } from './base.js';
export declare class AboutBlankWatchdog extends BaseWatchdog {
    static LISTENS_TO: (typeof BrowserStopEvent | typeof BrowserStoppedEvent | typeof TabClosedEvent)[];
    static EMITS: (typeof NavigateToUrlEvent | typeof AboutBlankDVDScreensaverShownEvent)[];
    private _stopping;
    on_BrowserStopEvent(): Promise<void>;
    on_BrowserStoppedEvent(): Promise<void>;
    on_TabClosedEvent(): Promise<void>;
    on_TabCreatedEvent(event: TabCreatedEvent): Promise<void>;
    private _injectDvdScreensaverOverlay;
}
