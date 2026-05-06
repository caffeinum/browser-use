import type { Page } from '../browser/types.js';
import { DOMState, type SelectorMap } from './views.js';
import type { PaginationButton } from '../browser/views.js';
export declare class DomService {
    private readonly page;
    private readonly logger;
    private readonly jsCode;
    constructor(page: Page, logger?: import("../logging-config.js").Logger);
    get_clickable_elements(highlight_elements?: boolean, focus_element?: number, viewport_expansion?: number): Promise<DOMState>;
    get_cross_origin_iframes(): Promise<any>;
    private _build_dom_tree;
    private _construct_dom_tree;
    private _parse_node;
    private safeHostname;
    private getFrames;
    private getFrameUrl;
    private isAdUrl;
    private getPageUrl;
    private isDebugEnabled;
    static detect_pagination_buttons(selector_map: SelectorMap): PaginationButton[];
}
