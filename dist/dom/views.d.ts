import { CoordinateSet, HashedDomElement, ViewportInfo } from './history-tree-processor/view.js';
export declare abstract class DOMBaseNode {
    is_visible: boolean;
    parent: DOMElementNode | null;
    constructor(is_visible: boolean, parent?: DOMElementNode | null);
    abstract toJSON(): Record<string, unknown>;
}
export declare class DOMTextNode extends DOMBaseNode {
    text: string;
    type: string;
    constructor(is_visible: boolean, parent: DOMElementNode | null, text: string);
    has_parent_with_highlight_index(): boolean;
    is_parent_in_viewport(): boolean;
    is_parent_top_element(): boolean;
    toJSON(): {
        text: string;
        type: string;
    };
}
export declare const DEFAULT_INCLUDE_ATTRIBUTES: string[];
export declare class DOMElementNode extends DOMBaseNode {
    tag_name: string;
    xpath: string;
    attributes: Record<string, string>;
    children: DOMBaseNode[];
    is_interactive: boolean;
    is_top_element: boolean;
    is_in_viewport: boolean;
    shadow_root: boolean;
    highlight_index: number | null;
    viewport_coordinates: CoordinateSet | null;
    page_coordinates: CoordinateSet | null;
    viewport_info: ViewportInfo | null;
    is_new: boolean | null;
    private cached_hash;
    constructor(is_visible: boolean, parent: DOMElementNode | null, tag_name: string, xpath: string, attributes: Record<string, string>, children: DOMBaseNode[]);
    toJSON(): {
        tag_name: string;
        xpath: string;
        attributes: Record<string, string>;
        is_visible: boolean;
        is_interactive: boolean;
        is_top_element: boolean;
        is_in_viewport: boolean;
        shadow_root: boolean;
        highlight_index: number | null;
        viewport_coordinates: CoordinateSet | null;
        page_coordinates: CoordinateSet | null;
        children: Record<string, unknown>[];
    };
    toString(): string;
    get hash(): HashedDomElement;
    get_all_text_till_next_clickable_element(max_depth?: number): string;
    clickable_elements_to_string(include_attributes?: string[]): string;
}
export type SelectorMap = Record<number, DOMElementNode>;
export declare class DOMState {
    element_tree: DOMElementNode;
    selector_map: SelectorMap;
    constructor(element_tree: DOMElementNode, selector_map: SelectorMap);
    llm_representation(include_attributes?: string[]): string;
}
