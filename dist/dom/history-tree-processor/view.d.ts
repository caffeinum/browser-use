export declare class HashedDomElement {
    branch_path_hash: string;
    attributes_hash: string;
    xpath_hash: string;
    constructor(branch_path_hash: string, attributes_hash: string, xpath_hash: string);
    /**
     * Check equality with another HashedDomElement
     */
    equals(other: HashedDomElement): boolean;
}
export interface Coordinates {
    x: number;
    y: number;
}
export interface CoordinateSet {
    top_left: Coordinates;
    top_right: Coordinates;
    bottom_left: Coordinates;
    bottom_right: Coordinates;
    center: Coordinates;
    width: number;
    height: number;
}
export interface ViewportInfo {
    scroll_x?: number | null;
    scroll_y?: number | null;
    width: number;
    height: number;
}
export declare class DOMHistoryElement {
    tag_name: string;
    xpath: string;
    highlight_index: number | null;
    entire_parent_branch_path: string[];
    attributes: Record<string, string>;
    shadow_root: boolean;
    css_selector: string | null;
    page_coordinates: CoordinateSet | null;
    viewport_coordinates: CoordinateSet | null;
    viewport_info: ViewportInfo | null;
    element_hash: string | null;
    stable_hash: string | null;
    ax_name: string | null;
    constructor(tag_name: string, xpath: string, highlight_index: number | null, entire_parent_branch_path: string[], attributes: Record<string, string>, shadow_root?: boolean, css_selector?: string | null, page_coordinates?: CoordinateSet | null, viewport_coordinates?: CoordinateSet | null, viewport_info?: ViewportInfo | null, element_hash?: string | null, stable_hash?: string | null, ax_name?: string | null);
    to_dict(): {
        tag_name: string;
        xpath: string;
        highlight_index: number | null;
        entire_parent_branch_path: string[];
        attributes: Record<string, string>;
        shadow_root: boolean;
        css_selector: string | null;
        page_coordinates: CoordinateSet | null;
        viewport_coordinates: CoordinateSet | null;
        viewport_info: ViewportInfo | null;
        element_hash: string | null;
        stable_hash: string | null;
        ax_name: string | null;
    };
}
