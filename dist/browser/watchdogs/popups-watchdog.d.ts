import { BrowserStoppedEvent, TabCreatedEvent } from '../events.js';
import { BaseWatchdog } from './base.js';
export declare class PopupsWatchdog extends BaseWatchdog {
    static LISTENS_TO: (typeof BrowserStoppedEvent | typeof TabCreatedEvent)[];
    private _dialogListenersRegistered;
    private _cdpDialogSessions;
    on_TabCreatedEvent(event: TabCreatedEvent): Promise<void>;
    on_BrowserStoppedEvent(): Promise<void>;
    protected onDetached(): void;
    private _attachCdpDialogHandler;
    private _detachCdpDialogHandlers;
    private _handleJavascriptDialog;
}
