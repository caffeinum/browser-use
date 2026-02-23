/**
 * Tests for BrowserSession functionality.
 *
 * Tests cover:
 * 1. Session lifecycle (start, stop)
 * 2. Basic browser operations
 * 3. Configuration options
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Mock utils
vi.mock('../src/utils.js', () => {
  let counter = 0;
  const decorator =
    <T extends (...args: any[]) => any>(_label?: string) =>
    (fn: T) =>
      fn;

  return {
    uuid7str: () => `uuid-${++counter}`,
    time_execution_sync: decorator,
    time_execution_async: decorator,
    SignalHandler: class {
      register() {}
      reset() {}
      unregister() {}
    },
    get_browser_use_version: () => 'test-version',
    is_new_tab_page: (url: string) =>
      url === 'about:blank' || url.startsWith('chrome://'),
    match_url_with_domain_pattern: (url: string, pattern: string) => {
      if (!pattern) return false;
      const normalized = pattern.replace(/\*/g, '');
      return url.includes(normalized);
    },
    sanitize_surrogates: (text: string) => text,
    log_pretty_path: (p: string) => p,
  };
});

// Mock telemetry
vi.mock('../src/telemetry/service.js', () => ({
  productTelemetry: {
    capture: vi.fn(),
    flush: vi.fn(),
  },
}));

// Import after mocks
import { BrowserSession } from '../src/browser/session.js';
import { BrowserProfile } from '../src/browser/profile.js';
import { DownloadProgressEvent } from '../src/browser/events.js';
import { DomService } from '../src/dom/service.js';
import { DOMElementNode, DOMTextNode, DOMState } from '../src/dom/views.js';

