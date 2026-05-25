import { describe, expect, it, vi } from 'vitest';
import { Element, Page, Mouse, Utils } from '../src/actor/index.js';
import { BrowserProfile } from '../src/browser/profile.js';
import { BrowserSession } from '../src/browser/session.js';
import { URLNotAllowedError } from '../src/browser/views.js';
import { DOMElementNode } from '../src/dom/views.js';

describe('actor alignment', () => {
  it('routes page navigation and key press through BrowserSession helpers', async () => {
    const session = new BrowserSession();
    const page = new Page(session);

    const navigateSpy = vi
      .spyOn(session, 'navigate_to')
      .mockResolvedValue(null as any);
    const keySpy = vi.spyOn(session, 'send_keys').mockResolvedValue();

    await page.goto('https://example.com', {
      wait_until: 'networkidle',
      timeout_ms: 2500,
    });
    await page.press('Control+A');

    expect(navigateSpy).toHaveBeenCalledWith('https://example.com', {
      wait_until: 'networkidle',
      timeout_ms: 2500,
    });
    expect(keySpy).toHaveBeenCalledWith('Control+A');
  });

  it('creates Element wrappers from index lookups and delegates click/fill', async () => {
    const session = new BrowserSession();
    const page = new Page(session);

    const node = new DOMElementNode(
      true,
      null,
      'input',
      '/html/body/input[1]',
      { type: 'text' },
      []
    );

    vi.spyOn(session, 'get_dom_element_by_index').mockResolvedValue(node);
    const clickSpy = vi
      .spyOn(session, '_click_element_node')
      .mockResolvedValue(null);
    const fillSpy = vi
      .spyOn(session, '_input_text_element_node')
      .mockResolvedValue(undefined);

    const element = await page.must_get_element_by_index(5);
    await element.click();
    await element.fill('hello', false);

    expect(clickSpy).toHaveBeenCalledWith(node);
    expect(fillSpy).toHaveBeenCalledWith(node, 'hello', { clear: false });
  });

  it('uses Mouse.click to route coordinate clicks through BrowserSession', async () => {
    const session = new BrowserSession();
    const mouse = new Mouse(session);
    const clickSpy = vi.spyOn(session, 'click_coordinates').mockResolvedValue();

    await mouse.click(100, 200, { button: 'right' });

    expect(clickSpy).toHaveBeenCalledWith(100, 200, { button: 'right' });
  });

  it('rolls back disallowed navigations from Element.hover', async () => {
    const session = new BrowserSession({
      browser_profile: new BrowserProfile({
        allowed_domains: ['https://example.com'],
      }),
    });
    let pageUrl = 'https://example.com/form';
    const rawPage = {
      goto: vi.fn(async (url: string) => {
        pageUrl = url;
      }),
      title: vi.fn(async () => pageUrl),
      url: vi.fn(() => pageUrl),
      waitForLoadState: vi.fn(async () => {}),
    };
    const locator = {
      hover: vi.fn(async () => {
        pageUrl = 'https://evil.test/from-element-hover?token=secret';
      }),
    };
    vi.spyOn(session, 'get_current_page').mockResolvedValue(rawPage as any);
    vi.spyOn(session, 'get_locate_element').mockResolvedValue(locator as any);

    const node = new DOMElementNode(
      true,
      null,
      'button',
      '/html/body/button[1]',
      {},
      []
    );
    const element = new Element(session, node);

    await expect(element.hover()).rejects.toBeInstanceOf(URLNotAllowedError);
    expect(rawPage.goto).toHaveBeenCalledWith(
      'about:blank',
      expect.objectContaining({ waitUntil: 'load' })
    );
    expect(session.active_tab?.url).toBe('about:blank');
  });

  it.each([
    ['move', async (mouse: Mouse) => mouse.move(100, 200)],
    ['down', async (mouse: Mouse) => mouse.down({ button: 'left' })],
    ['up', async (mouse: Mouse) => mouse.up({ button: 'left' })],
  ])('rolls back disallowed navigations from Mouse.%s', async (_name, run) => {
    const session = new BrowserSession({
      browser_profile: new BrowserProfile({
        allowed_domains: ['https://example.com'],
      }),
    });
    let pageUrl = 'https://example.com/start';
    const rawPage = {
      goto: vi.fn(async (url: string) => {
        pageUrl = url;
      }),
      mouse: {
        down: vi.fn(async () => {
          pageUrl = 'https://evil.test/from-mouse-down?token=secret';
        }),
        move: vi.fn(async () => {
          pageUrl = 'https://evil.test/from-mouse-move?token=secret';
        }),
        up: vi.fn(async () => {
          pageUrl = 'https://evil.test/from-mouse-up?token=secret';
        }),
      },
      title: vi.fn(async () => pageUrl),
      url: vi.fn(() => pageUrl),
      waitForLoadState: vi.fn(async () => {}),
    };
    vi.spyOn(session, 'get_current_page').mockResolvedValue(rawPage as any);

    const mouse = new Mouse(session);

    await expect(run(mouse)).rejects.toBeInstanceOf(URLNotAllowedError);
    expect(rawPage.goto).toHaveBeenCalledWith(
      'about:blank',
      expect.objectContaining({ waitUntil: 'load' })
    );
    expect(session.active_tab?.url).toBe('about:blank');
  });

  it('rolls back disallowed navigations from Page.evaluate', async () => {
    const session = new BrowserSession({
      browser_profile: new BrowserProfile({
        allowed_domains: ['https://example.com'],
      }),
    });
    let pageUrl = 'https://example.com/start';
    const rawPage = {
      evaluate: vi.fn(async () => {
        pageUrl = 'https://evil.test/from-page-evaluate?token=secret';
        return 'ok';
      }),
      goto: vi.fn(async (url: string) => {
        pageUrl = url;
      }),
      title: vi.fn(async () => pageUrl),
      url: vi.fn(() => pageUrl),
      waitForLoadState: vi.fn(async () => {}),
    };
    vi.spyOn(session, 'get_current_page').mockResolvedValue(rawPage as any);

    const page = new Page(session);

    await expect(page.evaluate('() => "ok"')).rejects.toBeInstanceOf(
      URLNotAllowedError
    );
    expect(rawPage.goto).toHaveBeenCalledWith(
      'about:blank',
      expect.objectContaining({ waitUntil: 'load' })
    );
    expect(session.active_tab?.url).toBe('about:blank');
  });

  it('rolls back disallowed navigations from Element.evaluate', async () => {
    const session = new BrowserSession({
      browser_profile: new BrowserProfile({
        allowed_domains: ['https://example.com'],
      }),
    });
    let pageUrl = 'https://example.com/form';
    const rawPage = {
      evaluate: vi.fn(),
      goto: vi.fn(async (url: string) => {
        pageUrl = url;
      }),
      title: vi.fn(async () => pageUrl),
      url: vi.fn(() => pageUrl),
      waitForLoadState: vi.fn(async () => {}),
    };
    const locator = {
      evaluate: vi.fn(async () => {
        pageUrl = 'https://evil.test/from-element-evaluate?token=secret';
        return 'ok';
      }),
    };
    vi.spyOn(session, 'get_current_page').mockResolvedValue(rawPage as any);
    vi.spyOn(session, 'get_locate_element').mockResolvedValue(locator as any);

    const node = new DOMElementNode(
      true,
      null,
      'button',
      '/html/body/button[1]',
      {},
      []
    );
    const element = new Element(session, node);

    await expect(element.evaluate('() => "ok"')).rejects.toBeInstanceOf(
      URLNotAllowedError
    );
    expect(rawPage.goto).toHaveBeenCalledWith(
      'about:blank',
      expect.objectContaining({ waitUntil: 'load' })
    );
    expect(session.active_tab?.url).toBe('about:blank');
  });

  it('maps key metadata with python-aligned get_key_info helper', () => {
    expect(Utils.get_key_info('Enter')).toEqual(['Enter', 13]);
    expect(Utils.get_key_info('a')).toEqual(['KeyA', 65]);
    expect(Utils.get_key_info('7')).toEqual(['Digit7', 55]);
  });
});
