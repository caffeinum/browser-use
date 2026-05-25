import type { WaitUntilState } from '../browser/events.js';
import type { BrowserSession } from '../browser/session.js';
import { Element } from './element.js';
import { Mouse } from './mouse.js';

const buildExpression = (source: string, args: unknown[]) =>
  `(${source})(${args.map((arg) => JSON.stringify(arg)).join(',')})`;

export class Page {
  private _mouse: Mouse | null = null;

  constructor(private readonly browser_session: BrowserSession) {}

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

  async goto(
    url: string,
    options: {
      wait_until?: WaitUntilState;
      timeout_ms?: number | null;
    } = {}
  ) {
    await this.browser_session.navigate_to(url, {
      wait_until: options.wait_until,
      timeout_ms: options.timeout_ms,
    });
  }

  async navigate(url: string, options: Parameters<Page['goto']>[1] = {}) {
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

  async evaluate(
    page_function: string | ((...args: unknown[]) => unknown),
    ...args: unknown[]
  ) {
    const page = await this._currentPage();
    try {
      if (typeof page_function === 'function') {
        return page.evaluate(page_function as any, ...args);
      }
      if (args.length === 0) {
        return page.evaluate(page_function);
      }
      return page.evaluate(buildExpression(page_function, args));
    } finally {
      await this.browser_session.validate_page_after_action(page);
    }
  }

  async screenshot(options: { full_page?: boolean } = {}) {
    return this.browser_session.take_screenshot(options.full_page ?? false);
  }

  async press(key: string) {
    await this.browser_session.send_keys(key);
  }

  async set_viewport_size(width: number, height: number) {
    const page = await this._currentPage();
    if (!page.setViewportSize) {
      return;
    }
    await page.setViewportSize({ width, height });
  }

  async get_element_by_index(index: number) {
    const node = await this.browser_session.get_dom_element_by_index(index);
    if (!node) {
      return null;
    }
    return new Element(this.browser_session, node);
  }

  async must_get_element_by_index(index: number) {
    const element = await this.get_element_by_index(index);
    if (!element) {
      throw new Error(`Element not found for index ${index}`);
    }
    return element;
  }
}
