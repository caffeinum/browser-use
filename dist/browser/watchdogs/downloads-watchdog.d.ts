import { BrowserConnectedEvent, BrowserLaunchEvent, BrowserStateRequestEvent, BrowserStoppedEvent, DownloadProgressEvent, DownloadStartedEvent, FileDownloadedEvent, TabClosedEvent } from '../events.js';
import { BaseWatchdog } from './base.js';
type DownloadStartInfo = {
    guid: string;
    url: string;
    suggested_filename: string;
    auto_download: boolean;
};
type DownloadProgressInfo = {
    guid: string;
    received_bytes: number;
    total_bytes: number;
    state: string;
};
type DownloadCompleteInfo = {
    guid: string | null;
    url: string;
    path: string;
    file_name: string;
    file_size: number;
    file_type: string | null;
    mime_type: string | null;
    auto_download: boolean;
};
export declare class DownloadsWatchdog extends BaseWatchdog {
    static LISTENS_TO: (typeof BrowserStateRequestEvent | typeof BrowserLaunchEvent | typeof BrowserConnectedEvent | typeof BrowserStoppedEvent | typeof TabClosedEvent | typeof DownloadStartedEvent | typeof DownloadProgressEvent | typeof FileDownloadedEvent)[];
    static EMITS: (typeof DownloadStartedEvent | typeof DownloadProgressEvent | typeof FileDownloadedEvent)[];
    private _activeDownloads;
    private _downloadStartCallbacks;
    private _downloadProgressCallbacks;
    private _downloadCompleteCallbacks;
    private _cdpSession;
    private _cdpListeners;
    private _networkDownloads;
    private _detectedDownloadUrls;
    on_BrowserConnectedEvent(): Promise<void>;
    on_BrowserLaunchEvent(): void;
    on_BrowserStateRequestEvent(event: BrowserStateRequestEvent): Promise<void>;
    on_BrowserStoppedEvent(): void;
    on_TabCreatedEvent(): null;
    on_TabClosedEvent(): null;
    on_NavigationCompleteEvent(): null;
    on_DownloadStartedEvent(event: DownloadStartedEvent): void;
    on_DownloadProgressEvent(event: DownloadProgressEvent): void;
    on_FileDownloadedEvent(event: FileDownloadedEvent): string;
    get_active_downloads(): {
        url: string;
        suggested_filename: string;
        started_at: string;
        received_bytes: number;
        total_bytes: number;
        state: string;
        guid: string;
    }[];
    register_download_callbacks(on_start_or_options?: ((info: DownloadStartInfo) => void) | {
        on_start?: ((info: DownloadStartInfo) => void) | null;
        on_progress?: ((info: DownloadProgressInfo) => void) | null;
        on_complete?: ((info: DownloadCompleteInfo) => void) | null;
    } | null, on_progress?: ((info: DownloadProgressInfo) => void) | null, on_complete?: ((info: DownloadCompleteInfo) => void) | null): void;
    unregister_download_callbacks(on_start_or_options?: ((info: DownloadStartInfo) => void) | {
        on_start?: ((info: DownloadStartInfo) => void) | null;
        on_progress?: ((info: DownloadProgressInfo) => void) | null;
        on_complete?: ((info: DownloadCompleteInfo) => void) | null;
    } | null, on_progress?: ((info: DownloadProgressInfo) => void) | null, on_complete?: ((info: DownloadCompleteInfo) => void) | null): void;
    protected onDetached(): void;
    private _normalizeCallbackRegistration;
    private _startCdpDownloadMonitoring;
    private _stopCdpDownloadMonitoring;
    private _handleNetworkResponse;
    private _handleNetworkLoadingFinished;
    private _normalizeHeaders;
    private _resolveSuggestedFilename;
    private _sanitizeFilename;
    private _inferFileType;
    private _getUniqueFilename;
}
export {};
