import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { BrowserSession } from '../src/browser/session.js';
import {
  BrowserConnectedEvent,
  BrowserErrorEvent,
  BrowserStartEvent,
  BrowserStopEvent,
  BrowserStoppedEvent,
} from '../src/browser/events.js';
import { HarRecordingWatchdog } from '../src/browser/watchdogs/har-recording-watchdog.js';

describe('har recording watchdog alignment', () => {
  it('normalizes record_har_path on BrowserStartEvent and creates parent dir', async () => {
    const tmpRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'browser-use-har-watchdog-')
    );
    try {
      const absoluteHarPath = path.join(tmpRoot, 'nested', 'session.har');
      const relativeHarPath = path.relative(process.cwd(), absoluteHarPath);

      const session = new BrowserSession({
        profile: {
          record_har_path: relativeHarPath,
        },
      });
      const watchdog = new HarRecordingWatchdog({ browser_session: session });
      session.attach_watchdog(watchdog);

      await session.event_bus.dispatch_or_throw(new BrowserStartEvent());

      expect(session.browser_profile.config.record_har_path).toBe(
        absoluteHarPath
      );
      expect(fs.existsSync(path.dirname(absoluteHarPath))).toBe(true);
      if (process.platform !== 'win32') {
        expect(fs.statSync(path.dirname(absoluteHarPath)).mode & 0o777).toBe(
          0o700
        );
      }
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('emits BrowserErrorEvent when HAR file is missing after BrowserStoppedEvent', async () => {
    const tmpRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'browser-use-har-watchdog-missing-')
    );
    try {
      const harPath = path.join(tmpRoot, 'missing.har');
      const session = new BrowserSession({
        profile: {
          record_har_path: harPath,
        },
      });
      const watchdog = new HarRecordingWatchdog({ browser_session: session });
      session.attach_watchdog(watchdog);

      const errors: BrowserErrorEvent[] = [];
      session.event_bus.on(
        'BrowserErrorEvent',
        (event) => {
          errors.push(event as BrowserErrorEvent);
        },
        { handler_id: 'test.har.watchdog.missing.errors' }
      );

      await session.event_bus.dispatch_or_throw(new BrowserStartEvent());
      await session.event_bus.dispatch_or_throw(new BrowserStoppedEvent());

      expect(errors).toHaveLength(1);
      expect(errors[0].error_type).toBe('HarRecordingMissing');
      expect(errors[0].details.record_har_path).toBe(harPath);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('does not emit error when HAR file exists and has content', async () => {
    const tmpRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'browser-use-har-watchdog-present-')
    );
    try {
      const harPath = path.join(tmpRoot, 'present.har');
      const session = new BrowserSession({
        profile: {
          record_har_path: harPath,
        },
      });
      const watchdog = new HarRecordingWatchdog({ browser_session: session });
      session.attach_watchdog(watchdog);

      const errors: BrowserErrorEvent[] = [];
      session.event_bus.on(
        'BrowserErrorEvent',
        (event) => {
          errors.push(event as BrowserErrorEvent);
        },
        { handler_id: 'test.har.watchdog.present.errors' }
      );

      await session.event_bus.dispatch_or_throw(new BrowserStartEvent());
      fs.writeFileSync(harPath, '{"log":{"version":"1.2"}}');
      await session.event_bus.dispatch_or_throw(new BrowserStoppedEvent());

      expect(errors).toHaveLength(0);
      if (process.platform !== 'win32') {
        expect(fs.statSync(harPath).mode & 0o777).toBe(0o600);
      }
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('writes HAR fallback from CDP network events when file is missing on stop', async () => {
    const tmpRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'browser-use-har-watchdog-fallback-')
    );
    try {
      const harPath = path.join(tmpRoot, 'fallback.har');
      const session = new BrowserSession({
        profile: {
          record_har_path: harPath,
        },
      });
      const watchdog = new HarRecordingWatchdog({ browser_session: session });
      session.attach_watchdog(watchdog);

      const listeners: Record<string, (payload: any) => void> = {};
      const cdpSession = {
        send: vi.fn(async () => ({})),
        on: vi.fn((event: string, handler: (payload: any) => void) => {
          listeners[event] = handler;
        }),
        off: vi.fn(),
        detach: vi.fn(async () => {}),
      };
      vi.spyOn(session, 'get_or_create_cdp_session').mockResolvedValue(
        cdpSession as any
      );

      await session.event_bus.dispatch_or_throw(new BrowserStartEvent());
      await session.event_bus.dispatch_or_throw(
        new BrowserConnectedEvent({
          cdp_url: 'http://127.0.0.1:9222',
        })
      );

      listeners['Network.requestWillBeSent']?.({
        requestId: 'request-1',
        timestamp: 1,
        wallTime: 1_700_000_000,
        request: {
          url: 'https://example.com/data.json',
          method: 'GET',
          headers: {
            accept: 'application/json',
          },
        },
      });
      listeners['Network.responseReceived']?.({
        requestId: 'request-1',
        timestamp: 1.05,
        response: {
          status: 200,
          statusText: 'OK',
          headers: {
            'content-type': 'application/json',
          },
          mimeType: 'application/json',
        },
      });
      listeners['Network.loadingFinished']?.({
        requestId: 'request-1',
        timestamp: 1.2,
        encodedDataLength: 123,
      });

      await session.event_bus.dispatch_or_throw(new BrowserStopEvent());

      expect(fs.existsSync(harPath)).toBe(true);
      const har = JSON.parse(fs.readFileSync(harPath, 'utf-8'));
      expect(cdpSession.send).toHaveBeenCalledWith('Network.enable');
      expect(har.log.entries).toHaveLength(1);
      expect(har.log.entries[0].request.url).toBe(
        'https://example.com/data.json'
      );
      if (process.platform !== 'win32') {
        expect(fs.statSync(harPath).mode & 0o777).toBe(0o600);
      }

      await session.event_bus.dispatch_or_throw(new BrowserStoppedEvent());
      expect(cdpSession.off).toHaveBeenCalled();
      expect(cdpSession.detach).toHaveBeenCalledTimes(1);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('writes an empty HAR fallback on BrowserStopEvent without network entries', async () => {
    const tmpRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'browser-use-har-watchdog-empty-fallback-')
    );
    try {
      const harPath = path.join(tmpRoot, 'empty-fallback.har');
      const session = new BrowserSession({
        profile: {
          record_har_path: harPath,
        },
      });
      const watchdog = new HarRecordingWatchdog({ browser_session: session });
      session.attach_watchdog(watchdog);

      const errors: BrowserErrorEvent[] = [];
      session.event_bus.on(
        'BrowserErrorEvent',
        (event) => {
          errors.push(event as BrowserErrorEvent);
        },
        { handler_id: 'test.har.watchdog.empty-fallback.errors' }
      );

      await session.event_bus.dispatch_or_throw(new BrowserStartEvent());
      await session.event_bus.dispatch_or_throw(new BrowserStopEvent());
      await session.event_bus.dispatch_or_throw(new BrowserStoppedEvent());

      expect(fs.existsSync(harPath)).toBe(true);
      const har = JSON.parse(fs.readFileSync(harPath, 'utf-8'));
      expect(har.log.version).toBe('1.2');
      expect(Array.isArray(har.log.entries)).toBe(true);
      expect(har.log.entries).toHaveLength(0);
      expect(errors).toHaveLength(0);
      if (process.platform !== 'win32') {
        expect(fs.statSync(harPath).mode & 0o777).toBe(0o600);
      }
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
