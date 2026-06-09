import fs from 'node:fs';
import path from 'node:path';
import {
  AgentFocusChangedEvent,
  BrowserConnectedEvent,
  BrowserErrorEvent,
  BrowserStopEvent,
  BrowserStoppedEvent,
  TabCreatedEvent,
} from '../events.js';
import { BaseWatchdog } from './base.js';

type CDPSessionLike = {
  send?: (method: string, params?: Record<string, unknown>) => Promise<any>;
  on?: (event: string, listener: (payload: any) => void) => void;
  off?: (event: string, listener: (payload: any) => void) => void;
};

type PageLike = {
  on?: (event: string, listener: () => void) => void;
  off?: (event: string, listener: () => void) => void;
  removeListener?: (event: string, listener: () => void) => void;
  video?: () => { path?: () => Promise<string> } | null;
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

export class RecordingWatchdog extends BaseWatchdog {
  static override LISTENS_TO = [
    BrowserConnectedEvent,
    BrowserStopEvent,
    BrowserStoppedEvent,
    AgentFocusChangedEvent,
    TabCreatedEvent,
  ];

  private _traceStarted = false;
  private _videoCloseListeners = new Map<PageLike, () => void>();
  private _cdpScreencastSession: CDPSessionLike | null = null;
  private _cdpScreencastHandler: ((payload: any) => void) | null = null;
  private _cdpScreencastPath: string | null = null;
  private _cdpScreencastStream: fs.WriteStream | null = null;
  private _warnedDomainPolicyRecordingDisabled = false;

  async on_BrowserConnectedEvent() {
    if (this._recordingDisabledByDomainPolicy()) {
      return;
    }
    this._prepareVideoDirectory();
    this._attachVideoListenersToKnownPages();
    await this._startCdpScreencastIfConfigured();
    await this._startTracingIfConfigured();
  }

  async on_BrowserStopEvent() {
    await this._stopCdpScreencastIfStarted();
    await this._stopTracingIfStarted();
  }

  async on_BrowserStoppedEvent() {
    this._detachVideoListeners();
  }

  async on_AgentFocusChangedEvent(event: AgentFocusChangedEvent) {
    if (this._recordingDisabledByDomainPolicy()) {
      return;
    }
    this._attachVideoListenersToKnownPages();
    await this._startCdpScreencastIfConfigured();
    if (!this._traceStarted) {
      return;
    }
    this.browser_session.logger.debug(
      `[RecordingWatchdog] Focus changed to ${event.target_id}; tracing remains active`
    );
  }

  async on_TabCreatedEvent() {
    if (this._recordingDisabledByDomainPolicy()) {
      return;
    }
    this._attachVideoListenersToKnownPages();
    await this._startCdpScreencastIfConfigured();
  }

  protected override onDetached() {
    void this._stopCdpScreencastIfStarted();
    this._detachVideoListeners();
  }

  private _recordingDisabledByDomainPolicy() {
    const hasRestrictions =
      typeof (this.browser_session as any)._has_url_access_restrictions ===
      'function'
        ? (this.browser_session as any)._has_url_access_restrictions()
        : false;
    if (!hasRestrictions) {
      return false;
    }

    const hasRecordingConfigured = Boolean(
      this.browser_session.browser_profile.traces_dir ||
      this.browser_session.browser_profile.config.record_video_dir
    );
    if (!hasRecordingConfigured) {
      return false;
    }

    if (!this._warnedDomainPolicyRecordingDisabled) {
      this.browser_session.logger.warning(
        '[RecordingWatchdog] Skipping trace/video recording because domain restrictions are active and recording artifacts cannot be URL-filtered.'
      );
      this._warnedDomainPolicyRecordingDisabled = true;
    }
    return true;
  }

  private _prepareVideoDirectory() {
    const configuredPath =
      this.browser_session.browser_profile.config.record_video_dir;
    if (typeof configuredPath !== 'string' || configuredPath.trim() === '') {
      return;
    }
    const resolvedPath = path.resolve(configuredPath);
    ensurePrivateDirectoryIfCreated(resolvedPath);
    this.browser_session.browser_profile.config.record_video_dir = resolvedPath;
  }

  private async _startTracingIfConfigured() {
    if (
      this._traceStarted ||
      !this.browser_session.browser_profile.traces_dir
    ) {
      return;
    }
    try {
      await this.browser_session.start_trace_recording();
      this._traceStarted = true;
    } catch (error) {
      await this.event_bus.dispatch(
        new BrowserErrorEvent({
          error_type: 'RecordingStartFailed',
          message: `Failed to start trace recording: ${(error as Error).message}`,
          details: {
            traces_dir: this.browser_session.browser_profile.traces_dir,
          },
        })
      );
    }
  }

  private async _stopTracingIfStarted() {
    if (!this._traceStarted) {
      return;
    }
    try {
      await this.browser_session.save_trace_recording();
    } catch (error) {
      await this.event_bus.dispatch(
        new BrowserErrorEvent({
          error_type: 'RecordingStopFailed',
          message: `Failed to save trace recording: ${(error as Error).message}`,
          details: {
            traces_dir: this.browser_session.browser_profile.traces_dir,
          },
        })
      );
    } finally {
      this._traceStarted = false;
    }
  }

  private _attachVideoListenersToKnownPages() {
    const configuredPath =
      this.browser_session.browser_profile.config.record_video_dir;
    if (typeof configuredPath !== 'string' || configuredPath.trim() === '') {
      return;
    }

    for (const page of this._getKnownPages()) {
      this._attachVideoListener(page);
    }
  }

  private _attachVideoListener(page: PageLike) {
    if (this._videoCloseListeners.has(page) || typeof page?.on !== 'function') {
      return;
    }

    const listener = () => {
      this._videoCloseListeners.delete(page);
      if (typeof page.off === 'function') {
        page.off('close', listener);
      } else if (typeof page.removeListener === 'function') {
        page.removeListener('close', listener);
      }
      void this._captureVideoArtifact(page);
    };
    page.on('close', listener);
    this._videoCloseListeners.set(page, listener);
  }

  private _detachVideoListeners() {
    for (const [page, listener] of [...this._videoCloseListeners.entries()]) {
      if (typeof page.off === 'function') {
        page.off('close', listener);
      } else if (typeof page.removeListener === 'function') {
        page.removeListener('close', listener);
      }
    }
    this._videoCloseListeners.clear();
  }

  private _getKnownPages(): PageLike[] {
    const pagesFromContext =
      typeof this.browser_session.browser_context?.pages === 'function'
        ? (this.browser_session.browser_context.pages() as PageLike[])
        : [];
    const activePage = this.browser_session
      .agent_current_page as PageLike | null;
    if (!activePage) {
      return pagesFromContext;
    }
    if (pagesFromContext.includes(activePage)) {
      return pagesFromContext;
    }
    return [...pagesFromContext, activePage];
  }

  private async _captureVideoArtifact(page: PageLike) {
    try {
      const video = typeof page.video === 'function' ? page.video() : null;
      const videoPath = await video?.path?.();
      if (typeof videoPath === 'string' && videoPath.length > 0) {
        this.browser_session.add_downloaded_file(videoPath);
      }
    } catch (error) {
      this.browser_session.logger.debug(
        `[RecordingWatchdog] Failed to capture video artifact: ${(error as Error).message}`
      );
    }
  }

  private async _startCdpScreencastIfConfigured() {
    const configuredPath =
      this.browser_session.browser_profile.config.record_video_dir;
    if (typeof configuredPath !== 'string' || configuredPath.trim() === '') {
      return;
    }
    if (this._cdpScreencastSession || this._cdpScreencastStream) {
      return;
    }

    try {
      const page = await this.browser_session.get_current_page();
      if (!page) {
        return;
      }

      const session = (await this.browser_session.get_or_create_cdp_session(
        page
      )) as CDPSessionLike;

      const filePath = path.join(
        configuredPath,
        `${Date.now()}-${this.browser_session.id.slice(-6)}.cdp-screencast.ndjson`
      );
      const stream = fs.createWriteStream(filePath, {
        flags: 'a',
        mode: 0o600,
      });
      stream.on('error', (error) => {
        this.browser_session.logger.warning(
          `[RecordingWatchdog] CDP screencast stream error: ${error.message}`
        );
      });
      chmodPrivatePath(filePath, 0o600);

      const handler = (payload: any) => {
        const frameData = typeof payload?.data === 'string' ? payload.data : '';
        if (frameData && this._cdpScreencastStream) {
          this._cdpScreencastStream.write(
            `${JSON.stringify({
              ts: Date.now(),
              session_id:
                typeof payload?.sessionId === 'number' ||
                typeof payload?.sessionId === 'string'
                  ? payload.sessionId
                  : null,
              data: frameData,
            })}\n`
          );
        }

        const sessionId =
          typeof payload?.sessionId === 'number' ||
          typeof payload?.sessionId === 'string'
            ? payload.sessionId
            : null;
        if (!sessionId) {
          return;
        }
        void session.send?.('Page.screencastFrameAck', {
          sessionId,
        });
      };

      await session.send?.('Page.enable');
      session.on?.('Page.screencastFrame', handler);
      await session.send?.('Page.startScreencast', {
        format: 'jpeg',
        quality: 85,
        everyNthFrame: 1,
      });

      this._cdpScreencastSession = session;
      this._cdpScreencastHandler = handler;
      this._cdpScreencastPath = filePath;
      this._cdpScreencastStream = stream;
    } catch (error) {
      await this.event_bus.dispatch(
        new BrowserErrorEvent({
          error_type: 'RecordingCdpStartFailed',
          message: `Failed to start CDP screencast recording: ${(error as Error).message}`,
          details: {
            record_video_dir:
              this.browser_session.browser_profile.config.record_video_dir,
          },
        })
      );
      await this._stopCdpScreencastIfStarted();
    }
  }

  private async _stopCdpScreencastIfStarted() {
    if (!this._cdpScreencastSession) {
      return;
    }

    try {
      await this._cdpScreencastSession.send?.('Page.stopScreencast');
    } catch {
      // Ignore stop errors.
    }

    if (this._cdpScreencastHandler) {
      this._cdpScreencastSession.off?.(
        'Page.screencastFrame',
        this._cdpScreencastHandler
      );
    }

    if (this._cdpScreencastStream) {
      await new Promise<void>((resolve) => {
        this._cdpScreencastStream?.end(() => resolve());
      });
    }

    if (
      this._cdpScreencastPath &&
      fs.existsSync(this._cdpScreencastPath) &&
      fs.statSync(this._cdpScreencastPath).size > 0
    ) {
      chmodPrivatePath(this._cdpScreencastPath, 0o600);
      this.browser_session.add_downloaded_file(this._cdpScreencastPath);
    }

    this._cdpScreencastSession = null;
    this._cdpScreencastHandler = null;
    this._cdpScreencastPath = null;
    this._cdpScreencastStream = null;
  }
}
