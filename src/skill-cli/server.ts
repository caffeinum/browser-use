import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { Request, Response } from './protocol.js';
import { SessionRegistry } from './sessions.js';

export interface SkillCliServerOptions {
  registry?: SessionRegistry;
}

type BrowserCookieInit = {
  name: string;
  value: string;
  url?: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  partitionKey?: string;
};

export class SkillCliServer {
  readonly registry: SessionRegistry;

  constructor(options: SkillCliServerOptions = {}) {
    this.registry = options.registry ?? new SessionRegistry();
  }

  private async _require_node_by_index(
    browser_session: any,
    index: unknown
  ) {
    const parsedIndex = Number(index);
    if (!Number.isFinite(parsedIndex)) {
      throw new Error('Missing index');
    }

    const node = await browser_session.get_dom_element_by_index(parsedIndex);
    if (!node) {
      return {
        error: `Element index ${parsedIndex} not found - page may have changed`,
      };
    }

    return node;
  }

  private async _handle_browser_action(
    action: string,
    sessionName: string,
    params: Record<string, unknown>
  ) {
    const session = await this.registry.get_or_create_session(sessionName);
    const browser_session = session.browser_session;

    if (action === 'open') {
      let url = String(params.url ?? '').trim();
      if (!url) {
        throw new Error('Missing url');
      }
      if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) {
        url = `https://${url}`;
      }
      await browser_session.navigate_to(url);
      return { url };
    }

    if (action === 'click') {
      const node = await this._require_node_by_index(
        browser_session,
        params.index
      );
      if ('error' in node) {
        return node;
      }
      await browser_session._click_element_node(node);
      return { clicked: Number(params.index) };
    }

    if (action === 'hover') {
      const node = await this._require_node_by_index(
        browser_session,
        params.index
      );
      if ('error' in node) {
        return node;
      }
      const locator = await browser_session.get_locate_element(node);
      if (!locator?.hover) {
        throw new Error('Hover is not available for this element');
      }
      await locator.hover({ timeout: 5000 });
      return { hovered: Number(params.index) };
    }

    if (action === 'dblclick') {
      const node = await this._require_node_by_index(
        browser_session,
        params.index
      );
      if ('error' in node) {
        return node;
      }
      const locator = await browser_session.get_locate_element(node);
      if (!locator?.dblclick) {
        throw new Error('Double-click is not available for this element');
      }
      await locator.dblclick({ timeout: 5000 });
      return { double_clicked: Number(params.index) };
    }

    if (action === 'rightclick') {
      const node = await this._require_node_by_index(
        browser_session,
        params.index
      );
      if ('error' in node) {
        return node;
      }
      const locator = await browser_session.get_locate_element(node);
      if (!locator?.click) {
        throw new Error('Right-click is not available for this element');
      }
      await locator.click({ button: 'right', timeout: 5000 });
      return { right_clicked: Number(params.index) };
    }

    if (action === 'type') {
      const text = String(params.text ?? '');
      await browser_session.send_keys(text);
      return { typed: text };
    }

    if (action === 'input') {
      const node = await this._require_node_by_index(
        browser_session,
        params.index
      );
      if ('error' in node) {
        return node;
      }
      const text = String(params.text ?? '');
      const clear =
        typeof params.clear === 'boolean' ? params.clear : true;
      await browser_session._input_text_element_node(node, text, { clear });
      return { input: Number(params.index), text, clear };
    }

    if (action === 'state') {
      const state = await browser_session.get_browser_state_with_recovery({
        include_screenshot: false,
      });
      const page_info =
        typeof browser_session.get_page_info === 'function'
          ? await browser_session.get_page_info()
          : null;
      return {
        url: state.url,
        title: state.title,
        tabs: state.tabs,
        page_info,
        llm_representation: state.llm_representation(),
      };
    }

    if (action === 'screenshot') {
      const screenshot = await browser_session.take_screenshot(
        Boolean(params.full)
      );
      if (!screenshot) {
        throw new Error('Failed to capture screenshot');
      }

      const file = typeof params.file === 'string' ? params.file.trim() : '';
      if (!file) {
        return { screenshot };
      }

      const filePath = path.resolve(file);
      await fsp.writeFile(filePath, Buffer.from(screenshot, 'base64'));
      return { file: filePath };
    }

