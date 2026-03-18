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
});
