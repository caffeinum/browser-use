export class Mouse {
    browser_session;
    pageRef;
    constructor(browser_session, pageRef = null) {
        this.browser_session = browser_session;
        this.pageRef = pageRef;
    }
    async _page() {
        if (this.pageRef) {
            return this.pageRef;
        }
        return this.browser_session.get_current_page();
    }
    async click(x, y, options = {}) {
        const button = options.button ?? 'left';
        await this.browser_session.click_coordinates(x, y, { button });
    }
    async move(x, y) {
        const page = await this._page();
        if (!page?.mouse?.move) {
            return;
        }
        await page.mouse.move(x, y);
    }
    async down(options = {}) {
        const page = await this._page();
        if (!page?.mouse?.down) {
            return;
        }
        await page.mouse.down({ button: options.button ?? 'left' });
    }
    async up(options = {}) {
        const page = await this._page();
        if (!page?.mouse?.up) {
            return;
        }
        await page.mouse.up({ button: options.button ?? 'left' });
    }
}
