import type { BrowserSession } from '../browser/session.js';
import type { MouseButton } from '../browser/events.js';
export declare class Mouse {
    private readonly browser_session;
    private readonly pageRef;
    constructor(browser_session: BrowserSession, pageRef?: any | null);
    private _page;
    click(x: number, y: number, options?: {
        button?: MouseButton;
        click_count?: number;
    }): Promise<void>;
    move(x: number, y: number): Promise<void>;
    down(options?: {
        button?: MouseButton;
    }): Promise<void>;
    up(options?: {
        button?: MouseButton;
    }): Promise<void>;
}
