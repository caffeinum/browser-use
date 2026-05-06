import { BrowserErrorEvent, BrowserStateRequestEvent, TabCreatedEvent, } from '../events.js';
import { BaseWatchdog } from './base.js';
export class DOMWatchdog extends BaseWatchdog {
    static LISTENS_TO = [TabCreatedEvent, BrowserStateRequestEvent];
    static EMITS = [BrowserErrorEvent];
    async on_TabCreatedEvent() {
        // Placeholder hook kept for parity with Python watchdog lifecycle.
        return null;
    }
    async on_BrowserStateRequestEvent(event) {
        try {
            return await this.browser_session.get_browser_state_with_recovery({
                cache_clickable_elements_hashes: true,
                include_screenshot: event.include_screenshot,
                include_recent_events: event.include_recent_events,
            });
        }
        catch (error) {
            await this.event_bus.dispatch(new BrowserErrorEvent({
                error_type: 'BrowserStateRequestFailed',
                message: `DOM state request failed: ${error.message}`,
                details: {
                    include_screenshot: event.include_screenshot,
                    include_recent_events: event.include_recent_events,
                },
                event_parent_id: event.event_id,
            }));
            throw error;
        }
    }
}
