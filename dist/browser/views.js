import fs from 'node:fs';
import path from 'node:path';
import { DOMState } from '../dom/views.js';
export const PLACEHOLDER_4PX_SCREENSHOT = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGP8//8/AwwwMSAB3BwAlm4DBfIlvvkAAAAASUVORK5CYII=';
export class BrowserStateSummary extends DOMState {
    url;
    title;
    tabs;
    screenshot;
    page_info;
    pixels_above;
    pixels_below;
    browser_errors;
    is_pdf_viewer;
    loading_status;
    recent_events;
    pending_network_requests;
    pagination_buttons;
    closed_popup_messages;
    constructor(dom_state, init) {
        super(dom_state.element_tree, dom_state.selector_map);
        this.url = init.url;
        this.title = init.title;
        this.tabs = init.tabs;
        this.screenshot = init.screenshot ?? null;
        this.page_info = init.page_info ?? null;
        this.pixels_above = init.pixels_above ?? 0;
        this.pixels_below = init.pixels_below ?? 0;
        this.browser_errors = init.browser_errors ?? [];
        this.is_pdf_viewer = init.is_pdf_viewer ?? false;
        this.loading_status = init.loading_status ?? null;
        this.recent_events = init.recent_events ?? null;
        this.pending_network_requests = init.pending_network_requests ?? [];
        this.pagination_buttons = init.pagination_buttons ?? [];
        this.closed_popup_messages = init.closed_popup_messages ?? [];
    }
}
export class BrowserStateHistory {
    url;
    title;
    tabs;
    interacted_element;
    screenshot_path;
    constructor(url, title, tabs, interacted_element, screenshot_path = null) {
        this.url = url;
        this.title = title;
        this.tabs = tabs;
        this.interacted_element = interacted_element;
        this.screenshot_path = screenshot_path;
    }
    get_screenshot() {
        if (!this.screenshot_path) {
            return null;
        }
        const resolved = path.resolve(this.screenshot_path);
        if (!fs.existsSync(resolved)) {
            return null;
        }
        try {
            const data = fs.readFileSync(resolved);
            return data.toString('base64');
        }
        catch {
            return null;
        }
    }
    to_dict() {
        return {
            tabs: this.tabs,
            screenshot_path: this.screenshot_path,
            interacted_element: this.interacted_element.map((element) => element?.to_dict?.() ?? null),
            url: this.url,
            title: this.title,
        };
    }
}
export class BrowserError extends Error {
    short_term_memory;
    long_term_memory;
    details;
    while_handling_event;
    constructor(messageOrInit, options) {
        const init = typeof messageOrInit === 'string'
            ? { message: messageOrInit, ...(options ?? {}) }
            : messageOrInit;
        super(init.message);
        this.name = 'BrowserError';
        this.short_term_memory = init.short_term_memory ?? null;
        this.long_term_memory = init.long_term_memory ?? null;
        this.details = init.details ?? null;
        this.while_handling_event = init.event ?? null;
    }
    toString() {
        if (this.details) {
            return `${this.message} (${JSON.stringify(this.details)})`;
        }
        if (this.while_handling_event) {
            return `${this.message} (while handling: ${String(this.while_handling_event)})`;
        }
        return this.message;
    }
}
export class URLNotAllowedError extends BrowserError {
}
