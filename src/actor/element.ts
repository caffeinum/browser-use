import type { BrowserSession } from '../browser/session.js';
import type { DOMElementNode } from '../dom/views.js';

export class Element {
  constructor(
    private readonly browser_session: BrowserSession,
    readonly node: DOMElementNode
  ) {}

  async click() {
    return this.browser_session._click_element_node(this.node);
  }

  async fill(value: string, clear = true) {
    return this.browser_session._input_text_element_node(this.node, value, {
      clear,
    });
  }

  async hover() {
    const locator = await this.browser_session.get_locate_element(this.node);
    if (!locator?.hover) {
      return;
    }
    const page = await this.browser_session.get_current_page();
    await this.browser_session.validate_page_after_action(page);
    try {
      await locator.hover({ timeout: 5000 });
    } finally {
      await this.browser_session.validate_page_after_action(page);
    }
  }

  async get_attribute(name: string) {
    return this.node.attributes?.[name] ?? null;
  }

  async get_bounding_box() {
    const locator = await this.browser_session.get_locate_element(this.node);
    if (!locator?.boundingBox) {
      return null;
    }
    const page = await this.browser_session.get_current_page();
    await this.browser_session.validate_page_after_action(page);
    try {
      return await locator.boundingBox();
    } finally {
      await this.browser_session.validate_page_after_action(page);
    }
  }

  async select_option(values: string | string[]) {
    const list = Array.isArray(values) ? values : [values];
    for (const value of list) {
      await this.browser_session.select_dropdown_option(this.node, value);
    }
  }

  async evaluate(page_function: string, ...args: unknown[]) {
    const locator = await this.browser_session.get_locate_element(this.node);
    if (!locator?.evaluate) {
      throw new Error('Element evaluate is unavailable for this node');
    }
    const page = await this.browser_session.get_current_page();
    await this.browser_session.validate_page_after_action(page);
    try {
      return await (locator as any).evaluate(page_function, ...args);
    } finally {
      await this.browser_session.validate_page_after_action(page);
    }
  }
}
