import { DOMElementNode } from '../views.js';
export declare class ClickableElementProcessor {
    static get_clickable_elements_hashes(dom_element: DOMElementNode): Set<string>;
    static get_clickable_elements(dom_element: DOMElementNode): DOMElementNode[];
    static hash_dom_element(dom_element: DOMElementNode): string;
    private static _get_parent_branch_path;
    private static _parent_branch_path_hash;
    private static _attributes_hash;
    private static _xpath_hash;
    private static _hash_string;
}
