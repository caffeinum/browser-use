import fs from 'node:fs';
import path from 'node:path';
import {
  BrowserConnectedEvent,
  BrowserStopEvent,
  BrowserErrorEvent,
  BrowserStartEvent,
  BrowserStoppedEvent,
} from '../events.js';
import { BaseWatchdog } from './base.js';

type CDPSessionLike = {
  send?: (method: string, params?: Record<string, unknown>) => Promise<any>;
  on?: (event: string, listener: (payload: any) => void) => void;
  off?: (event: string, listener: (payload: any) => void) => void;
  detach?: () => Promise<void>;
};

type HarEntryBuilder = {
  request_id: string;
  started_date_time: string;
  method: string;
  url: string;
  request_headers: Record<string, string>;
  status: number;
  status_text: string;
  response_headers: Record<string, string>;
  mime_type: string;
  failed: boolean;
  ts_request: number | null;
  ts_response: number | null;
  ts_finished: number | null;
  encoded_data_length: number | null;
};

const toIsoFromEpochSeconds = (value: number | null | undefined): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return new Date().toISOString();
  }
  return new Date(value * 1000).toISOString();
};

const normalizeHeaders = (input: unknown): Record<string, string> => {
  if (!input) {
    return {};
  }
  if (Array.isArray(input)) {
    const out: Record<string, string> = {};
    for (const header of input) {
      if (
        header &&
        typeof header === 'object' &&
        'name' in header &&
        'value' in header
      ) {
        out[String((header as any).name).toLowerCase()] = String(
          (header as any).value
        );
      }
    }
    return out;
  }
  if (typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>).map(([key, value]) => [
        key.toLowerCase(),
        String(value),
      ])
    );
  }
  return {};
};

const chmodPrivatePath = (targetPath: string, mode: number) => {
  if (process.platform === 'win32') {
    return;
  }
  try {
    fs.chmodSync(targetPath, mode);
  } catch {
    /* best effort */
  }
};

const ensurePrivateDirectoryIfCreated = (dirPath: string) => {
  const existed = fs.existsSync(dirPath);
  fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
  if (!existed) {
    chmodPrivatePath(dirPath, 0o700);
  }
};

const writePrivateFile = (filePath: string, contents: string) => {
  fs.writeFileSync(filePath, contents, {
    encoding: 'utf-8',
    mode: 0o600,
  });
  chmodPrivatePath(filePath, 0o600);
};

export class HarRecordingWatchdog extends BaseWatchdog {
  static override LISTENS_TO = [
    BrowserStartEvent,
    BrowserConnectedEvent,
    BrowserStopEvent,
    BrowserStoppedEvent,
  ];

