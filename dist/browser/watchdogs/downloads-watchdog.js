import fs from 'node:fs';
import path from 'node:path';
import { BrowserConnectedEvent, BrowserLaunchEvent, BrowserStateRequestEvent, BrowserStoppedEvent, DownloadProgressEvent, DownloadStartedEvent, FileDownloadedEvent, NavigationCompleteEvent, TabClosedEvent, TabCreatedEvent, } from '../events.js';
import { BaseWatchdog } from './base.js';
export class DownloadsWatchdog extends BaseWatchdog {
    static LISTENS_TO = [
        BrowserConnectedEvent,
        BrowserLaunchEvent,
        BrowserStateRequestEvent,
        BrowserStoppedEvent,
        TabCreatedEvent,
        TabClosedEvent,
        NavigationCompleteEvent,
        DownloadStartedEvent,
        DownloadProgressEvent,
        FileDownloadedEvent,
    ];
    static EMITS = [
        DownloadStartedEvent,
        DownloadProgressEvent,
        FileDownloadedEvent,
    ];
    _activeDownloads = new Map();
    _downloadStartCallbacks = [];
    _downloadProgressCallbacks = [];
    _downloadCompleteCallbacks = [];
    _cdpSession = null;
    _cdpListeners = [];
    _networkDownloads = new Map();
    _detectedDownloadUrls = new Set();
    async on_BrowserConnectedEvent() {
        await this._startCdpDownloadMonitoring();
    }
    on_BrowserLaunchEvent() {
        const downloadsPath = this.browser_session.browser_profile.downloads_path;
        if (!downloadsPath) {
            return;
        }
        fs.mkdirSync(downloadsPath, { recursive: true });
    }
    async on_BrowserStateRequestEvent(event) {
        const activeTab = this.browser_session.active_tab;
        if (!activeTab?.target_id || !activeTab.url) {
            return;
        }
        await this.event_bus.dispatch(new NavigationCompleteEvent({
            target_id: activeTab.target_id,
            url: activeTab.url,
            status: null,
            error_message: null,
            loading_status: null,
            event_parent_id: event.event_id,
        }));
    }
    on_BrowserStoppedEvent() {
        this._activeDownloads.clear();
        this._downloadStartCallbacks = [];
        this._downloadProgressCallbacks = [];
        this._downloadCompleteCallbacks = [];
        this._networkDownloads.clear();
        this._detectedDownloadUrls.clear();
        void this._stopCdpDownloadMonitoring();
    }
    on_TabCreatedEvent() {
        return null;
    }
    on_TabClosedEvent() {
        return null;
    }
    on_NavigationCompleteEvent() {
        return null;
    }
    on_DownloadStartedEvent(event) {
        const startInfo = {
            guid: event.guid,
            url: event.url,
            suggested_filename: event.suggested_filename,
            auto_download: event.auto_download,
        };
        this._activeDownloads.set(event.guid, {
            url: event.url,
            suggested_filename: event.suggested_filename,
            started_at: new Date().toISOString(),
            received_bytes: 0,
            total_bytes: 0,
            state: 'inProgress',
        });
        for (const callback of this._downloadStartCallbacks) {
            try {
                callback(startInfo);
            }
            catch (error) {
                this.browser_session.logger.debug(`[DownloadsWatchdog] Error in download start callback: ${error.message}`);
            }
        }
    }
    on_DownloadProgressEvent(event) {
        const existing = this._activeDownloads.get(event.guid);
        if (existing) {
            existing.received_bytes = event.received_bytes;
            existing.total_bytes = event.total_bytes;
            existing.state = event.state;
            if (event.state === 'completed' || event.state === 'canceled') {
                this._activeDownloads.delete(event.guid);
            }
        }
        const progressInfo = {
            guid: event.guid,
            received_bytes: event.received_bytes,
            total_bytes: event.total_bytes,
            state: event.state,
        };
        for (const callback of this._downloadProgressCallbacks) {
            try {
                callback(progressInfo);
            }
            catch (error) {
                this.browser_session.logger.debug(`[DownloadsWatchdog] Error in download progress callback: ${error.message}`);
            }
        }
    }
    on_FileDownloadedEvent(event) {
        if (event.guid) {
            this._activeDownloads.delete(event.guid);
        }
        this.browser_session.add_downloaded_file(event.path);
        const completeInfo = {
            guid: event.guid,
            url: event.url,
            path: event.path,
            file_name: event.file_name,
            file_size: event.file_size,
            file_type: event.file_type,
            mime_type: event.mime_type,
            auto_download: event.auto_download,
        };
        for (const callback of this._downloadCompleteCallbacks) {
            try {
                callback(completeInfo);
            }
            catch (error) {
                this.browser_session.logger.debug(`[DownloadsWatchdog] Error in download complete callback: ${error.message}`);
            }
        }
        return event.path;
    }
    get_active_downloads() {
        return [...this._activeDownloads.entries()].map(([guid, metadata]) => ({
            guid,
            ...metadata,
        }));
    }
    register_download_callbacks(on_start_or_options = null, on_progress = null, on_complete = null) {
        const { on_start, on_progress: resolvedProgress, on_complete: resolvedEnd, } = this._normalizeCallbackRegistration(on_start_or_options, on_progress, on_complete);
        if (on_start) {
            this._downloadStartCallbacks.push(on_start);
        }
        if (resolvedProgress) {
            this._downloadProgressCallbacks.push(resolvedProgress);
        }
        if (resolvedEnd) {
            this._downloadCompleteCallbacks.push(resolvedEnd);
        }
    }
    unregister_download_callbacks(on_start_or_options = null, on_progress = null, on_complete = null) {
        const { on_start, on_progress: resolvedProgress, on_complete: resolvedEnd, } = this._normalizeCallbackRegistration(on_start_or_options, on_progress, on_complete);
        if (on_start) {
            this._downloadStartCallbacks = this._downloadStartCallbacks.filter((callback) => callback !== on_start);
        }
        if (resolvedProgress) {
            this._downloadProgressCallbacks = this._downloadProgressCallbacks.filter((callback) => callback !== resolvedProgress);
        }
        if (resolvedEnd) {
            this._downloadCompleteCallbacks = this._downloadCompleteCallbacks.filter((callback) => callback !== resolvedEnd);
        }
    }
    onDetached() {
        this._activeDownloads.clear();
        this._downloadStartCallbacks = [];
        this._downloadProgressCallbacks = [];
        this._downloadCompleteCallbacks = [];
        this._networkDownloads.clear();
        this._detectedDownloadUrls.clear();
        void this._stopCdpDownloadMonitoring();
    }
    _normalizeCallbackRegistration(on_start_or_options, on_progress, on_complete) {
        if (on_start_or_options &&
            typeof on_start_or_options === 'object' &&
            !Array.isArray(on_start_or_options)) {
            return {
                on_start: on_start_or_options.on_start ?? null,
                on_progress: on_start_or_options.on_progress ?? null,
                on_complete: on_start_or_options.on_complete ?? null,
            };
        }
        return {
            on_start: typeof on_start_or_options === 'function' ? on_start_or_options : null,
            on_progress,
            on_complete,
        };
    }
    async _startCdpDownloadMonitoring() {
        if (this._cdpSession) {
            return;
        }
        if (!this.browser_session.browser_context?.newCDPSession) {
            return;
        }
        try {
            const session = (await this.browser_session.get_or_create_cdp_session(null));
            await session.send?.('Network.enable');
            this._cdpSession = session;
            const onResponseReceived = (payload) => {
                void this._handleNetworkResponse(payload);
            };
            const onLoadingFinished = (payload) => {
                void this._handleNetworkLoadingFinished(payload);
            };
            session.on?.('Network.responseReceived', onResponseReceived);
            session.on?.('Network.loadingFinished', onLoadingFinished);
            this._cdpListeners = [
                {
                    event: 'Network.responseReceived',
                    handler: onResponseReceived,
                },
                {
                    event: 'Network.loadingFinished',
                    handler: onLoadingFinished,
                },
            ];
        }
        catch (error) {
            this.browser_session.logger.debug(`[DownloadsWatchdog] CDP download monitoring unavailable: ${error.message}`);
            await this._stopCdpDownloadMonitoring();
        }
    }
    async _stopCdpDownloadMonitoring() {
        if (!this._cdpSession) {
            return;
        }
        for (const listener of this._cdpListeners) {
            this._cdpSession.off?.(listener.event, listener.handler);
        }
        this._cdpListeners = [];
        try {
            await this._cdpSession.detach?.();
        }
        catch {
            // Ignore detach errors during shutdown.
        }
        finally {
            this._cdpSession = null;
        }
    }
    async _handleNetworkResponse(payload) {
        const requestId = String(payload?.requestId ?? '');
        if (!requestId) {
            return;
        }
        const response = payload?.response ?? {};
        const url = String(response?.url ?? '').trim();
        if (!url || this._detectedDownloadUrls.has(url)) {
            return;
        }
        const headers = this._normalizeHeaders(response?.headers);
        const mimeType = typeof response?.mimeType === 'string'
            ? response.mimeType.toLowerCase()
            : '';
        const contentDisposition = headers['content-disposition'] ?? '';
        const isPdf = mimeType.includes('application/pdf') || /\.pdf(?:$|\?)/i.test(url);
        const isAttachment = /attachment/i.test(contentDisposition);
        const isBinary = mimeType.includes('application/octet-stream');
        if (!isPdf && !isAttachment && !isBinary) {
            return;
        }
        this._detectedDownloadUrls.add(url);
        const suggestedFilename = this._resolveSuggestedFilename(contentDisposition, url);
        const guid = `cdp-${requestId}`;
        const autoDownload = isPdf && this.browser_session.auto_download_pdfs();
        const fileType = this._inferFileType(suggestedFilename, mimeType);
        this._networkDownloads.set(requestId, {
            guid,
            url,
            suggested_filename: suggestedFilename,
            mime_type: mimeType || null,
            file_type: fileType,
            auto_download: autoDownload,
        });
        await this.event_bus.dispatch(new DownloadStartedEvent({
            guid,
            url,
            suggested_filename: suggestedFilename,
            auto_download: autoDownload,
        }));
    }
    async _handleNetworkLoadingFinished(payload) {
        const requestId = String(payload?.requestId ?? '');
        if (!requestId) {
            return;
        }
        const metadata = this._networkDownloads.get(requestId);
        if (!metadata) {
            return;
        }
        this._networkDownloads.delete(requestId);
        const encodedDataLength = typeof payload?.encodedDataLength === 'number'
            ? Math.max(0, Math.floor(payload.encodedDataLength))
            : 0;
        await this.event_bus.dispatch(new DownloadProgressEvent({
            guid: metadata.guid,
            received_bytes: encodedDataLength,
            total_bytes: encodedDataLength,
            state: 'completed',
        }));
        if (!metadata.auto_download ||
            !metadata.mime_type?.includes('application/pdf')) {
            return;
        }
        const downloadsPath = this.browser_session.browser_profile.downloads_path;
        if (!downloadsPath || !this._cdpSession?.send) {
            return;
        }
        try {
            const responseBody = await this._cdpSession.send('Network.getResponseBody', {
                requestId,
            });
            const body = typeof responseBody?.body === 'string' ? responseBody.body : '';
            if (!body) {
                return;
            }
            fs.mkdirSync(downloadsPath, { recursive: true });
            const uniqueFilename = await this._getUniqueFilename(downloadsPath, metadata.suggested_filename);
            const filePath = path.join(downloadsPath, uniqueFilename);
            const content = responseBody?.base64Encoded
                ? Buffer.from(body, 'base64')
                : Buffer.from(body, 'utf8');
            fs.writeFileSync(filePath, content);
            await this.event_bus.dispatch(new FileDownloadedEvent({
                guid: metadata.guid,
                url: metadata.url,
                path: filePath,
                file_name: uniqueFilename,
                file_size: content.length,
                file_type: metadata.file_type,
                mime_type: metadata.mime_type,
                auto_download: true,
            }));
        }
        catch (error) {
            this.browser_session.logger.debug(`[DownloadsWatchdog] Failed to materialize CDP download body: ${error.message}`);
        }
    }
    _normalizeHeaders(input) {
        if (!input || typeof input !== 'object') {
            return {};
        }
        return Object.fromEntries(Object.entries(input).map(([k, v]) => [
            k.toLowerCase(),
            String(v),
        ]));
    }
    _resolveSuggestedFilename(contentDisposition, url) {
        const filenameMatch = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(contentDisposition);
        const fromHeader = filenameMatch?.[1] || filenameMatch?.[2] || '';
        const candidate = decodeURIComponent(fromHeader || '').trim();
        if (candidate) {
            return this._sanitizeFilename(candidate);
        }
        try {
            const parsed = new URL(url);
            const basename = path.basename(parsed.pathname);
            if (basename) {
                return this._sanitizeFilename(basename);
            }
        }
        catch {
            // Ignore URL parsing errors and fallback below.
        }
        return 'download';
    }
    _sanitizeFilename(filename) {
        const sanitized = filename
            .replace(/[\\/:*?"<>|]+/g, '_')
            .replace(/\s+/g, ' ')
            .trim();
        return sanitized || 'download';
    }
    _inferFileType(filename, mimeType) {
        const ext = path.extname(filename).replace('.', '').toLowerCase();
        if (ext) {
            return ext;
        }
        if (mimeType.includes('pdf')) {
            return 'pdf';
        }
        return null;
    }
    async _getUniqueFilename(directory, filename) {
        const ext = path.extname(filename);
        const basename = ext ? filename.slice(0, -ext.length) : filename;
        let candidate = filename || 'download';
        let counter = 1;
        while (fs.existsSync(path.join(directory, candidate))) {
            candidate = `${basename || 'download'}_${counter}${ext}`;
            counter += 1;
        }
        return candidate;
    }
}
