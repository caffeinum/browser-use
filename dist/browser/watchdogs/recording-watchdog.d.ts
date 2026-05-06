import { AgentFocusChangedEvent, BrowserConnectedEvent, BrowserStopEvent, BrowserStoppedEvent, TabCreatedEvent } from '../events.js';
import { BaseWatchdog } from './base.js';
export declare class RecordingWatchdog extends BaseWatchdog {
    static LISTENS_TO: (typeof BrowserStopEvent | typeof BrowserConnectedEvent | typeof BrowserStoppedEvent | typeof TabCreatedEvent)[];
    private _traceStarted;
    private _videoCloseListeners;
    private _cdpScreencastSession;
    private _cdpScreencastHandler;
    private _cdpScreencastPath;
    private _cdpScreencastStream;
    on_BrowserConnectedEvent(): Promise<void>;
    on_BrowserStopEvent(): Promise<void>;
    on_BrowserStoppedEvent(): Promise<void>;
    on_AgentFocusChangedEvent(event: AgentFocusChangedEvent): Promise<void>;
    on_TabCreatedEvent(): Promise<void>;
    protected onDetached(): void;
    private _prepareVideoDirectory;
    private _startTracingIfConfigured;
    private _stopTracingIfStarted;
    private _attachVideoListenersToKnownPages;
    private _attachVideoListener;
    private _detachVideoListeners;
    private _getKnownPages;
    private _captureVideoArtifact;
    private _startCdpScreencastIfConfigured;
    private _stopCdpScreencastIfStarted;
}