describe('BrowserSession Basic Operations', () => {
  it('creates browser session with profile', () => {
    const profile = new BrowserProfile({
      headless: true,
    });

    const session = new BrowserSession({
      browser_profile: profile,
    });

    expect(session).toBeDefined();
  });

  it('clones provided browser_profile to avoid shared mutable state', () => {
    const profile = new BrowserProfile({
      keep_alive: null,
      allowed_domains: ['example.com'],
    });

    const session = new BrowserSession({
      browser_profile: profile,
    });

    expect(session.browser_profile).not.toBe(profile);
    profile.keep_alive = true;
    expect(session.browser_profile.keep_alive).toBeNull();
  });

  it('supports python compatibility aliases for ownership and model_copy', () => {
    const session = new BrowserSession({
      browser_profile: new BrowserProfile({}),
      browser: {} as any,
    });

    expect(session._owns_browser_resources).toBe(false);

    const copied = session.model_copy();
    expect(copied).toBeInstanceOf(BrowserSession);
    expect(copied).not.toBe(session);
  });

  it('treats sessions initialized with browser_pid as non-owning', () => {
    const session = new BrowserSession({
      browser_profile: new BrowserProfile({}),
      browser_pid: 12345,
    });

    expect(session._owns_browser_resources).toBe(false);
  });

  it('normalizes pid values before tracking child processes', () => {
    const session = new BrowserSession({
      browser_profile: new BrowserProfile({}),
    });

    expect((session as any)._normalizePid(123)).toBe(123);
    expect((session as any)._normalizePid(0)).toBeNull();
    expect((session as any)._normalizePid(-1)).toBeNull();
    expect((session as any)._normalizePid(Number.NaN)).toBeNull();
  });

  it('skips invalid tracked pids when killing child processes', async () => {
    const session = new BrowserSession({
      browser_profile: new BrowserProfile({}),
    });

    (session as any)._childProcesses = new Set([0, -10, Number.NaN]);
    const killSpy = vi.spyOn(process, 'kill');

    try {
      await (session as any)._killChildProcesses();
      expect(killSpy).not.toHaveBeenCalled();
      expect((session as any)._childProcesses.size).toBe(0);
    } finally {
      killSpy.mockRestore();
    }
  });

  it('returns no child processes for invalid parent pid input', async () => {
    const session = new BrowserSession({
      browser_profile: new BrowserProfile({}),
    });

    await expect((session as any)._getChildProcesses(0)).resolves.toEqual([]);
    await expect((session as any)._getChildProcesses(-4)).resolves.toEqual([]);
    await expect(
      (session as any)._getChildProcesses(Number.NaN)
    ).resolves.toEqual([]);
  });

  it('enforces single-agent attachment claims', () => {
    const session = new BrowserSession({
      browser_profile: new BrowserProfile({}),
    });

    expect(session.claim_agent('agent-a')).toBe(true);
    expect(session.claim_agent('agent-a')).toBe(true);
    expect(session.claim_agent('agent-b')).toBe(false);
    expect(session.get_attached_agent_id()).toBe('agent-a');

    expect(session.release_agent('agent-b')).toBe(false);
    expect(session.get_attached_agent_id()).toBe('agent-a');

    expect(session.release_agent('agent-a')).toBe(true);
    expect(session.get_attached_agent_id()).toBeNull();
  });

  it('supports shared attachment mode for controlled parallel agents', () => {
    const session = new BrowserSession({
      browser_profile: new BrowserProfile({}),
    });

    expect(session.claim_agent('agent-a', 'shared')).toBe(true);
    expect(session.claim_agent('agent-b', 'shared')).toBe(true);
    expect(session.get_attached_agent_ids().sort()).toEqual([
      'agent-a',
      'agent-b',
    ]);
    expect(session.claim_agent('agent-c')).toBe(false);

    expect(session.release_agent('agent-a')).toBe(true);
    expect(session.get_attached_agent_ids()).toEqual(['agent-b']);
    expect(session.release_agent('agent-b')).toBe(true);
    expect(session.get_attached_agent_ids()).toEqual([]);
  });

  it('deduplicates concurrent stop calls', async () => {
    const session = new BrowserSession({
      browser_profile: new BrowserProfile({}),
    });
    await session.start();

    const shutdownSpy = vi
      .spyOn(session as any, '_shutdown_browser_session')
      .mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        (session as any).initialized = false;
      });

    await Promise.all([session.stop(), session.stop(), session.stop()]);
    expect(shutdownSpy).toHaveBeenCalledTimes(1);
  });

  it('appends text when clear=false in _input_text_element_node', async () => {
    const session = new BrowserSession({
      browser_profile: new BrowserProfile({}),
    });
    const locator = {
      click: vi.fn(async () => {}),
      fill: vi.fn(async () => {}),
      type: vi.fn(async () => {}),
    };
    vi.spyOn(session, 'get_locate_element').mockResolvedValue(locator as any);

    await session._input_text_element_node(
      { xpath: '/html/body/input' } as any,
      'append',
      { clear: false }
    );

    expect(locator.click).toHaveBeenCalledTimes(1);
    expect(locator.type).toHaveBeenCalledWith('append', { timeout: 5000 });
    expect(locator.fill).not.toHaveBeenCalled();
  });

  it('dispatches completed DownloadProgressEvent during element click downloads', async () => {
    const downloadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bu-click-dl-'));
    try {
      const session = new BrowserSession({
        profile: {
          downloads_path: downloadsDir,
        },
      });

      const locator = {
        click: vi.fn(async () => {}),
      };
      const fakeDownload = {
        suggestedFilename: () => 'report.csv',
        url: () => 'https://example.com/report.csv',
        saveAs: vi.fn(async (targetPath: string) => {
          fs.writeFileSync(targetPath, 'abc');
        }),
      };
      const fakePage = {
        waitForEvent: vi.fn(async () => fakeDownload),
        waitForLoadState: vi.fn(async () => {}),
      };

      vi.spyOn(session, 'get_locate_element').mockResolvedValue(locator as any);
      vi.spyOn(session, 'get_current_page').mockResolvedValue(fakePage as any);

      const dispatchSpy = vi.spyOn(session.event_bus, 'dispatch');
      const downloadPath = await session._click_element_node({
        xpath: '/html/body/a[1]',
      } as any);

      expect(downloadPath).toContain('report.csv');
      expect(fs.existsSync(downloadPath as string)).toBe(true);
      expect(
        dispatchSpy.mock.calls.some(
          ([event]) =>
            event instanceof DownloadProgressEvent &&
            event.state === 'completed'
        )
      ).toBe(true);
    } finally {
      fs.rmSync(downloadsDir, { recursive: true, force: true });
    }
  });

  it('aborts navigation when signal is triggered', async () => {
    const session = new BrowserSession({
      browser_profile: new BrowserProfile({}),
    });

    const never = new Promise<never>(() => {});
    const fakePage = {
      goto: vi.fn(() => never),
      url: () => 'about:blank',
    } as any;

    session.update_current_page(fakePage, 'about:blank', 'about:blank');
    (session as any).initialized = true;

    const controller = new AbortController();
    const navigation = session.navigate_to('https://example.com', {
      signal: controller.signal,
    });
    controller.abort();

    await expect(navigation).rejects.toMatchObject({ name: 'AbortError' });
    expect(session.active_tab?.url).toBe('about:blank');
  });

  it('switches tabs by 4-char tab_id aliases', async () => {
    const session = new BrowserSession({
      browser_profile: new BrowserProfile({}),
    });

    const pageA = {
      bringToFront: vi.fn(async () => {}),
      waitForLoadState: vi.fn(async () => {}),
      url: vi.fn(() => 'https://a.test'),
    } as any;
    const pageB = {
      bringToFront: vi.fn(async () => {}),
      waitForLoadState: vi.fn(async () => {}),
      url: vi.fn(() => 'https://b.test'),
    } as any;

    (session as any)._tabs = [
      { page_id: 0, tab_id: '0000', url: 'https://a.test', title: 'A' },
      { page_id: 7, tab_id: '0007', url: 'https://b.test', title: 'B' },
    ];
    (session as any).tabPages.set(0, pageA);
    (session as any).tabPages.set(7, pageB);
    (session as any).currentTabIndex = 0;

    await session.switch_to_tab('0007');

    expect(session.active_tab?.tab_id).toBe('0007');
    expect(session.active_tab?.page_id).toBe(7);
    expect(pageB.bringToFront).toHaveBeenCalledTimes(1);
  });

  it('aborts browser state capture when signal is already aborted', async () => {
    const session = new BrowserSession({
      browser_profile: new BrowserProfile({}),
    });

    session.update_current_page({ url: () => 'about:blank' } as any);
    (session as any).initialized = true;

    const controller = new AbortController();
    controller.abort();

    await expect(
      session.get_browser_state_with_recovery({ signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('auto-handles JavaScript dialogs and records closed popup messages', async () => {
    const listeners = new Map<string, (dialog: any) => Promise<void>>();
    const fakePage = {
      url: () => 'about:blank',
      on: vi.fn((event: string, handler: (dialog: any) => Promise<void>) => {
        listeners.set(event, handler);
      }),
    } as any;

    const session = new BrowserSession({
      browser_profile: new BrowserProfile({}),
      page: fakePage,
    });

    const dialogHandler = listeners.get('dialog');
    expect(typeof dialogHandler).toBe('function');

    const alertDialog = {
      type: () => 'alert',
      message: () => 'This is alert',
      accept: vi.fn(async () => {}),
      dismiss: vi.fn(async () => {}),
    };
    await dialogHandler?.(alertDialog);
    expect(alertDialog.accept).toHaveBeenCalledTimes(1);
    expect((session as any)._closedPopupMessages).toContain(
      '[alert] This is alert'
    );

    const promptDialog = {
      type: () => 'prompt',
      message: () => 'Need user input',
      accept: vi.fn(async () => {}),
      dismiss: vi.fn(async () => {}),
    };
    await dialogHandler?.(promptDialog);
    expect(promptDialog.dismiss).toHaveBeenCalledTimes(1);
    expect((session as any)._closedPopupMessages).toContain(
      '[prompt] Need user input'
    );
  });

  it('preserves closed popup messages in minimal state summary', async () => {
    const session = new BrowserSession({
      browser_profile: new BrowserProfile({}),
      closed_popup_messages: ['[alert] Existing popup message'],
    });

    const fakePage = {
      url: () => 'https://example.com',
      title: vi.fn(async () => 'Example'),
    } as any;
    session.update_current_page(fakePage);
    (session as any).initialized = true;

    const summary = await session.get_minimal_state_summary();
    expect(summary.closed_popup_messages).toEqual([
      '[alert] Existing popup message',
    ]);
  });

  it('includes recent events, pending requests, and pagination buttons in browser state', async () => {
    const paginationNode = new DOMElementNode(
      true,
      null,
      'button',
      '/html/body/nav/button[1]',
      { 'aria-label': 'Next page', role: 'button' },
      [new DOMTextNode(true, null, 'Next')]
    );
    paginationNode.highlight_index = 1;
    const domState = new DOMState(
      new DOMElementNode(true, null, 'body', '/html/body', {}, [
        paginationNode,
      ]),
      { 1: paginationNode }
    );

    const clickableSpy = vi
      .spyOn(DomService.prototype, 'get_clickable_elements')
      .mockResolvedValue(domState);

    try {
      const session = new BrowserSession({
        browser_profile: new BrowserProfile({}),
      });

      const evaluate = vi.fn(async (script: unknown) => {
        const source =
          typeof script === 'function' ? script.toString() : String(script);
        if (source.includes('getEntriesByType')) {
          return [
            {
              url: 'https://example.com/api/items',
              method: 'GET',
              loading_duration_ms: 120,
              resource_type: 'fetch',
            },
          ];
        }
        if (source.includes('viewportWidth') && source.includes('pageHeight')) {
          return {
            viewportWidth: 1280,
            viewportHeight: 720,
            scrollX: 0,
            scrollY: 0,
            pageWidth: 1280,
            pageHeight: 2000,
          };
        }
        if (
          source.includes('embed[type="application/pdf"]') ||
          source.includes('object[type="application/pdf"]')
        ) {
          return false;
        }
        return null;
      });

      const fakePage = {
        url: () => 'https://example.com/list',
        title: vi.fn(async () => 'List'),
        evaluate,
        on: vi.fn(),
        off: vi.fn(),
      } as any;

      session.update_current_page(fakePage, 'List', 'https://example.com/list');
      (session as any).initialized = true;
      (session as any)._recordRecentEvent('tab_switched', {
        url: 'https://example.com/list',
        page_id: 0,
      });

      const summary = await session.get_browser_state_with_recovery({
        include_screenshot: false,
        include_recent_events: true,
      });

      expect(summary.recent_events).toContain('"event_type":"tab_switched"');
      expect(summary.pending_network_requests).toHaveLength(1);
      expect(summary.pending_network_requests[0]?.url).toContain('/api/items');
      expect(summary.pagination_buttons).toHaveLength(1);
      expect(summary.pagination_buttons[0]?.button_type).toBe('next');
      expect((session as any)._original_viewport_size).toEqual([1280, 720]);
    } finally {
      clickableSpy.mockRestore();
    }
  });

  it('starts and stops browser session', async () => {
    const session = new BrowserSession({
      browser_profile: new BrowserProfile({
        headless: true,
      }),
    });

    await session.start();
    expect(session.browser).toBeTruthy();
    expect(session.browser_context).toBeTruthy();
    expect(await session.get_current_page()).toBeTruthy();

    await session.stop();
    expect(session.browser).toBeNull();
    expect(session.browser_context).toBeNull();
  });

  it('retries chromium launch without sandbox when sandbox is unavailable', async () => {
    const launch = vi
      .fn()
      .mockRejectedValueOnce(
        new Error('Chromium sandboxing failed! No usable sandbox.')
      );
    const fakePage = {
      url: () => 'about:blank',
      title: vi.fn(async () => 'about:blank'),
      isClosed: vi.fn(() => false),
    };
    const fakeContext = {
      pages: vi.fn(() => []),
      newPage: vi.fn(async () => fakePage),
      close: vi.fn(async () => {}),
    };
    const fakeBrowser = {
      contexts: vi.fn(() => []),
      newContext: vi.fn(async () => fakeContext),
      close: vi.fn(async () => {}),
      process: vi.fn(() => ({ pid: 12345 })),
    };
    launch.mockResolvedValueOnce(fakeBrowser);

    const session = new BrowserSession({
      browser_profile: new BrowserProfile({
        headless: true,
        chromium_sandbox: true,
      }),
      playwright: {
        chromium: {
          launch,
        },
      } as any,
    });

    await session.start();

    expect(launch).toHaveBeenCalledTimes(2);
    const secondLaunchOptions = launch.mock.calls[1]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(secondLaunchOptions?.chromiumSandbox).toBe(false);
    expect(Array.isArray(secondLaunchOptions?.args)).toBe(true);
    expect(secondLaunchOptions?.args as string[]).toContain('--no-sandbox');

    await session.stop();
  });
});

describe('BrowserProfile Configuration', () => {
  it('creates profile with default headless (null by default)', () => {
    const profile = new BrowserProfile({});
    // headless defaults to null (auto-detect) in BrowserProfile
    expect(profile.config.headless).toBeNull();
  });

  it('creates profile with custom viewport', () => {
    const profile = new BrowserProfile({
      viewport: { width: 1920, height: 1080 },
    });

    expect(profile.viewport?.width).toBe(1920);
    expect(profile.viewport?.height).toBe(1080);
  });

  it('creates profile with user agent', () => {
    const customUA = 'Custom User Agent';
    const profile = new BrowserProfile({
      user_agent: customUA,
    });

    // Access via config since user_agent is not a public getter
    expect(profile.config.user_agent).toBe(customUA);
  });

  it('creates profile with headless mode', () => {
    const profile = new BrowserProfile({
      headless: true,
    });

    expect(profile.config.headless).toBe(true);
  });
});

describe('BrowserSession PDF Auto Download', () => {
  it('auto-downloads detected PDFs and tracks the file', async () => {
    const downloadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bu-pdf-'));
    try {
      const session = new BrowserSession({
        browser_profile: new BrowserProfile({
          downloads_path: downloadsDir,
        }),
      });

      const fakePage = {
        url: () => 'https://example.com/report.pdf',
        evaluate: vi.fn(async () => ({
          data: [37, 80, 68, 70], // %PDF
          fromCache: true,
          responseSize: 4,
        })),
      } as any;

      const downloadedPath = await (
        session as any
      )._auto_download_pdf_if_needed(fakePage);

      expect(downloadedPath).toBeTruthy();
      expect(fs.existsSync(downloadedPath!)).toBe(true);
      expect(session.get_downloaded_files()).toContain(downloadedPath);
    } finally {
      fs.rmSync(downloadsDir, { recursive: true, force: true });
    }
  });

  it('skips re-downloading the same PDF filename', async () => {
    const downloadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bu-pdf-'));
    try {
      const session = new BrowserSession({
        browser_profile: new BrowserProfile({
          downloads_path: downloadsDir,
        }),
      });

      const evaluate = vi.fn(async () => ({
        data: [37, 80, 68, 70],
        fromCache: false,
        responseSize: 4,
      }));
      const fakePage = {
        url: () => 'https://example.com/duplicate.pdf?token=abc',
        evaluate,
      } as any;

      const firstPath = await (session as any)._auto_download_pdf_if_needed(
        fakePage
      );
      const secondPath = await (session as any)._auto_download_pdf_if_needed(
        fakePage
      );

      expect(firstPath).toBeTruthy();
      expect(secondPath).toBeNull();
      expect(evaluate).toHaveBeenCalledTimes(1);
      expect(session.get_downloaded_files()).toHaveLength(1);
    } finally {
      fs.rmSync(downloadsDir, { recursive: true, force: true });
    }
  });
});

describe('Direct Playwright Operations', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext();
    page = await context.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  it('navigates to URL', async () => {
    await page.goto('about:blank');
    expect(page.url()).toBe('about:blank');
  });

  it('gets page content', async () => {
    await page.setContent('<html><body><h1>Test</h1></body></html>');
    const content = await page.content();
    expect(content).toContain('Test');
  });

  it('handles page interactions', async () => {
    await page.setContent(`
      <html>
        <body>
          <button id="btn" onclick="this.textContent='Clicked'">Click me</button>
        </body>
      </html>
    `);

    await page.click('#btn');
    const text = await page.textContent('#btn');
    expect(text).toBe('Clicked');
  });

  it('handles form inputs', async () => {
    await page.setContent(`
      <html>
        <body>
          <input id="input" type="text" />
        </body>
      </html>
    `);

    await page.fill('#input', 'Hello World');
    const value = await page.inputValue('#input');
    expect(value).toBe('Hello World');
  });

  it('handles multiple tabs', async () => {
    const page2 = await context.newPage();
    await page2.goto('about:blank');

    const pages = context.pages();
    expect(pages.length).toBeGreaterThanOrEqual(2);

    await page2.close();
  });

  it('captures screenshots', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'screenshot-test-'));
    const screenshotPath = path.join(tempDir, 'test.png');

    await page.setContent(
      '<html><body style="background:blue;"></body></html>'
    );
    await page.screenshot({ path: screenshotPath });

    expect(fs.existsSync(screenshotPath)).toBe(true);

    // Cleanup
    fs.rmSync(tempDir, { recursive: true });
  });

  it('evaluates JavaScript', async () => {
    const result = await page.evaluate(() => 1 + 1);
    expect(result).toBe(2);
  });

  it('gets scroll position', async () => {
    await page.setContent(`
      <html>
        <body style="height: 5000px;">
          <div>Tall content</div>
        </body>
      </html>
    `);

    const scrollInfo = await page.evaluate(() => ({
      scrollTop: window.scrollY,
      scrollHeight: document.body.scrollHeight,
      clientHeight: window.innerHeight,
    }));

    expect(scrollInfo.scrollTop).toBe(0);
    expect(scrollInfo.scrollHeight).toBeGreaterThan(0);
  });

  it('handles navigation history', async () => {
    await page.setContent('<html><body>Page 1</body></html>');

    // Page should be functional
    const content = await page.content();
    expect(content).toContain('Page 1');
  });
});