    if (action === 'wait_selector') {
      const selector = String(params.selector ?? '');
      if (!selector) {
        throw new Error('Missing selector');
      }
      const timeout = Number(params.timeout ?? 5000);
      await browser_session.wait_for_element(selector, timeout);
      return { waited_for: 'selector', selector, timeout };
    }

    if (action === 'wait_text') {
      const text = String(params.text ?? '');
      if (!text) {
        throw new Error('Missing text');
      }
      const timeout = Number(params.timeout ?? 5000);
      const page = await browser_session.get_current_page();
      if (!page?.waitForFunction) {
        throw new Error('No active page available for wait_text');
      }
      await page.waitForFunction(
        (needle: string) =>
          document.body?.innerText?.includes(needle) ?? false,
        text,
        { timeout }
      );
      return { waited_for: 'text', text, timeout };
    }

    if (action === 'scroll') {
      let direction: 'up' | 'down' | 'left' | 'right' = 'down';
      if (
        typeof params.direction === 'string' &&
        ['up', 'down', 'left', 'right'].includes(params.direction)
      ) {
        direction = params.direction as 'up' | 'down' | 'left' | 'right';
      }
      const amount = Number(params.amount ?? 500);
      await browser_session.scroll(direction, amount);
      return { direction, amount };
    }

    if (action === 'back') {
      await browser_session.go_back();
      return { navigated: 'back' };
    }

    if (action === 'forward') {
      await browser_session.go_forward();
      return { navigated: 'forward' };
    }

    if (action === 'switch') {
      const identifier = params.tab ?? params.target_id;
      if (
        typeof identifier !== 'string' &&
        typeof identifier !== 'number'
      ) {
        throw new Error('Missing tab');
      }
      await browser_session.switch_to_tab(identifier);
      return {
        active_tab:
          browser_session.active_tab?.target_id ??
          browser_session.active_tab?.tab_id ??
          browser_session.active_tab?.page_id ??
          null,
      };
    }

    if (action === 'close_tab' || action === 'close-tab') {
      const identifier =
        params.tab ??
        params.target_id ??
        browser_session.active_tab?.target_id ??
        browser_session.active_tab?.page_id ??
        browser_session.active_tab_index;
      if (
        typeof identifier !== 'string' &&
        typeof identifier !== 'number'
      ) {
        throw new Error('Missing tab');
      }
      await browser_session.close_tab(identifier);
      return { closed_tab: identifier };
    }

    if (action === 'keys') {
      const keys = String(params.keys ?? '');
      if (!keys) {
        throw new Error('Missing keys');
      }
      await browser_session.send_keys(keys);
      return { keys };
    }

    if (action === 'select') {
      const node = await this._require_node_by_index(
        browser_session,
        params.index
      );
      if ('error' in node) {
        return node;
      }
      const value = String(params.value ?? '');
      if (!value) {
        throw new Error('Missing value');
      }
      const selected = await browser_session.select_dropdown_option(
        node,
        value
      );
      return {
        index: Number(params.index),
        value,
        selected,
      };
    }

    if (action === 'html') {
      const selector =
        typeof params.selector === 'string' ? params.selector.trim() : '';
      if (!selector) {
        return { html: await browser_session.get_page_html() };
      }

      const page = await browser_session.get_current_page();
      if (!page?.evaluate) {
        throw new Error('No active page available for html');
      }
      const html = await page.evaluate((targetSelector: string) => {
        const element = document.querySelector(targetSelector);
        return element ? element.outerHTML : null;
      }, selector);
      if (typeof html !== 'string' || html.length === 0) {
        throw new Error(`No element found for selector: ${selector}`);
      }
      return { selector, html };
    }

    if (action === 'eval') {
      const script = String(params.js ?? params.script ?? '').trim();
      if (!script) {
        throw new Error('Missing js');
      }
      return {
        result: await browser_session.execute_javascript(script),
      };
    }

