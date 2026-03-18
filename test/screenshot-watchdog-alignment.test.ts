import { describe, expect, it, vi } from 'vitest';
import { BrowserSession } from '../src/browser/session.js';
import { ScreenshotEvent } from '../src/browser/events.js';
import { ScreenshotWatchdog } from '../src/browser/watchdogs/screenshot-watchdog.js';

describe('screenshot watchdog alignment', () => {
  it('removes highlights before forwarding screenshot clip options', async () => {
    const session = new BrowserSession();
    const watchdog = new ScreenshotWatchdog({ browser_session: session });
    session.attach_watchdog(watchdog);

    const screenshotSpy = vi
      .spyOn(session, 'take_screenshot')
      .mockResolvedValue('base64-image-data');
    const removeHighlightsSpy = vi
      .spyOn(session, 'remove_highlights')
      .mockResolvedValue();

    const result = await session.event_bus.dispatch_or_throw(
      new ScreenshotEvent({
        full_page: true,
        clip: { x: 1, y: 2, width: 3, height: 4 },
      })
    );

    expect(removeHighlightsSpy).toHaveBeenCalledTimes(1);
    expect(screenshotSpy).toHaveBeenCalledWith(true, {
      x: 1,
      y: 2,
      width: 3,
      height: 4,
    });
    expect(removeHighlightsSpy.mock.invocationCallOrder[0]).toBeLessThan(
      screenshotSpy.mock.invocationCallOrder[0]
    );
    expect(result.event.event_result).toBe('base64-image-data');
  });

  it('continues screenshot capture when highlight cleanup fails', async () => {
    const session = new BrowserSession();
    const watchdog = new ScreenshotWatchdog({ browser_session: session });
    session.attach_watchdog(watchdog);

    const removeHighlightsSpy = vi
      .spyOn(session, 'remove_highlights')
      .mockRejectedValue(new Error('cleanup failed'));
    const screenshotSpy = vi
      .spyOn(session, 'take_screenshot')
      .mockResolvedValue('base64-image-data');

    const result = await session.event_bus.dispatch_or_throw(
      new ScreenshotEvent({ full_page: false })
    );

    expect(removeHighlightsSpy).toHaveBeenCalledTimes(1);
    expect(screenshotSpy).toHaveBeenCalledWith(false, null);
    expect(result.event.event_result).toBe('base64-image-data');
  });
});
