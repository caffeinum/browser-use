import type { BrowserSession } from '../browser/session.js';

export interface CreateNamespaceOptions {
  namespace?: Record<string, unknown>;
}

const buildExpression = (source: string, args: unknown[]) =>
  `(${source})(${args.map((arg) => JSON.stringify(arg)).join(',')})`;

const hasDomainRestrictions = (browser_session: BrowserSession) => {
  const checker = (browser_session as any)._has_url_access_restrictions;
  if (typeof checker === 'function') {
    try {
      return Boolean(checker.call(browser_session));
    } catch {
      return true;
    }
  }

  const profile = browser_session.browser_profile;
  const hasEntries = (value: unknown) =>
    Array.isArray(value)
      ? value.length > 0
      : value instanceof Set && value.size > 0;
  return (
    hasEntries(profile?.allowed_domains) ||
    hasEntries(profile?.prohibited_domains) ||
    Boolean(profile?.block_ip_addresses)
  );
};

const createSafeBrowserFacade = (browser_session: BrowserSession) =>
  Object.freeze({
    navigate_to: browser_session.navigate_to.bind(browser_session),
    navigate: browser_session.navigate.bind(browser_session),
    create_new_tab: browser_session.create_new_tab.bind(browser_session),
    go_back: browser_session.go_back.bind(browser_session),
    go_forward: browser_session.go_forward.bind(browser_session),
    refresh: browser_session.refresh.bind(browser_session),
    wait: browser_session.wait.bind(browser_session),
    send_keys: browser_session.send_keys.bind(browser_session),
    click_coordinates: browser_session.click_coordinates.bind(browser_session),
    scroll: browser_session.scroll.bind(browser_session),
    scroll_to_text: browser_session.scroll_to_text.bind(browser_session),
    get_browser_state_with_recovery:
      browser_session.get_browser_state_with_recovery.bind(browser_session),
    get_page_info: browser_session.get_page_info.bind(browser_session),
    get_page_html: browser_session.get_page_html.bind(browser_session),
    execute_javascript:
      browser_session.execute_javascript.bind(browser_session),
    take_screenshot: browser_session.take_screenshot.bind(browser_session),
    get_cookies: () => browser_session.get_cookies(),
  });

export const create_namespace = (
  browser_session: BrowserSession,
  options: CreateNamespaceOptions = {}
) => {
  const namespace = options.namespace ?? {};

  namespace.browser = hasDomainRestrictions(browser_session)
    ? createSafeBrowserFacade(browser_session)
    : browser_session;

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
        return await page.evaluate(code as any, ...args);
      }

      if (args.length === 0) {
        return await page.evaluate(code);
      }

      return await page.evaluate(buildExpression(code, args));
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