describe('Storage State', () => {
  it('saves and loads storage state', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'storage-test-'));
    const statePath = path.join(tempDir, 'state.json');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();

    // Add a cookie
    await context.addCookies([
      {
        name: 'test_cookie',
        value: 'test_value',
        domain: 'localhost',
        path: '/',
      },
    ]);

    // Save state
    await context.storageState({ path: statePath });

    expect(fs.existsSync(statePath)).toBe(true);

    const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    expect(state).toHaveProperty('cookies');

    await browser.close();

    // Cleanup
    fs.rmSync(tempDir, { recursive: true });
  });
});

describe('DOM Extraction Patterns', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    page = await context.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  it('extracts interactive elements', async () => {
    await page.setContent(`
      <html>
        <body>
          <button id="btn1">Button 1</button>
          <a href="#" id="link1">Link 1</a>
          <input type="text" id="input1" />
          <select id="select1">
            <option>Option 1</option>
          </select>
        </body>
      </html>
    `);

    const interactiveElements = await page.evaluate(() => {
      const selectors = ['button', 'a', 'input', 'select', 'textarea'];
      const elements: string[] = [];
      for (const selector of selectors) {
        document.querySelectorAll(selector).forEach((el) => {
          elements.push(el.tagName.toLowerCase());
        });
      }
      return elements;
    });

    expect(interactiveElements).toContain('button');
    expect(interactiveElements).toContain('a');
    expect(interactiveElements).toContain('input');
    expect(interactiveElements).toContain('select');
  });

  it('handles complex nested structures', async () => {
    await page.setContent(`
      <html>
        <body>
          <nav>
            <ul>
              <li><a href="#1">Item 1</a></li>
              <li><a href="#2">Item 2</a></li>
            </ul>
          </nav>
          <main>
            <form>
              <input type="text" name="name" />
              <button type="submit">Submit</button>
            </form>
          </main>
        </body>
      </html>
    `);

    const structure = await page.evaluate(() => {
      return {
        hasNav: !!document.querySelector('nav'),
        hasMain: !!document.querySelector('main'),
        hasForm: !!document.querySelector('form'),
        linkCount: document.querySelectorAll('a').length,
        inputCount: document.querySelectorAll('input').length,
      };
    });

    expect(structure.hasNav).toBe(true);
    expect(structure.hasMain).toBe(true);
    expect(structure.hasForm).toBe(true);
    expect(structure.linkCount).toBe(2);
    expect(structure.inputCount).toBe(1);
  });
});

describe('Error Handling', () => {
  it('handles navigation timeout gracefully', async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto('http://localhost:99999', { timeout: 1000 });
    } catch (error) {
      expect(error).toBeDefined();
    }

    await browser.close();
  });

  it('handles missing elements', async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent('<html><body></body></html>');

    const element = await page.$('#nonexistent');
    expect(element).toBeNull();

    await browser.close();
  });
});
