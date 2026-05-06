import { DOMHistoryElement, HashedDomElement } from './view.js';
import { DOMElementNode } from '../views.js';
export declare class HistoryTreeProcessor {
    static get_accessible_name(dom_element: DOMElementNode): string | null;
    static compute_element_hash(dom_element: DOMElementNode): string;
    static compute_stable_hash(dom_element: DOMElementNode): string;
    static _filter_dynamic_classes(class_value: string): string;
    static _compute_element_hash(dom_element: DOMElementNode, stable: boolean): string;
    static convert_dom_element_to_history_element(dom_element: DOMElementNode, css_selector?: string | null): DOMHistoryElement;
    static find_history_element_in_tree(dom_history_element: DOMHistoryElement, tree: DOMElementNode): DOMElementNode | null;
    static compare_history_element_and_dom_element(dom_history_element: DOMHistoryElement, dom_element: DOMElementNode): boolean;
    static _hash_dom_history_element(dom_history_element: DOMHistoryElement): HashedDomElement;
    static _hash_dom_element(dom_element: DOMElementNode): HashedDomElement;
    static _get_parent_branch_path(dom_element: DOMElementNode): string[];
    static _parent_branch_path_hash(parent_branch_path: string[]): string;
    static _attributes_hash(attributes: Record<string, string>): string;
    static _xpath_hash(xpath: string): string;
    static _text_hash(dom_element: DOMElementNode): string;
}
