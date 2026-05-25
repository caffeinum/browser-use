import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { BrowserSession } from '../src/browser/session.js';
import {
  AgentFocusChangedEvent,
  BrowserConnectedEvent,
  BrowserErrorEvent,
  BrowserStopEvent,
  TabCreatedEvent,
} from '../src/browser/events.js';
import { RecordingWatchdog } from '../src/browser/watchdogs/recording-watchdog.js';

describe('recording watchdog alignment', () => {
  it('prepares recording dirs and routes trace lifecycle through BrowserSession', async () => {
    const tmpRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'browser-use-recording-watchdog-')
    );
    try {
      const session = new BrowserSession({
        profile: {
          traces_dir: path.join(tmpRoot, 'traces'),
          record_video_dir: path.join(tmpRoot, 'videos'),
        },
      });
      const watchdog = new RecordingWatchdog({ browser_session: session });
      session.attach_watchdog(watchdog);

      const startSpy = vi
        .spyOn(session, 'start_trace_recording')
        .mockResolvedValue();
      const stopSpy = vi
        .spyOn(session, 'save_trace_recording')
        .mockResolvedValue();

      await session.event_bus.dispatch_or_throw(
        new BrowserConnectedEvent({
          cdp_url: 'http://127.0.0.1:9222',
        })
      );

      expect(startSpy).toHaveBeenCalledTimes(1);
      expect(
        fs.existsSync(session.browser_profile.config.record_video_dir!)
      ).toBe(true);
      if (process.platform !== 'win32') {
        expect(
          fs.statSync(session.browser_profile.config.record_video_dir!).mode &
            0o777
        ).toBe(0o700);
      }

      await session.event_bus.dispatch_or_throw(
        new AgentFocusChangedEvent({
          target_id: 'target-1',
          url: 'https://example.com/focus',
        })
      );
      expect(startSpy).toHaveBeenCalledTimes(1);

      await session.event_bus.dispatch_or_throw(new BrowserStopEvent());
      expect(stopSpy).toHaveBeenCalledTimes(1);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('skips trace and video recording when domain policy is active', async () => {
    const tmpRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'browser-use-recording-policy-')
    );
    try {
      const session = new BrowserSession({
        profile: {
          allowed_domains: ['https://example.com'],
          traces_dir: path.join(tmpRoot, 'traces'),
          record_video_dir: path.join(tmpRoot, 'videos'),
        },
      });
      const page = {
        on: vi.fn(),
        off: vi.fn(),
        url: vi.fn(() => 'https://example.com/record'),
      } as any;
      session.browser_context = {
        pages: vi.fn(() => [page]),
      } as any;
      session.agent_current_page = page;

      const watchdog = new RecordingWatchdog({ browser_session: session });
      session.attach_watchdog(watchdog);

      const startSpy = vi.spyOn(session, 'start_trace_recording');
      const cdpSpy = vi.spyOn(session, 'get_or_create_cdp_session');

      await session.event_bus.dispatch_or_throw(
        new BrowserConnectedEvent({
          cdp_url: 'http://127.0.0.1:9222',
        })
      );
      await session.event_bus.dispatch_or_throw(
        new TabCreatedEvent({
          target_id: 'target-video',
          url: 'https://example.com/video-tab',
        })
      );

      expect(startSpy).not.toHaveBeenCalled();
      expect(cdpSpy).not.toHaveBeenCalled();
      expect(page.on).not.toHaveBeenCalledWith('close', expect.any(Function));
      expect(fs.existsSync(path.join(tmpRoot, 'videos'))).toBe(false);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('emits BrowserErrorEvent when starting trace recording fails', async () => {
    const session = new BrowserSession({
      profile: {
        traces_dir: path.join(os.tmpdir(), `browser-use-traces-${Date.now()}`),
      },
    });
    const watchdog = new RecordingWatchdog({ browser_session: session });
    session.attach_watchdog(watchdog);

    const errors: BrowserErrorEvent[] = [];
    session.event_bus.on(
      'BrowserErrorEvent',
      (event) => {
        errors.push(event as BrowserErrorEvent);
      },
      { handler_id: 'test.recording.watchdog.errors' }
    );
    vi.spyOn(session, 'start_trace_recording').mockRejectedValue(
      new Error('trace init failed')
    );

    await session.event_bus.dispatch_or_throw(
      new BrowserConnectedEvent({
        cdp_url: 'http://127.0.0.1:9222',
      })
    );

    expect(errors).toHaveLength(1);
    expect(errors[0].error_type).toBe('RecordingStartFailed');
  });

  it('emits BrowserErrorEvent when browser_context tracing start fails', async () => {
    const session = new BrowserSession({
      profile: {
        traces_dir: path.join(os.tmpdir(), `browser-use-traces-${Date.now()}`),
      },
    });
    const watchdog = new RecordingWatchdog({ browser_session: session });
    session.attach_watchdog(watchdog);

    (session as any).browser_context = {
      tracing: {
        start: vi.fn().mockRejectedValue(new Error('trace start boom')),
      },
    };

    const errors: BrowserErrorEvent[] = [];
    session.event_bus.on(
      'BrowserErrorEvent',
      (event) => {
        errors.push(event as BrowserErrorEvent);
      },
      { handler_id: 'test.recording.watchdog.context.start.errors' }
    );

    await session.event_bus.dispatch_or_throw(
      new BrowserConnectedEvent({
        cdp_url: 'http://127.0.0.1:9222',
      })
    );

    expect(errors).toHaveLength(1);
    expect(errors[0].error_type).toBe('RecordingStartFailed');
    expect(errors[0].message).toContain('trace start boom');
  });

  it('tracks Playwright video artifact paths when page closes', async () => {
    const session = new BrowserSession({
      profile: {
        record_video_dir: path.join(
          os.tmpdir(),
          `browser-use-video-${Date.now()}`
        ),
      },
    });
    const watchdog = new RecordingWatchdog({ browser_session: session });
    session.attach_watchdog(watchdog);

    const closeListeners: Array<() => void> = [];
    const page = {
      on: vi.fn((event: string, listener: () => void) => {
        if (event === 'close') {
          closeListeners.push(listener);
        }
      }),
      off: vi.fn(),
      video: vi.fn(() => ({
        path: vi.fn(async () => '/tmp/recorded-video.webm'),
      })),
    } as any;
    session.browser_context = {
      pages: vi.fn(() => [page]),
    } as any;
    session.agent_current_page = page;

    await session.event_bus.dispatch_or_throw(
      new BrowserConnectedEvent({
        cdp_url: 'http://127.0.0.1:9222',
      })
    );
    await session.event_bus.dispatch_or_throw(
      new TabCreatedEvent({
        target_id: 'target-video',
        url: 'https://example.com/video-tab',
      })
    );

    expect(closeListeners).toHaveLength(1);
    closeListeners[0]();
    await Promise.resolve();

    expect(session.get_downloaded_files()).toContain(
      '/tmp/recorded-video.webm'
    );
  });

  it('removes close listener after close callback runs', async () => {
    const session = new BrowserSession({
      profile: {
        record_video_dir: path.join(
          os.tmpdir(),
          `browser-use-video-cleanup-${Date.now()}`
        ),
      },
    });
    const watchdog = new RecordingWatchdog({ browser_session: session });
    session.attach_watchdog(watchdog);

    const closeListeners: Array<() => void> = [];
    const page = {
      on: vi.fn((event: string, listener: () => void) => {
        if (event === 'close') {
          closeListeners.push(listener);
        }
      }),
      off: vi.fn(),
      video: vi.fn(() => ({
        path: vi.fn(async () => '/tmp/recorded-video-cleanup.webm'),
      })),
    } as any;
    session.browser_context = {
      pages: vi.fn(() => [page]),
    } as any;
    session.agent_current_page = page;

    await session.event_bus.dispatch_or_throw(
      new BrowserConnectedEvent({
        cdp_url: 'http://127.0.0.1:9222',
      })
    );

    expect(closeListeners).toHaveLength(1);
    closeListeners[0]();
    await Promise.resolve();

    expect(page.off).toHaveBeenCalledWith('close', closeListeners[0]);
  });

  it('captures CDP screencast frames to artifact file and tracks it on stop', async () => {
    const tmpRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'browser-use-recording-cdp-')
    );
    try {
      const session = new BrowserSession({
        profile: {
          record_video_dir: path.join(tmpRoot, 'videos'),
        },
      });
      const page = {
        on: vi.fn(),
        off: vi.fn(),
        url: vi.fn(() => 'https://example.com/record'),
      } as any;
      session.browser_context = {
        pages: vi.fn(() => [page]),
      } as any;
      session.agent_current_page = page;

      const cdpListeners = new Map<string, (payload: any) => void>();
      const cdpSend = vi.fn(async () => ({}));
      vi.spyOn(session, 'get_or_create_cdp_session').mockResolvedValue({
        send: cdpSend,
        on: (event: string, listener: (payload: any) => void) => {
          cdpListeners.set(event, listener);
        },
        off: (event: string) => {
          cdpListeners.delete(event);
        },
      } as any);

      const watchdog = new RecordingWatchdog({ browser_session: session });
      session.attach_watchdog(watchdog);

      await session.event_bus.dispatch_or_throw(
        new BrowserConnectedEvent({
          cdp_url: 'http://127.0.0.1:9222',
        })
      );
      expect(cdpSend).toHaveBeenCalledWith('Page.startScreencast', {
        format: 'jpeg',
        quality: 85,
        everyNthFrame: 1,
      });

      cdpListeners.get('Page.screencastFrame')?.({
        data: Buffer.from('frame').toString('base64'),
        sessionId: 1,
      });

      await session.event_bus.dispatch_or_throw(new BrowserStopEvent());

      expect(cdpSend).toHaveBeenCalledWith('Page.stopScreencast');
      const artifacts = session
        .get_downloaded_files()
        .filter((entry) => entry.endsWith('.cdp-screencast.ndjson'));
      expect(artifacts.length).toBeGreaterThan(0);
      expect(fs.existsSync(artifacts[0])).toBe(true);
      if (process.platform !== 'win32') {
        expect(fs.statSync(artifacts[0]).mode & 0o777).toBe(0o600);
      }
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('saves trace recordings as private files', async () => {
    const tmpRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'browser-use-trace-private-')
    );
    try {
      const tracesDir = path.join(tmpRoot, 'traces');
      const session = new BrowserSession({
        profile: {
          traces_dir: tracesDir,
        },
      });
      session.browser_context = {
        tracing: {
          stop: vi.fn(async ({ path: tracePath }: { path: string }) => {
            fs.writeFileSync(tracePath, 'trace-data');
          }),
        },
      } as any;

      await session.save_trace_recording();

      const [traceFile] = fs.readdirSync(tracesDir);
      const tracePath = path.join(tracesDir, traceFile);
      expect(tracePath).toMatch(/BrowserSession_.*\.zip$/);
      if (process.platform !== 'win32') {
        expect(fs.statSync(tracesDir).mode & 0o777).toBe(0o700);
        expect(fs.statSync(tracePath).mode & 0o777).toBe(0o600);
      }
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
