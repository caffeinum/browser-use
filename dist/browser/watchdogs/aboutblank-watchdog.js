import { AboutBlankDVDScreensaverShownEvent, BrowserStopEvent, BrowserStoppedEvent, NavigateToUrlEvent, TabClosedEvent, TabCreatedEvent, } from '../events.js';
import { BaseWatchdog } from './base.js';
export class AboutBlankWatchdog extends BaseWatchdog {
    static LISTENS_TO = [
        BrowserStopEvent,
        BrowserStoppedEvent,
        TabClosedEvent,
        TabCreatedEvent,
    ];
    static EMITS = [
        NavigateToUrlEvent,
        AboutBlankDVDScreensaverShownEvent,
    ];
    _stopping = false;
    async on_BrowserStopEvent() {
        this._stopping = true;
    }
    async on_BrowserStoppedEvent() {
        this._stopping = true;
    }
    async on_TabClosedEvent() {
        if (this._stopping) {
            return;
        }
        if (this.browser_session.tabs.length > 0) {
            return;
        }
        await this.event_bus.dispatch(new NavigateToUrlEvent({
            url: 'about:blank',
            new_tab: true,
        }));
    }
    async on_TabCreatedEvent(event) {
        if (this._stopping) {
            return;
        }
        if (event.url !== 'about:blank') {
            return;
        }
        let injectionError = null;
        try {
            await this._injectDvdScreensaverOverlay();
        }
        catch (error) {
            injectionError =
                error.message || 'DVD overlay injection failed';
        }
        await this.event_bus.dispatch(new AboutBlankDVDScreensaverShownEvent({
            target_id: event.target_id,
            error: injectionError,
        }));
    }
    async _injectDvdScreensaverOverlay() {
        const page = await this.browser_session.get_current_page();
        if (!page?.evaluate || !page.url) {
            return;
        }
        const currentUrl = page.url();
        if (currentUrl !== 'about:blank') {
            return;
        }
        await page.evaluate(() => {
            if (window.__dvdAnimationRunning) {
                return;
            }
            window.__dvdAnimationRunning = true;
            const existing = document.getElementById('pretty-loading-animation');
            if (existing) {
                return;
            }
            const ensureBody = () => {
                if (!document.body) {
                    return false;
                }
                const overlay = document.createElement('div');
                overlay.id = 'pretty-loading-animation';
                overlay.style.position = 'fixed';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.width = '100vw';
                overlay.style.height = '100vh';
                overlay.style.background = '#000';
                overlay.style.zIndex = '99999';
                overlay.style.overflow = 'hidden';
                const img = document.createElement('img');
                img.src = 'https://cf.browser-use.com/logo.svg';
                img.alt = 'Browser-Use';
                img.style.width = '180px';
                img.style.height = 'auto';
                img.style.position = 'absolute';
                img.style.left = '0px';
                img.style.top = '0px';
                img.style.opacity = '0.85';
                overlay.appendChild(img);
                document.body.appendChild(overlay);
                let x = Math.random() * Math.max(20, window.innerWidth - 200);
                let y = Math.random() * Math.max(20, window.innerHeight - 120);
                let dx = 1.4;
                let dy = 1.2;
                const animate = () => {
                    if (!document.getElementById('pretty-loading-animation')) {
                        window.__dvdAnimationRunning = false;
                        return;
                    }
                    const imgWidth = img.offsetWidth || 180;
                    const imgHeight = img.offsetHeight || 80;
                    x += dx;
                    y += dy;
                    if (x <= 0 || x + imgWidth >= window.innerWidth) {
                        dx = -dx;
                        x = Math.max(0, Math.min(x, window.innerWidth - imgWidth));
                    }
                    if (y <= 0 || y + imgHeight >= window.innerHeight) {
                        dy = -dy;
                        y = Math.max(0, Math.min(y, window.innerHeight - imgHeight));
                    }
                    img.style.left = `${x}px`;
                    img.style.top = `${y}px`;
                    requestAnimationFrame(animate);
                };
                requestAnimationFrame(animate);
                return true;
            };
            if (!ensureBody() && document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', ensureBody, {
                    once: true,
                });
            }
        });
    }
}