    if (action === 'cookies_get') {
      const url = typeof params.url === 'string' ? params.url.trim() : '';
      const cookies =
        url && browser_session.browser_context?.cookies
          ? await browser_session.browser_context.cookies([url])
          : await browser_session.get_cookies();
      return { cookies, count: cookies.length };
    }

    if (action === 'cookies_set') {
      const name = String(params.name ?? '').trim();
      const value = String(params.value ?? '');
      if (!name) {
        throw new Error('Missing cookie name');
      }
      if (!browser_session.browser_context?.addCookies) {
        throw new Error('Browser context does not support setting cookies');
      }

      const currentPage = await browser_session.get_current_page?.();
      const currentUrl =
        typeof currentPage?.url === 'function' ? currentPage.url() : '';
      const cookie: BrowserCookieInit = {
        name,
        value,
        url:
          typeof params.url === 'string' && params.url.trim().length > 0
            ? params.url.trim()
            : undefined,
        domain:
          typeof params.domain === 'string' ? params.domain.trim() : undefined,
        path: typeof params.path === 'string' ? params.path : '/',
        secure: Boolean(params.secure),
        httpOnly: Boolean(params.http_only),
      };

      if (!cookie.url && !cookie.domain && currentUrl) {
        cookie.url = currentUrl;
      }
      if (!cookie.url && !cookie.domain) {
        throw new Error('Provide cookie url/domain or open a page first');
      }

      await browser_session.browser_context.addCookies([cookie]);
      return { set: name };
    }

    if (action === 'cookies_clear') {
      if (!browser_session.browser_context?.clearCookies) {
        throw new Error('Browser context does not support clearing cookies');
      }
      await browser_session.browser_context.clearCookies();
      return { cleared: true };
    }

    if (action === 'cookies_export') {
      const file = String(params.file ?? '').trim();
      if (!file) {
        throw new Error('Missing file');
      }
      const cookies = await browser_session.get_cookies();
      const filePath = path.resolve(file);
      await fsp.writeFile(filePath, JSON.stringify(cookies, null, 2));
      return { file: filePath, count: cookies.length };
    }

    if (action === 'cookies_import') {
      const file = String(params.file ?? '').trim();
      if (!file) {
        throw new Error('Missing file');
      }
      if (!browser_session.browser_context?.addCookies) {
        throw new Error('Browser context does not support importing cookies');
      }
      const filePath = path.resolve(file);
      const raw = await fsp.readFile(filePath, 'utf8');
      const cookies = JSON.parse(raw) as unknown;
      if (!Array.isArray(cookies)) {
        throw new Error('Cookie import file must contain a JSON array');
      }
      const importedCookies = cookies.map((cookie) => {
        if (!cookie || typeof cookie !== 'object') {
          throw new Error('Each imported cookie must be a JSON object');
        }
        const typedCookie = cookie as Partial<BrowserCookieInit>;
        if (
          typeof typedCookie.name !== 'string' ||
          typeof typedCookie.value !== 'string'
        ) {
          throw new Error('Each imported cookie must include string name/value');
        }
        return typedCookie as BrowserCookieInit;
      });
      await browser_session.browser_context.addCookies(importedCookies);
      return { file: filePath, imported: importedCookies.length };
    }

    if (action === 'close') {
      await this.registry.close_session(sessionName);
      return { closed: sessionName };
    }

    if (action === 'sessions') {
      const sessions = this.registry.list_sessions();
      return { sessions, count: sessions.length };
    }

    throw new Error(`Unknown action: ${action}`);
  }

  async handle_request(request: Request | string) {
    const req =
      typeof request === 'string' ? Request.from_json(request) : request;
    try {
      const data = await this._handle_browser_action(
        req.action,
        req.session,
        req.params
      );
      if (data && typeof data === 'object' && 'error' in data) {
        return new Response({
          id: req.id,
          success: false,
          data: null,
          error: String((data as any).error),
        });
      }
      return new Response({
        id: req.id,
        success: true,
        data,
      });
    } catch (error) {
      return new Response({
        id: req.id,
        success: false,
        error: String((error as Error)?.message ?? error),
      });
    }
  }
}
