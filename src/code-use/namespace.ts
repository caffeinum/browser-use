import type { BrowserSession } from '../browser/session.js';

export interface CreateNamespaceOptions {
  namespace?: Record<string, unknown>;
}

const buildExpression = (source: string, args: unknown[]) =>
  `(${source})(${args.map((arg) => JSON.stringify(arg)).join(',')})`;

export const create_namespace = (
  browser_session: BrowserSession,
  options: CreateNamespaceOptions = {}
) => {
  const namespace = options.namespace ?? {};

  namespace.browser = browser_session;

  namespace.navigate = async (
    url: string,
    init: {
      wait_until?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
      timeout_ms?: number | null;
    } = {}
  ) => {
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

  namespace.wait = async (seconds: number) => {
    await browser_session.wait(seconds);
  };

  namespace.click = async (index: number) => {
    const node = await browser_session.get_dom_element_by_index(index);
    if (!node) {
      throw new Error(`Element index ${index} not found`);
    }
    return browser_session._click_element_node(node);
  };

  namespace.input = async (index: number, text: string, clear = true) => {
    const node = await browser_session.get_dom_element_by_index(index);
    if (!node) {
      throw new Error(`Element index ${index} not found`);
    }
    return browser_session._input_text_element_node(node, text, {
      clear,
    });
  };

  namespace.select_dropdown = async (index: number, text: string) => {
    const node = await browser_session.get_dom_element_by_index(index);
    if (!node) {
      throw new Error(`Element index ${index} not found`);
    }
    return browser_session.select_dropdown_option(node, text);
  };

  namespace.upload_file = async (index: number, file_path: string) => {
    const node = await browser_session.get_dom_element_by_index(index);
    if (!node) {
      throw new Error(`Element index ${index} not found`);
    }
    return browser_session.upload_file(node, file_path);
  };

  namespace.screenshot = async (full_page = false) => {
    return browser_session.take_screenshot(full_page);
  };

  namespace.send_keys = async (keys: string) => {
    await browser_session.send_keys(keys);
  };

  namespace.evaluate = async (
    code: string | ((...args: unknown[]) => unknown),
    ...args: unknown[]
  ) => {
    const page = await browser_session.get_current_page();
    if (!page?.evaluate) {
      throw new Error('No active page for evaluate');
    }

    await browser_session.validate_page_after_action(page);
    try {
      if (typeof code === 'function') {
        return page.evaluate(code as any, ...args);
      }

      if (args.length === 0) {
        return page.evaluate(code);
      }

      return page.evaluate(buildExpression(code, args));
    } finally {
      await browser_session.validate_page_after_action(page);
    }
  };

  namespace.done = (result: unknown = null, success: boolean | null = true) => {
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
