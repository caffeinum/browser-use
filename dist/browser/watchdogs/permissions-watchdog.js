import { BrowserConnectedEvent, BrowserErrorEvent } from '../events.js';
import { BaseWatchdog } from './base.js';
export class PermissionsWatchdog extends BaseWatchdog {
    static LISTENS_TO = [BrowserConnectedEvent];
    static EMITS = [BrowserErrorEvent];
    async on_BrowserConnectedEvent() {
        const permissions = this.browser_session.browser_profile.config.permissions;
        if (!Array.isArray(permissions) || permissions.length === 0) {
            return;
        }
        let cdpError = null;
        try {
            const grantedWithCdp = await this._grantPermissionsViaCdp(permissions);
            if (grantedWithCdp) {
                return;
            }
        }
        catch (error) {
            cdpError = error;
        }
        const context = this.browser_session.browser_context;
        if (!context?.grantPermissions) {
            if (!cdpError) {
                return;
            }
            await this.event_bus.dispatch(new BrowserErrorEvent({
                error_type: 'PermissionsWatchdogError',
                message: cdpError.message || 'Failed to grant permissions via CDP',
                details: {
                    permissions,
                    mode: 'cdp',
                },
            }));
            return;
        }
        try {
            await context.grantPermissions(permissions);
        }
        catch (error) {
            const message = error.message ?? 'Failed to grant permissions';
            await this.event_bus.dispatch(new BrowserErrorEvent({
                error_type: 'PermissionsWatchdogError',
                message,
                details: {
                    permissions,
                    cdp_error: cdpError?.message ?? null,
                    mode: 'playwright',
                },
            }));
        }
    }
    async _grantPermissionsViaCdp(permissions) {
        const browser = this.browser_session.browser;
        if (!browser?.newBrowserCDPSession) {
            return false;
        }
        const cdpSession = await browser.newBrowserCDPSession();
        try {
            await cdpSession.send?.('Browser.grantPermissions', {
                permissions,
            });
            return true;
        }
        finally {
            try {
                await cdpSession.detach?.();
            }
            catch {
                // Ignore detach failures.
            }
        }
    }
}
