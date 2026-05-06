import type { WaitUntilState } from '../browser/events.js';
import type { BrowserSession } from '../browser/session.js';
import { Element } from './element.js';
import { Mouse } from './mouse.js';
export declare class Page {
    private readonly browser_session;
    private _mouse;
    constructor(browser_session: BrowserSession);
    get mouse(): Mouse;
    _currentPage(): Promise<import("playwright").Page>;
    get_url(): Promise<string>;
    get_title(): Promise<string>;
    goto(url: string, options?: {
        wait_until?: WaitUntilState;
        timeout_ms?: number | null;
    }): Promise<void>;
    navigate(url: string, options?: Parameters<Page['goto']>[1]): Promise<void>;
    reload(): Promise<void>;
    go_back(): Promise<void>;
    go_forward(): Promise<void>;
    evaluate(page_function: string | ((...args: unknown[]) => unknown), ...args: unknown[]): Promise<unknown>;
    screenshot(options?: {
        full_page?: boolean;
    }): Promise<string | null>;
    press(key: string): Promise<void>;
    set_viewport_size(width: number, height: number): Promise<void>;
    get_element_by_index(index: number): Promise<Element | null>;
    must_get_element_by_index(index: number): Promise<Element>;
}
