import { describe, expect, it, vi } from 'vitest';
import { BrowserProfile } from '../src/browser/profile.js';
import { BrowserSession } from '../src/browser/session.js';
import {
  BrowserConnectedEvent,
  BrowserStoppedEvent,
} from '../src/browser/events.js';
import { CaptchaWatchdog } from '../src/browser/watchdogs/captcha-watchdog.js';

describe('captcha watchdog alignment', () => {
  it('waits for BrowserUse captcha solver events before continuing', async () => {
    const session = new BrowserSession({
      browser_profile: new BrowserProfile({
        captcha_solver: true,
      }),
    });
    const watchdog = new CaptchaWatchdog({ browser_session: session });
    session.attach_watchdog(watchdog);

    const listeners = new Map<string, (payload: any) => void>();
    vi.spyOn(session, 'get_current_page').mockResolvedValue({
      url: () => 'https://example.com/captcha',
    } as any);
    vi.spyOn(session, 'get_or_create_cdp_session').mockResolvedValue({
      on: vi.fn((event: string, handler: (payload: any) => void) => {
        listeners.set(event, handler);
      }),
      off: vi.fn((event: string) => {
        listeners.delete(event);
      }),
      detach: vi.fn(async () => {}),
    } as any);

    await session.event_bus.dispatch_or_throw(
      new BrowserConnectedEvent({ cdp_url: 'ws://localhost:9222/devtools' })
    );

    listeners.get('BrowserUse.captchaSolverStarted')?.({
      vendor: 'cloudflare',
      url: 'https://example.com/captcha',
      targetId: 'page-target',
      startedAt: 1,
    });

    const waitPromise = session.wait_if_captcha_solving(1);
    Promise.resolve().then(() => {
      listeners.get('BrowserUse.captchaSolverFinished')?.({
        vendor: 'cloudflare',
        url: 'https://example.com/captcha',
        targetId: 'page-target',
        finishedAt: 2,
        durationMs: 900,
        success: true,
      });
    });

    await expect(waitPromise).resolves.toMatchObject({
      waited: true,
      vendor: 'cloudflare',
      url: 'https://example.com/captcha',
      duration_ms: 900,
      result: 'success',
    });
  });

  it('clears captcha wait state when the browser stops', async () => {
    const session = new BrowserSession({
      browser_profile: new BrowserProfile({
        captcha_solver: true,
      }),
    });
    const watchdog = new CaptchaWatchdog({ browser_session: session });
    session.attach_watchdog(watchdog);

    vi.spyOn(session, 'get_current_page').mockResolvedValue({
      url: () => 'https://example.com/captcha',
    } as any);
    const listeners = new Map<string, (payload: any) => void>();
    vi.spyOn(session, 'get_or_create_cdp_session').mockResolvedValue({
      on: vi.fn((event: string, handler: (payload: any) => void) => {
        listeners.set(event, handler);
      }),
      off: vi.fn((event: string) => {
        listeners.delete(event);
      }),
      detach: vi.fn(async () => {}),
    } as any);

    await session.event_bus.dispatch_or_throw(
      new BrowserConnectedEvent({ cdp_url: 'ws://localhost:9222/devtools' })
    );
    listeners.get('BrowserUse.captchaSolverStarted')?.({
      vendor: 'cloudflare',
      url: 'https://example.com/captcha',
      targetId: 'page-target',
      startedAt: 1,
    });

    const waitPromise = session.wait_if_captcha_solving(1);
    await session.event_bus.dispatch_or_throw(
      new BrowserStoppedEvent({ reason: 'shutdown' })
    );

    await expect(waitPromise).resolves.toMatchObject({
      waited: true,
    });
  });
});
