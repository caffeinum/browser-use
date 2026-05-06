import fs from 'node:fs';
import path from 'node:path';
import { BrowserConnectedEvent, BrowserStopEvent, BrowserErrorEvent, BrowserStartEvent, BrowserStoppedEvent, } from '../events.js';
import { BaseWatchdog } from './base.js';
const toIsoFromEpochSeconds = (value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return new Date().toISOString();
    }
    return new Date(value * 1000).toISOString();
};
const normalizeHeaders = (input) => {
    if (!input) {
        return {};
    }
    if (Array.isArray(input)) {
        const out = {};
        for (const header of input) {
            if (header &&
                typeof header === 'object' &&
                'name' in header &&
                'value' in header) {
                out[String(header.name).toLowerCase()] = String(header.value);
            }
        }
        return out;
    }
    if (typeof input === 'object') {
        return Object.fromEntries(Object.entries(input).map(([key, value]) => [
            key.toLowerCase(),
            String(value),
        ]));
    }
    return {};
};
export class HarRecordingWatchdog extends BaseWatchdog {
    static LISTENS_TO = [
        BrowserStartEvent,
        BrowserConnectedEvent,
        BrowserStopEvent,
        BrowserStoppedEvent,
    ];
    _harPath = null;
    _cdpSession = null;
    _listeners = [];
    _entries = new Map();
    async on_BrowserStartEvent() {
        const resolvedPath = this._resolveAndPrepareHarPath();
        if (!resolvedPath) {
            return;
        }
        this._harPath = resolvedPath;
    }
    async on_BrowserConnectedEvent() {
        await this._startCdpCaptureIfNeeded();
    }
    async on_BrowserStopEvent() {
        await this._writeHarFallbackIfNeeded();
    }
    async on_BrowserStoppedEvent() {
        const resolvedPath = this._harPath ?? this._resolveConfiguredHarPath();
        if (!resolvedPath) {
            await this._teardownCapture();
            return;
        }
        if (!fs.existsSync(resolvedPath)) {
            await this.event_bus.dispatch(new BrowserErrorEvent({
                error_type: 'HarRecordingMissing',
                message: `HAR file was not created at ${resolvedPath}`,
                details: {
                    record_har_path: resolvedPath,
                },
            }));
            await this._teardownCapture();
            return;
        }
        try {
            const stat = fs.statSync(resolvedPath);
            if (stat.size === 0) {
                await this.event_bus.dispatch(new BrowserErrorEvent({
                    error_type: 'HarRecordingEmpty',
                    message: `HAR file is empty at ${resolvedPath}`,
                    details: {
                        record_har_path: resolvedPath,
                    },
                }));
            }
        }
        catch (error) {
            await this.event_bus.dispatch(new BrowserErrorEvent({
                error_type: 'HarRecordingStatFailed',
                message: `Failed to inspect HAR file: ${error.message}`,
                details: {
                    record_har_path: resolvedPath,
                },
            }));
        }
        finally {
            await this._teardownCapture();
        }
    }
    onDetached() {
        void this._teardownCapture();
    }
    _resolveConfiguredHarPath() {
        const configuredPath = this.browser_session.browser_profile.config.record_har_path;
        if (typeof configuredPath !== 'string' || configuredPath.trim() === '') {
            return null;
        }
        return path.resolve(configuredPath);
    }
    _resolveAndPrepareHarPath() {
        const resolvedPath = this._resolveConfiguredHarPath();
        if (!resolvedPath) {
            return null;
        }
        fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
        this.browser_session.browser_profile.config.record_har_path = resolvedPath;
        return resolvedPath;
    }
    async _startCdpCaptureIfNeeded() {
        if (!this._harPath || this._cdpSession) {
            return;
        }
        try {
            const cdpSession = (await this.browser_session.get_or_create_cdp_session(null));
            this._cdpSession = cdpSession;
            await cdpSession.send?.('Network.enable');
            const onRequestWillBeSent = (payload) => {
                const requestId = String(payload?.requestId ?? '');
                const request = payload?.request ?? {};
                const url = String(request?.url ?? '');
                if (!requestId || !url.toLowerCase().startsWith('https://')) {
                    return;
                }
                const tsRequest = typeof payload?.timestamp === 'number' ? payload.timestamp : null;
                this._entries.set(requestId, {
                    request_id: requestId,
                    started_date_time: toIsoFromEpochSeconds(typeof payload?.wallTime === 'number'
                        ? payload.wallTime
                        : Date.now() / 1000),
                    method: String(request?.method ?? 'GET'),
                    url,
                    request_headers: normalizeHeaders(request?.headers),
                    status: 0,
                    status_text: '',
                    response_headers: {},
                    mime_type: '',
                    failed: false,
                    ts_request: tsRequest,
                    ts_response: null,
                    ts_finished: null,
                    encoded_data_length: null,
                });
            };
            const onResponseReceived = (payload) => {
                const requestId = String(payload?.requestId ?? '');
                const entry = this._entries.get(requestId);
                if (!entry) {
                    return;
                }
                const response = payload?.response ?? {};
                entry.status =
                    typeof response?.status === 'number'
                        ? response.status
                        : Number(response?.status ?? 0);
                entry.status_text = String(response?.statusText ?? '');
                entry.response_headers = normalizeHeaders(response?.headers);
                entry.mime_type = String(response?.mimeType ?? '');
                entry.ts_response =
                    typeof payload?.timestamp === 'number' ? payload.timestamp : null;
            };
            const onLoadingFinished = (payload) => {
                const requestId = String(payload?.requestId ?? '');
                const entry = this._entries.get(requestId);
                if (!entry) {
                    return;
                }
                entry.ts_finished =
                    typeof payload?.timestamp === 'number' ? payload.timestamp : null;
                entry.encoded_data_length =
                    typeof payload?.encodedDataLength === 'number'
                        ? payload.encodedDataLength
                        : null;
            };
            const onLoadingFailed = (payload) => {
                const requestId = String(payload?.requestId ?? '');
                const entry = this._entries.get(requestId);
                if (!entry) {
                    return;
                }
                entry.failed = true;
            };
            cdpSession.on?.('Network.requestWillBeSent', onRequestWillBeSent);
            cdpSession.on?.('Network.responseReceived', onResponseReceived);
            cdpSession.on?.('Network.loadingFinished', onLoadingFinished);
            cdpSession.on?.('Network.loadingFailed', onLoadingFailed);
            this._listeners = [
                { event: 'Network.requestWillBeSent', handler: onRequestWillBeSent },
                { event: 'Network.responseReceived', handler: onResponseReceived },
                { event: 'Network.loadingFinished', handler: onLoadingFinished },
                { event: 'Network.loadingFailed', handler: onLoadingFailed },
            ];
        }
        catch (error) {
            await this.event_bus.dispatch(new BrowserErrorEvent({
                error_type: 'HarCaptureUnavailable',
                message: `CDP HAR capture is unavailable: ${error.message}`,
                details: {
                    record_har_path: this._harPath,
                },
            }));
        }
    }
    async _writeHarFallbackIfNeeded() {
        const resolvedPath = this._harPath ?? this._resolveConfiguredHarPath();
        if (!resolvedPath) {
            return;
        }
        if (fs.existsSync(resolvedPath)) {
            try {
                if (fs.statSync(resolvedPath).size > 0) {
                    return;
                }
            }
            catch {
                // Continue into fallback writer.
            }
        }
        const entries = [...this._entries.values()];
        const harEntries = entries.map((entry) => {
            const waitMs = entry.ts_request != null && entry.ts_response != null
                ? Math.max(0, Math.round((entry.ts_response - entry.ts_request) * 1000))
                : 0;
            const receiveMs = entry.ts_response != null && entry.ts_finished != null
                ? Math.max(0, Math.round((entry.ts_finished - entry.ts_response) * 1000))
                : 0;
            const totalMs = waitMs + receiveMs;
            return {
                startedDateTime: entry.started_date_time,
                time: totalMs,
                request: {
                    method: entry.method,
                    url: entry.url,
                    httpVersion: 'HTTP/1.1',
                    headers: Object.entries(entry.request_headers).map(([name, value]) => ({
                        name,
                        value,
                    })),
                    queryString: [],
                    cookies: [],
                    headersSize: -1,
                    bodySize: -1,
                },
                response: {
                    status: entry.status,
                    statusText: entry.status_text,
                    httpVersion: 'HTTP/1.1',
                    headers: Object.entries(entry.response_headers).map(([name, value]) => ({
                        name,
                        value,
                    })),
                    cookies: [],
                    content: {
                        size: entry.encoded_data_length ?? -1,
                        mimeType: entry.mime_type,
                    },
                    redirectURL: '',
                    headersSize: -1,
                    bodySize: entry.encoded_data_length ?? -1,
                },
                cache: {},
                timings: {
                    dns: -1,
                    connect: -1,
                    ssl: -1,
                    send: 0,
                    wait: waitMs,
                    receive: receiveMs,
                },
                _failed: entry.failed,
            };
        });
        const harObject = {
            log: {
                version: '1.2',
                creator: {
                    name: 'browser-use-node',
                    version: 'dev',
                },
                pages: [],
                entries: harEntries,
            },
        };
        const tempPath = `${resolvedPath}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(harObject, null, 2), 'utf-8');
        fs.renameSync(tempPath, resolvedPath);
    }
    async _teardownCapture() {
        if (!this._cdpSession) {
            return;
        }
        for (const listener of this._listeners) {
            this._cdpSession.off?.(listener.event, listener.handler);
        }
        this._listeners = [];
        try {
            await this._cdpSession.detach?.();
        }
        catch {
            // Ignore CDP detach errors during shutdown.
        }
        finally {
            this._cdpSession = null;
            this._entries.clear();
        }
    }
}
