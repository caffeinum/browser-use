import { ScreenshotEvent } from '../events.js';
import { BaseWatchdog } from './base.js';

export class ScreenshotWatchdog extends BaseWatchdog {
  static override LISTENS_TO = [ScreenshotEvent];

  async on_ScreenshotEvent(event: ScreenshotEvent) {
    try {
      await this.browser_session.remove_highlights();
    } catch {
      // Highlight cleanup is best-effort and should not block screenshots.
    }

    return await this.browser_session.take_screenshot(
      event.full_page,
      event.clip
    );
  }
}