  private _harPath: string | null = null;
  private _cdpSession: CDPSessionLike | null = null;
  private _listeners: Array<{
    event: string;
    handler: (payload: any) => void;
  }> = [];
  private _entries = new Map<string, HarEntryBuilder>();

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
      await this.event_bus.dispatch(
        new BrowserErrorEvent({
          error_type: 'HarRecordingMissing',
          message: `HAR file was not created at ${resolvedPath}`,
          details: {
            record_har_path: resolvedPath,
          },
        })
      );
      await this._teardownCapture();
      return;
    }

    try {
      chmodPrivatePath(resolvedPath, 0o600);
      const stat = fs.statSync(resolvedPath);
      if (stat.size === 0) {
        await this.event_bus.dispatch(
          new BrowserErrorEvent({
            error_type: 'HarRecordingEmpty',
            message: `HAR file is empty at ${resolvedPath}`,
            details: {
              record_har_path: resolvedPath,
            },
          })
        );
      }
    } catch (error) {
      await this.event_bus.dispatch(
        new BrowserErrorEvent({
          error_type: 'HarRecordingStatFailed',
          message: `Failed to inspect HAR file: ${(error as Error).message}`,
          details: {
            record_har_path: resolvedPath,
          },
        })
      );
    } finally {
      await this._teardownCapture();
    }
  }

  protected override onDetached() {
    this.runBackground('teardown HAR capture', this._teardownCapture());
  }

  private _resolveConfiguredHarPath(): string | null {
    const configuredPath =
      this.browser_session.browser_profile.config.record_har_path;
    if (typeof configuredPath !== 'string' || configuredPath.trim() === '') {
      return null;
    }
    return path.resolve(configuredPath);
  }

  private _resolveAndPrepareHarPath(): string | null {
    const resolvedPath = this._resolveConfiguredHarPath();
    if (!resolvedPath) {
      return null;
    }
    ensurePrivateDirectoryIfCreated(path.dirname(resolvedPath));
    this.browser_session.browser_profile.config.record_har_path = resolvedPath;
    return resolvedPath;
  }

  private async _startCdpCaptureIfNeeded() {
    if (!this._harPath || this._cdpSession) {
      return;
    }

    try {
      const cdpSession = (await this.browser_session.get_or_create_cdp_session(
        null
      )) as CDPSessionLike;
      this._cdpSession = cdpSession;
      await cdpSession.send?.('Network.enable');

      const onRequestWillBeSent = (payload: any) => {
        const requestId = String(payload?.requestId ?? '');
        const request = payload?.request ?? {};
        const url = String(request?.url ?? '');
        if (!requestId || !url.toLowerCase().startsWith('https://')) {
          return;
        }
        const denialReason = this._getUrlDenialReason(url);
        if (denialReason) {
          this.browser_session.logger.debug(
            `[HarRecordingWatchdog] Skipping HAR entry blocked by domain policy: ${denialReason}`
          );
          return;
        }
        const tsRequest =
          typeof payload?.timestamp === 'number' ? payload.timestamp : null;
        this._entries.set(requestId, {
          request_id: requestId,
          started_date_time: toIsoFromEpochSeconds(
            typeof payload?.wallTime === 'number'
              ? payload.wallTime
              : Date.now() / 1000
          ),
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

      const onResponseReceived = (payload: any) => {
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

      const onLoadingFinished = (payload: any) => {
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

      const onLoadingFailed = (payload: any) => {
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
    } catch (error) {
      await this.event_bus.dispatch(
        new BrowserErrorEvent({
          error_type: 'HarCaptureUnavailable',
          message: `CDP HAR capture is unavailable: ${(error as Error).message}`,
          details: {
            record_har_path: this._harPath,
          },
        })
      );
    }
  }

  private async _writeHarFallbackIfNeeded() {
    const resolvedPath = this._harPath ?? this._resolveConfiguredHarPath();
    if (!resolvedPath) {
      return;
    }

    if (fs.existsSync(resolvedPath)) {
      try {
        if (fs.statSync(resolvedPath).size > 0) {
          return;
        }
      } catch {
        // Continue into fallback writer.
      }
    }

    const entries = [...this._entries.values()];
    const harEntries = entries.map((entry) => {
      const waitMs =
        entry.ts_request != null && entry.ts_response != null
          ? Math.max(
              0,
              Math.round((entry.ts_response - entry.ts_request) * 1000)
            )
          : 0;
      const receiveMs =
        entry.ts_response != null && entry.ts_finished != null
          ? Math.max(
              0,
              Math.round((entry.ts_finished - entry.ts_response) * 1000)
            )
          : 0;
      const totalMs = waitMs + receiveMs;

      return {
        startedDateTime: entry.started_date_time,
        time: totalMs,
        request: {
          method: entry.method,
          url: entry.url,
          httpVersion: 'HTTP/1.1',
          headers: Object.entries(entry.request_headers).map(
            ([name, value]) => ({
              name,
              value,
            })
          ),
          queryString: [],
          cookies: [],
          headersSize: -1,
          bodySize: -1,
        },
        response: {
          status: entry.status,
          statusText: entry.status_text,
          httpVersion: 'HTTP/1.1',
          headers: Object.entries(entry.response_headers).map(
            ([name, value]) => ({
              name,
              value,
            })
          ),
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
    writePrivateFile(tempPath, JSON.stringify(harObject, null, 2));
    fs.renameSync(tempPath, resolvedPath);
    chmodPrivatePath(resolvedPath, 0o600);
  }

  private _getUrlDenialReason(url: string): string | null {
    const session = this.browser_session as any;
    if (typeof session._get_url_access_denial_reason === 'function') {
      try {
        return session._get_url_access_denial_reason(url);
      } catch {
        return 'blocked';
      }
    }

    if (typeof session._is_url_allowed === 'function') {
      try {
        return session._is_url_allowed(url) ? null : 'blocked';
      } catch {
        return 'blocked';
      }
    }

    return null;
  }

  private async _teardownCapture() {
    if (!this._cdpSession) {
      return;
    }

    for (const listener of this._listeners) {
      this._cdpSession.off?.(listener.event, listener.handler);
    }
    this._listeners = [];

    try {
      await this._cdpSession.detach?.();
    } catch {
      // Ignore CDP detach errors during shutdown.
    } finally {
      this._cdpSession = null;
      this._entries.clear();
    }
  }
}
