import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { Request, Response } from './protocol.js';
import { SessionRegistry } from './sessions.js';

export interface SkillCliServerOptions {
  registry?: SessionRegistry;
}

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
      const url = String(params.url ?? '');
      if (!url) {
        throw new Error('Missing url');
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

    if (action === 'state') {
      const state = await browser_session.get_browser_state_with_recovery({
        include_screenshot: false,
      });
      return {
        url: state.url,
        title: state.title,
        tabs: state.tabs,
        llm_representation: state.llm_representation(),
      };
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
      const cookie = {
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
      } as Record<string, unknown>;

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
      const cookies = JSON.parse(raw);
      if (!Array.isArray(cookies)) {
        throw new Error('Cookie import file must contain a JSON array');
      }
      await browser_session.browser_context.addCookies(cookies);
      return { file: filePath, imported: cookies.length };
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
