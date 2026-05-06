export class Element {
    browser_session;
    node;
    constructor(browser_session, node) {
        this.browser_session = browser_session;
        this.node = node;
    }
    async click() {
        return this.browser_session._click_element_node(this.node);
    }
    async fill(value, clear = true) {
        return this.browser_session._input_text_element_node(this.node, value, {
            clear,
        });
    }
    async hover() {
        const locator = await this.browser_session.get_locate_element(this.node);
        if (!locator?.hover) {
            return;
        }
        await locator.hover({ timeout: 5000 });
    }
    async get_attribute(name) {
        return this.node.attributes?.[name] ?? null;
    }
    async get_bounding_box() {
        const locator = await this.browser_session.get_locate_element(this.node);
        if (!locator?.boundingBox) {
            return null;
        }
        return locator.boundingBox();
    }
    async select_option(values) {
        const list = Array.isArray(values) ? values : [values];
        for (const value of list) {
            await this.browser_session.select_dropdown_option(this.node, value);
        }
    }
    async evaluate(page_function, ...args) {
        const locator = await this.browser_session.get_locate_element(this.node);
        if (!locator?.evaluate) {
            throw new Error('Element evaluate is unavailable for this node');
        }
        return locator.evaluate(page_function, ...args);
    }
}
