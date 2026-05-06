import { BrowserKillEvent, BrowserLaunchEvent, BrowserStopEvent, } from '../events.js';
import { BaseWatchdog } from './base.js';
export class LocalBrowserWatchdog extends BaseWatchdog {
    static LISTENS_TO = [
        BrowserLaunchEvent,
        BrowserKillEvent,
        BrowserStopEvent,
    ];
    async on_BrowserLaunchEvent() {
        await this.browser_session.start();
        return {
            cdp_url: this.browser_session.cdp_url ??
                this.browser_session.wss_url ??
                'playwright',
        };
    }
    async on_BrowserKillEvent() {
        if (this.browser_session.is_stopping) {
            return;
        }
        await this.browser_session.kill();
    }
    on_BrowserStopEvent() {
        if (!this.browser_session._owns_browser_resources) {
            return;
        }
        // Fire-and-forget to avoid blocking BrowserStopEvent handler completion.
        void this.event_bus.dispatch(new BrowserKillEvent()).catch(() => {
            // Ignore shutdown re-entrancy errors during stop lifecycle.
        });
    }
}
