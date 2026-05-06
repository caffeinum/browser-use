import { ScreenshotEvent } from '../events.js';
import { BaseWatchdog } from './base.js';
export declare class ScreenshotWatchdog extends BaseWatchdog {
    static LISTENS_TO: (typeof ScreenshotEvent)[];
    on_ScreenshotEvent(event: ScreenshotEvent): Promise<string | null>;
}
