const buildExpression = (source, args) => `(${source})(${args.map((arg) => JSON.stringify(arg)).join(',')})`;
export const create_namespace = (browser_session, options = {}) => {
    const namespace = options.namespace ?? {};
    namespace.browser = browser_session;
    namespace.navigate = async (url, init = {}) => {
        await browser_session.navigate_to(url, init);
    };
    namespace.go_back = async () => {
        await browser_session.go_back();
    };
    namespace.go_forward = async () => {
        await browser_session.go_forward();
    };
    namespace.refresh = async () => {
        await browser_session.refresh();
    };
    namespace.wait = async (seconds) => {
        await browser_session.wait(seconds);
    };
    namespace.click = async (index) => {
        const node = await browser_session.get_dom_element_by_index(index);
        if (!node) {
            throw new Error(`Element index ${index} not found`);
        }
        return browser_session._click_element_node(node);
    };
    namespace.input = async (index, text, clear = true) => {
        const node = await browser_session.get_dom_element_by_index(index);
        if (!node) {
            throw new Error(`Element index ${index} not found`);
        }
        return browser_session._input_text_element_node(node, text, {
            clear,
        });
    };
    namespace.select_dropdown = async (index, text) => {
        const node = await browser_session.get_dom_element_by_index(index);
        if (!node) {
            throw new Error(`Element index ${index} not found`);
        }
        return browser_session.select_dropdown_option(node, text);
    };
    namespace.upload_file = async (index, file_path) => {
        const node = await browser_session.get_dom_element_by_index(index);
        if (!node) {
            throw new Error(`Element index ${index} not found`);
        }
        return browser_session.upload_file(node, file_path);
    };
    namespace.screenshot = async (full_page = false) => {
        return browser_session.take_screenshot(full_page);
    };
    namespace.send_keys = async (keys) => {
        await browser_session.send_keys(keys);
    };
    namespace.evaluate = async (code, ...args) => {
        const page = await browser_session.get_current_page();
        if (!page) {
            throw new Error('No active page for evaluate');
        }
        if (typeof code === 'function') {
            return page.evaluate(code, ...args);
        }
        if (args.length === 0) {
            return page.evaluate(code);
        }
        return page.evaluate(buildExpression(code, args));
    };
    namespace.done = (result = null, success = true) => {
        namespace._task_done = true;
        namespace._task_success = success;
        namespace._task_result =
            typeof result === 'string'
                ? result
                : result == null
                    ? null
                    : JSON.stringify(result);
        return result;
    };
    return namespace;
};
