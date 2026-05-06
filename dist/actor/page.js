import { Element } from './element.js';
import { Mouse } from './mouse.js';
export class Page {
    browser_session;
    _mouse = null;
    constructor(browser_session) {
        this.browser_session = browser_session;
    }
    get mouse() {
        if (!this._mouse) {
            this._mouse = new Mouse(this.browser_session);
        }
        return this._mouse;
    }
    async _currentPage() {
        const page = await this.browser_session.get_current_page();
        if (!page) {
            throw new Error('No active page available');
        }
        return page;
    }
    async get_url() {
        const page = await this._currentPage();
        return typeof page.url === 'function' ? page.url() : '';
    }
    async get_title() {
        const page = await this._currentPage();
        return typeof page.title === 'function' ? page.title() : '';
    }
    async goto(url, options = {}) {
        await this.browser_session.navigate_to(url, {
            wait_until: options.wait_until,
            timeout_ms: options.timeout_ms,
        });
    }
    async navigate(url, options = {}) {
        await this.goto(url, options);
    }
    async reload() {
        await this.browser_session.refresh();
    }
    async go_back() {
        await this.browser_session.go_back();
    }
    async go_forward() {
        await this.browser_session.go_forward();
    }
    async evaluate(page_function, ...args) {
        const page = await this._currentPage();
        if (typeof page_function === 'function') {
            return page.evaluate(page_function, ...args);
        }
        if (args.length === 0) {
            return page.evaluate(page_function);
        }
        const expression = `(${page_function})(${args
            .map((arg) => JSON.stringify(arg))
            .join(',')})`;
        return page.evaluate(expression);
    }
    async screenshot(options = {}) {
        return this.browser_session.take_screenshot(options.full_page ?? false);
    }
    async press(key) {
        await this.browser_session.send_keys(key);
    }
    async set_viewport_size(width, height) {
        const page = await this._currentPage();
        if (!page.setViewportSize) {
            return;
        }
        await page.setViewportSize({ width, height });
    }
    async get_element_by_index(index) {
        const node = await this.browser_session.get_dom_element_by_index(index);
        if (!node) {
            return null;
        }
        return new Element(this.browser_session, node);
    }
    async must_get_element_by_index(index) {
        const element = await this.get_element_by_index(index);
        if (!element) {
            throw new Error(`Element not found for index ${index}`);
        }
        return element;
    }
}
