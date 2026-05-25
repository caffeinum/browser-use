import { describe, expect, it, vi } from 'vitest';
import { BrowserSession } from '../src/browser/session.js';
import {
  BrowserErrorEvent,
  NavigateToUrlEvent,
  NavigationCompleteEvent,
  TabCreatedEvent,
} from '../src/browser/events.js';
import { SecurityWatchdog } from '../src/browser/watchdogs/security-watchdog.js';

describe('security watchdog alignment', () => {
  it('blocks disallowed NavigateToUrlEvent and emits BrowserErrorEvent', async () => {
    const session = new BrowserSession({
      profile: {
        allowed_domains: ['example.com'],
      },
    });
    const watchdog = new SecurityWatchdog({ browser_session: session });
    session.attach_watchdog(watchdog);

    const errors: BrowserErrorEvent[] = [];
    session.event_bus.on(
      'BrowserErrorEvent',
      (event) => {
        errors.push(event as BrowserErrorEvent);
      },
      { handler_id: 'test.security.navigate.errors' }
    );

    await expect(
      session.event_bus.dispatch_or_throw(
        new NavigateToUrlEvent({
          url: 'https://evil.test/path?token=secret#fragment',
        })
      )
    ).rejects.toThrow(/Event NavigateToUrlEvent/);

    expect(errors).toHaveLength(1);
    expect(errors[0].error_type).toBe('NavigationBlocked');
    expect(errors[0].message).not.toContain('secret');
    expect(errors[0].details.url).toBe(
      'https://evil.test/path?<redacted>#<redacted>'
    );
  });

  it('reacts to disallowed NavigationCompleteEvent and redirects to about:blank', async () => {
    const session = new BrowserSession({
      profile: {
        allowed_domains: ['example.com'],
      },
    });
    const watchdog = new SecurityWatchdog({ browser_session: session });
    session.attach_watchdog(watchdog);
    (session as any)._tabs = [
      {
        page_id: 0,
        tab_id: 'tab-active',
        target_id: 'target-1',
        url: 'https://example.com/current',
        title: 'Current',
      },
    ];
    (session as any).currentTabIndex = 0;

    const navigateSpy = vi
      .spyOn(session, 'navigate_to')
      .mockResolvedValue(null as any);
    const errors: BrowserErrorEvent[] = [];
    session.event_bus.on(
      'BrowserErrorEvent',
      (event) => {
        errors.push(event as BrowserErrorEvent);
      },
      { handler_id: 'test.security.complete.errors' }
    );

    await session.event_bus.dispatch_or_throw(
      new NavigationCompleteEvent({
        target_id: 'target-1',
        url: 'https://evil.test/redirected',
        status: 200,
        error_message: null,
        loading_status: 'complete',
      })
    );

    expect(navigateSpy).toHaveBeenCalledWith('about:blank');
    expect(errors).toHaveLength(1);
    expect(errors[0].error_type).toBe('NavigationBlocked');
  });

  it('closes non-active tabs that navigate to disallowed URLs', async () => {
    const session = new BrowserSession({
      profile: {
        allowed_domains: ['example.com'],
      },
    });
    const watchdog = new SecurityWatchdog({ browser_session: session });
    session.attach_watchdog(watchdog);
    (session as any)._tabs = [
      {
        page_id: 0,
        tab_id: 'tab-active',
        target_id: 'target-active',
        url: 'https://example.com/current',
        title: 'Current',
      },
    ];
    (session as any).currentTabIndex = 0;

    const navigateSpy = vi
      .spyOn(session, 'navigate_to')
      .mockResolvedValue(null as any);
    const closeRequests: Array<{ target_id: string | null }> = [];
    session.event_bus.on(
      'CloseTabEvent',
      (event: any) => {
        closeRequests.push({ target_id: event.target_id ?? null });
      },
      { handler_id: 'test.security.complete.close-background' }
    );

    await session.event_bus.dispatch_or_throw(
      new NavigationCompleteEvent({
        target_id: 'target-background',
        url: 'https://evil.test/background',
        status: 200,
        error_message: null,
        loading_status: 'complete',
      })
    );

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(closeRequests).toEqual([{ target_id: 'target-background' }]);
  });

  it('reacts to disallowed TabCreatedEvent by requesting tab close', async () => {
    const session = new BrowserSession({
      profile: {
        allowed_domains: ['example.com'],
      },
    });
    const watchdog = new SecurityWatchdog({ browser_session: session });
    session.attach_watchdog(watchdog);

    const closeRequests: Array<{ target_id: string | null }> = [];
    session.event_bus.on(
      'CloseTabEvent',
      (event: any) => {
        closeRequests.push({ target_id: event.target_id ?? null });
      },
      { handler_id: 'test.security.tab.close' }
    );

    await session.event_bus.dispatch_or_throw(
      new TabCreatedEvent({
        target_id: 'target-blocked-tab',
        url: 'https://evil.test/new-tab',
      })
    );

    expect(closeRequests).toHaveLength(1);
    expect(closeRequests[0].target_id).toBe('target-blocked-tab');
  });
});
