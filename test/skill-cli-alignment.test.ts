import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { BrowserSession } from '../src/browser/session.js';
import {
  Request,
  Response,
  SessionRegistry,
  SkillCliServer,
} from '../src/skill-cli/index.js';

describe('skill-cli alignment', () => {
  it('round-trips protocol request/response JSON payloads', () => {
    const request = new Request({
      id: 'r1',
      action: 'open',
      session: 'default',
      params: { url: 'https://example.com' },
    });
    const parsedRequest = Request.from_json(request.to_json());
    expect(parsedRequest).toEqual(request);

    const response = new Response({
      id: 'r1',
      success: true,
      data: { ok: true },
    });
    const parsedResponse = Response.from_json(response.to_json());
    expect(parsedResponse).toEqual(response);
  });

  it('handles open action through session registry and browser session', async () => {
    const session = new BrowserSession();
    const navigateSpy = vi
      .spyOn(session, 'navigate_to')
      .mockResolvedValue(null as any);
    const registry = new SessionRegistry({
      session_factory: () => session,
    });
    const server = new SkillCliServer({ registry });

    const response = await server.handle_request(
      new Request({
        id: 'r2',
        action: 'open',
        session: 'default',
        params: { url: 'https://example.com' },
      })
    );

    expect(response.success).toBe(true);
    expect(response.data).toEqual({ url: 'https://example.com' });
    expect(navigateSpy).toHaveBeenCalledWith('https://example.com');
  });

  it('returns error response when click target index is not found', async () => {
    const session = new BrowserSession();
    vi.spyOn(session, 'get_dom_element_by_index').mockImplementation(
      async () => null as any
    );
    const registry = new SessionRegistry({
      session_factory: () => session,
    });
    const server = new SkillCliServer({ registry });

    const response = await server.handle_request(
      new Request({
        id: 'r3',
        action: 'click',
        session: 'default',
        params: { index: 99 },
      })
    );

    expect(response.success).toBe(false);
    expect(String(response.error)).toContain('not found');
  });

  it('lists sessions and closes session via close action', async () => {
    const session = new BrowserSession();
    vi.spyOn(session, 'navigate_to').mockResolvedValue(null as any);
    const stopSpy = vi.spyOn(session, 'stop').mockResolvedValue();
    const registry = new SessionRegistry({
      session_factory: () => session,
    });
    const server = new SkillCliServer({ registry });

    await server.handle_request(
      new Request({
        id: 'r4',
        action: 'open',
        session: 'default',
        params: { url: 'https://example.com' },
      })
    );

    const listed = await server.handle_request(
      new Request({
        id: 'r5',
        action: 'sessions',
        session: 'default',
      })
    );
    expect(listed.success).toBe(true);
    expect((listed.data as any).count).toBe(1);

    const closed = await server.handle_request(
      new Request({
        id: 'r6',
        action: 'close',
        session: 'default',
      })
    );
    expect(closed.success).toBe(true);
    expect(stopSpy).toHaveBeenCalledTimes(1);
  });

  it('supports hover, double-click, and right-click actions', async () => {
    const session = new BrowserSession();
    const locator = {
      hover: vi.fn(async () => {}),
      dblclick: vi.fn(async () => {}),
      click: vi.fn(async () => {}),
    };
    vi.spyOn(session, 'get_dom_element_by_index').mockResolvedValue({} as any);
    vi.spyOn(session, 'get_locate_element').mockResolvedValue(locator as any);
    const registry = new SessionRegistry({
      session_factory: () => session,
    });
    const server = new SkillCliServer({ registry });

    const hover = await server.handle_request(
      new Request({
        id: 'r7',
        action: 'hover',
        session: 'default',
        params: { index: 1 },
      })
    );
    const dblclick = await server.handle_request(
      new Request({
        id: 'r8',
        action: 'dblclick',
        session: 'default',
        params: { index: 1 },
      })
    );
    const rightclick = await server.handle_request(
      new Request({
        id: 'r9',
        action: 'rightclick',
        session: 'default',
        params: { index: 1 },
      })
    );

    expect(hover.success).toBe(true);
    expect(dblclick.success).toBe(true);
    expect(rightclick.success).toBe(true);
    expect(locator.hover).toHaveBeenCalledWith({ timeout: 5000 });
    expect(locator.dblclick).toHaveBeenCalledWith({ timeout: 5000 });
    expect(locator.click).toHaveBeenCalledWith({
      button: 'right',
      timeout: 5000,
    });
  });

  it('supports wait and cookie commands', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-use-skill-'));
    const cookiesPath = path.join(tempDir, 'cookies.json');
    const session = new BrowserSession();
    const waitForElementSpy = vi
      .spyOn(session, 'wait_for_element')
      .mockResolvedValue();
    vi.spyOn(session, 'get_current_page').mockResolvedValue({
      waitForFunction: vi.fn(async () => {}),
      url: () => 'https://example.com',
    } as any);
    vi.spyOn(session, 'get_cookies').mockResolvedValue([
      { name: 'sid', value: '123' } as any,
    ]);
    (session as any).browser_context = {
      addCookies: vi.fn(async () => {}),
      clearCookies: vi.fn(async () => {}),
      cookies: vi.fn(async () => [{ name: 'sid', value: '123' }]),
    };
    const registry = new SessionRegistry({
      session_factory: () => session,
    });
    const server = new SkillCliServer({ registry });

    try {
      const waitSelector = await server.handle_request(
        new Request({
          id: 'r10',
          action: 'wait_selector',
          session: 'default',
          params: { selector: '#app', timeout: 2500 },
        })
      );
      const waitText = await server.handle_request(
        new Request({
          id: 'r11',
          action: 'wait_text',
          session: 'default',
          params: { text: 'Ready', timeout: 2500 },
        })
      );
      const cookiesGet = await server.handle_request(
        new Request({
          id: 'r12',
          action: 'cookies_get',
          session: 'default',
        })
      );
      const cookiesExport = await server.handle_request(
        new Request({
          id: 'r13',
          action: 'cookies_export',
          session: 'default',
          params: { file: cookiesPath },
        })
      );
      const cookiesImport = await server.handle_request(
        new Request({
          id: 'r14',
          action: 'cookies_import',
          session: 'default',
          params: { file: cookiesPath },
        })
      );
      const cookiesClear = await server.handle_request(
        new Request({
          id: 'r15',
          action: 'cookies_clear',
          session: 'default',
        })
      );

      expect(waitSelector.success).toBe(true);
      expect(waitText.success).toBe(true);
      expect(waitForElementSpy).toHaveBeenCalledWith('#app', 2500);
      expect(cookiesGet.success).toBe(true);
      expect((cookiesGet.data as any).count).toBe(1);
      expect(cookiesExport.success).toBe(true);
      expect(fs.existsSync(cookiesPath)).toBe(true);
      expect(cookiesImport.success).toBe(true);
      expect((session as any).browser_context.addCookies).toHaveBeenCalled();
      expect(cookiesClear.success).toBe(true);
      expect((session as any).browser_context.clearCookies).toHaveBeenCalled();
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('supports screenshot action with inline and file outputs', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-use-shot-'));
    const screenshotPath = path.join(tempDir, 'capture.png');
    const session = new BrowserSession();
    vi.spyOn(session, 'take_screenshot').mockResolvedValue(
      Buffer.from('fake-png').toString('base64')
    );
    const registry = new SessionRegistry({
      session_factory: () => session,
    });
    const server = new SkillCliServer({ registry });

    try {
      const inline = await server.handle_request(
        new Request({
          id: 'r16',
          action: 'screenshot',
          session: 'default',
        })
      );
      const saved = await server.handle_request(
        new Request({
          id: 'r17',
          action: 'screenshot',
          session: 'default',
          params: { file: screenshotPath },
        })
      );

      expect(inline.success).toBe(true);
      expect((inline.data as any).screenshot).toBeTypeOf('string');
      expect(saved.success).toBe(true);
      expect((saved.data as any).file).toBe(screenshotPath);
      expect(fs.existsSync(screenshotPath)).toBe(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('supports expanded browser control actions', async () => {
    const session = new BrowserSession();
    const node = {} as any;
    vi.spyOn(session, 'get_dom_element_by_index').mockResolvedValue(node);
    const inputSpy = vi
      .spyOn(session, '_input_text_element_node')
      .mockResolvedValue(null as any);
    const scrollSpy = vi.spyOn(session, 'scroll').mockResolvedValue();
    const backSpy = vi.spyOn(session, 'go_back').mockResolvedValue();
    const forwardSpy = vi.spyOn(session, 'go_forward').mockResolvedValue();
    const switchSpy = vi
      .spyOn(session, 'switch_to_tab')
      .mockResolvedValue({} as any);
    const closeTabSpy = vi.spyOn(session, 'close_tab').mockResolvedValue();
    const sendKeysSpy = vi.spyOn(session, 'send_keys').mockResolvedValue();
    const selectSpy = vi
      .spyOn(session, 'select_dropdown_option')
      .mockResolvedValue(['selected'] as any);
    const evalSpy = vi
      .spyOn(session, 'execute_javascript')
      .mockResolvedValue({ ok: true });
    const getPageHtmlSpy = vi
      .spyOn(session, 'get_page_html')
      .mockResolvedValue('<html></html>');
    vi.spyOn(session, 'get_current_page').mockResolvedValue({
      evaluate: vi.fn(async (fn: (selector: string) => string | null, selector: string) =>
        fn(selector)
      ),
    } as any);

    const registry = new SessionRegistry({
      session_factory: () => session,
    });
    const server = new SkillCliServer({ registry });

    const input = await server.handle_request(
      new Request({
        id: 'r18',
        action: 'input',
        session: 'default',
        params: { index: 2, text: 'hello', clear: false },
      })
    );
    const scroll = await server.handle_request(
      new Request({
        id: 'r19',
        action: 'scroll',
        session: 'default',
        params: { direction: 'up', amount: 250 },
      })
    );
    const back = await server.handle_request(
      new Request({
        id: 'r20',
        action: 'back',
        session: 'default',
      })
    );
    const forward = await server.handle_request(
      new Request({
        id: 'r21',
        action: 'forward',
        session: 'default',
      })
    );
    const sw = await server.handle_request(
      new Request({
        id: 'r22',
        action: 'switch',
        session: 'default',
        params: { tab: 3 },
      })
    );
    const closeTab = await server.handle_request(
      new Request({
        id: 'r23',
        action: 'close-tab',
        session: 'default',
      })
    );
    const keys = await server.handle_request(
      new Request({
        id: 'r24',
        action: 'keys',
        session: 'default',
        params: { keys: 'Control+a' },
      })
    );
    const select = await server.handle_request(
      new Request({
        id: 'r25',
        action: 'select',
        session: 'default',
        params: { index: 2, value: 'Option A' },
      })
    );
    const html = await server.handle_request(
      new Request({
        id: 'r26',
        action: 'html',
        session: 'default',
      })
    );
    const evaluated = await server.handle_request(
      new Request({
        id: 'r27',
        action: 'eval',
        session: 'default',
        params: { js: '({ ok: true })' },
      })
    );

    expect(input.success).toBe(true);
    expect(inputSpy).toHaveBeenCalledWith(node, 'hello', { clear: false });
    expect(scroll.success).toBe(true);
    expect(scrollSpy).toHaveBeenCalledWith('up', 250);
    expect(back.success).toBe(true);
    expect(backSpy).toHaveBeenCalledTimes(1);
    expect(forward.success).toBe(true);
    expect(forwardSpy).toHaveBeenCalledTimes(1);
    expect(sw.success).toBe(true);
    expect(switchSpy).toHaveBeenCalledWith(3);
    expect(closeTab.success).toBe(true);
    expect(closeTabSpy).toHaveBeenCalledWith(session.active_tab?.target_id);
    expect(keys.success).toBe(true);
    expect(sendKeysSpy).toHaveBeenCalledWith('Control+a');
    expect(select.success).toBe(true);
    expect(selectSpy).toHaveBeenCalledWith(node, 'Option A');
    expect(html.success).toBe(true);
    expect((html.data as any).html).toBe('<html></html>');
    expect(getPageHtmlSpy).toHaveBeenCalledTimes(1);
    expect(evaluated.success).toBe(true);
    expect((evaluated.data as any).result).toEqual({ ok: true });
    expect(evalSpy).toHaveBeenCalledWith('({ ok: true })');
  });

  it('supports get and extract actions', async () => {
    const session = new BrowserSession();
    const node = { xpath: '//*[@data-id="target"]' } as any;
    vi.spyOn(session, 'get_dom_element_by_index').mockResolvedValue(node);
    vi.spyOn(session, 'get_current_page').mockResolvedValue({
      title: vi.fn(async () => 'Example Title'),
      evaluate: vi.fn(
        async (
          _fn: unknown,
          input: { xpath: string; dataKind: string }
        ) => {
          if (input.dataKind === 'text') {
            return 'Visible text';
          }
          if (input.dataKind === 'attributes') {
            return { 'data-id': 'target' };
          }
          return null;
        }
      ),
    } as any);
    const registry = new SessionRegistry({
      session_factory: () => session,
    });
    const server = new SkillCliServer({ registry });

    const getTitle = await server.handle_request(
      new Request({
        id: 'r28',
        action: 'get_title',
        session: 'default',
      })
    );
    const getText = await server.handle_request(
      new Request({
        id: 'r29',
        action: 'get_text',
        session: 'default',
        params: { index: 4 },
      })
    );
    const getAttributes = await server.handle_request(
      new Request({
        id: 'r30',
        action: 'get_attributes',
        session: 'default',
        params: { index: 4 },
      })
    );
    const extract = await server.handle_request(
      new Request({
        id: 'r31',
        action: 'extract',
        session: 'default',
        params: { query: 'Extract name' },
      })
    );

    expect(getTitle.success).toBe(true);
    expect((getTitle.data as any).title).toBe('Example Title');
    expect(getText.success).toBe(true);
    expect((getText.data as any).text).toBe('Visible text');
    expect(getAttributes.success).toBe(true);
    expect((getAttributes.data as any).attributes).toEqual({
      'data-id': 'target',
    });
    expect(extract.success).toBe(false);
    expect(String(extract.error)).toContain('extract requires agent mode');
  });
});
