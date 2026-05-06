import type { BrowserSession } from '../browser/session.js';
import type { DOMElementNode } from '../dom/views.js';
export declare class Element {
    private readonly browser_session;
    readonly node: DOMElementNode;
    constructor(browser_session: BrowserSession, node: DOMElementNode);
    click(): Promise<string | null>;
    fill(value: string, clear?: boolean): Promise<void>;
    hover(): Promise<void>;
    get_attribute(name: string): Promise<string>;
    get_bounding_box(): Promise<{
        x: number;
        y: number;
        width: number;
        height: number;
    } | null>;
    select_option(values: string | string[]): Promise<void>;
    evaluate(page_function: string, ...args: unknown[]): Promise<any>;
}
