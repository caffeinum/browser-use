import { DOMState } from '../dom/views.js';
import type { DOMHistoryElement } from '../dom/history-tree-processor/view.js';
export declare const PLACEHOLDER_4PX_SCREENSHOT = "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGP8//8/AwwwMSAB3BwAlm4DBfIlvvkAAAAASUVORK5CYII=";
export interface TabInfo {
    page_id: number;
    tab_id?: string;
    target_id?: string;
    url: string;
    title: string;
    parent_page_id?: number | null;
}
export interface PageInfo {
    viewport_width: number;
    viewport_height: number;
    page_width: number;
    page_height: number;
    scroll_x: number;
    scroll_y: number;
    pixels_above: number;
    pixels_below: number;
    pixels_left: number;
    pixels_right: number;
}
export interface NetworkRequest {
    url: string;
    method?: string;
    loading_duration_ms?: number;
    resource_type?: string | null;
}
export interface PaginationButton {
    button_type: string;
    backend_node_id: number;
    text: string;
    selector: string;
    is_disabled?: boolean;
}
interface BrowserStateSummaryInit {
    url: string;
    title: string;
    tabs: TabInfo[];
    screenshot?: string | null;
    page_info?: PageInfo | null;
    pixels_above?: number;
    pixels_below?: number;
    browser_errors?: string[];
    is_pdf_viewer?: boolean;
    loading_status?: string | null;
    recent_events?: string | null;
    pending_network_requests?: NetworkRequest[];
    pagination_buttons?: PaginationButton[];
    closed_popup_messages?: string[];
}
export declare class BrowserStateSummary extends DOMState {
    url: string;
    title: string;
    tabs: TabInfo[];
    screenshot: string | null;
    page_info: PageInfo | null;
    pixels_above: number;
    pixels_below: number;
    browser_errors: string[];
    is_pdf_viewer: boolean;
    loading_status: string | null;
    recent_events: string | null;
    pending_network_requests: NetworkRequest[];
    pagination_buttons: PaginationButton[];
    closed_popup_messages: string[];
    constructor(dom_state: DOMState, init: BrowserStateSummaryInit);
}
export declare class BrowserStateHistory {
    url: string;
    title: string;
    tabs: TabInfo[];
    interacted_element: Array<DOMHistoryElement | null>;
    screenshot_path: string | null;
    constructor(url: string, title: string, tabs: TabInfo[], interacted_element: Array<DOMHistoryElement | null>, screenshot_path?: string | null);
    get_screenshot(): string | null;
    to_dict(): {
        tabs: TabInfo[];
        screenshot_path: string | null;
        interacted_element: ({
            tag_name: string;
            xpath: string;
            highlight_index: number | null;
            entire_parent_branch_path: string[];
            attributes: Record<string, string>;
            shadow_root: boolean;
            css_selector: string | null;
            page_coordinates: import("../index.js").CoordinateSet | null;
            viewport_coordinates: import("../index.js").CoordinateSet | null;
            viewport_info: import("../index.js").ViewportInfo | null;
            element_hash: string | null;
            stable_hash: string | null;
            ax_name: string | null;
        } | null)[];
        url: string;
        title: string;
    };
}
export interface BrowserErrorInit {
    message: string;
    short_term_memory?: string | null;
    long_term_memory?: string | null;
    details?: Record<string, unknown> | null;
    event?: unknown;
}
export declare class BrowserError extends Error {
    short_term_memory: string | null;
    long_term_memory: string | null;
    details: Record<string, unknown> | null;
    while_handling_event: unknown;
    constructor(messageOrInit: string | BrowserErrorInit, options?: Omit<BrowserErrorInit, 'message'>);
    toString(): string;
}
export declare class URLNotAllowedError extends BrowserError {
}
export {};
