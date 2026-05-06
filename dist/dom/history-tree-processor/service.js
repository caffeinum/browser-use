import crypto from 'node:crypto';
import { DOMHistoryElement, HashedDomElement } from './view.js';
import { DOMElementNode } from '../views.js';
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const STATIC_HASH_ATTRIBUTES = new Set([
    'class',
    'id',
    'name',
    'type',
    'placeholder',
    'aria-label',
    'title',
    'role',
    'data-testid',
    'data-test',
    'data-cy',
    'for',
    'required',
    'disabled',
    'readonly',
    'checked',
    'selected',
    'multiple',
    'href',
    'target',
    'rel',
    'aria-describedby',
    'aria-labelledby',
    'aria-controls',
    'aria-owns',
    'aria-live',
    'aria-atomic',
    'aria-busy',
    'aria-disabled',
    'aria-hidden',
    'aria-pressed',
    'aria-autocomplete',
    'aria-checked',
    'aria-selected',
    'list',
    'tabindex',
    'alt',
    'src',
    'lang',
    'itemscope',
    'itemtype',
    'itemprop',
    'aria-valuemin',
    'aria-valuemax',
    'aria-valuenow',
    'aria-placeholder',
]);
const DYNAMIC_CLASS_PATTERNS = [
    'focus',
    'hover',
    'active',
    'selected',
    'disabled',
    'animation',
    'transition',
    'loading',
    'open',
    'closed',
    'expanded',
    'collapsed',
    'visible',
    'hidden',
    'pressed',
    'checked',
    'highlighted',
    'current',
    'entering',
    'leaving',
];
export class HistoryTreeProcessor {
    static get_accessible_name(dom_element) {
        const ariaLabel = dom_element.attributes?.['aria-label']?.trim();
        if (ariaLabel) {
            return ariaLabel;
        }
        const title = dom_element.attributes?.title?.trim();
        if (title) {
            return title;
        }
        const text = dom_element.get_all_text_till_next_clickable_element().trim();
        return text ? text : null;
    }
    static compute_element_hash(dom_element) {
        return this._compute_element_hash(dom_element, false);
    }
    static compute_stable_hash(dom_element) {
        return this._compute_element_hash(dom_element, true);
    }
    static _filter_dynamic_classes(class_value) {
        const classes = class_value
            .split(/\s+/)
            .map((value) => value.trim())
            .filter(Boolean);
        const stable = classes.filter((cls) => !DYNAMIC_CLASS_PATTERNS.some((pattern) => cls.toLowerCase().includes(pattern)));
        return stable.sort().join(' ');
    }
    static _compute_element_hash(dom_element, stable) {
        const parent_branch_path = this._get_parent_branch_path(dom_element);
        const parent_branch_path_string = parent_branch_path.join('/');
        const normalized_attributes = Object.entries(dom_element.attributes ?? {})
            .filter(([key, value]) => {
            if (!STATIC_HASH_ATTRIBUTES.has(key)) {
                return false;
            }
            return String(value).trim().length > 0;
        })
            .map(([key, value]) => {
            if (stable && key === 'class') {
                const filtered = this._filter_dynamic_classes(String(value));
                return [key, filtered];
            }
            return [key, String(value)];
        })
            .filter(([, value]) => value.length > 0)
            .sort(([a], [b]) => a.localeCompare(b));
        const attributes_string = normalized_attributes
            .map(([key, value]) => `${key}=${value}`)
            .join('');
        const ax_name = this.get_accessible_name(dom_element);
        const ax_suffix = ax_name ? `|ax_name=${ax_name}` : '';
        const combined_string = `${parent_branch_path_string}|${attributes_string}${ax_suffix}`;
        return sha256(combined_string).slice(0, 16);
    }
    static convert_dom_element_to_history_element(dom_element, css_selector = null) {
        const parent_branch_path = this._get_parent_branch_path(dom_element);
        const axName = this.get_accessible_name(dom_element);
        const elementHash = this.compute_element_hash(dom_element);
        const stableHash = this.compute_stable_hash(dom_element);
        return new DOMHistoryElement(dom_element.tag_name, dom_element.xpath, dom_element.highlight_index ?? null, parent_branch_path, dom_element.attributes, dom_element.shadow_root, css_selector, dom_element.page_coordinates, dom_element.viewport_coordinates, dom_element.viewport_info, elementHash, stableHash, axName);
    }
    static find_history_element_in_tree(dom_history_element, tree) {
        const process_node = (node, matcher) => {
            if (node.highlight_index !== null &&
                node.highlight_index !== undefined &&
                matcher(node)) {
                return node;
            }
            for (const child of node.children) {
                if (!(child instanceof DOMElementNode)) {
                    continue;
                }
                const result = process_node(child, matcher);
                if (result) {
                    return result;
                }
            }
            return null;
        };
        if (dom_history_element.element_hash) {
            const exact = process_node(tree, (candidate) => this.compute_element_hash(candidate) ===
                dom_history_element.element_hash);
            if (exact) {
                return exact;
            }
        }
        if (dom_history_element.stable_hash) {
            const stable = process_node(tree, (candidate) => this.compute_stable_hash(candidate) ===
                dom_history_element.stable_hash);
            if (stable) {
                return stable;
            }
        }
        const hashed = this._hash_dom_history_element(dom_history_element);
        return process_node(tree, (candidate) => {
            const hashed_node = this._hash_dom_element(candidate);
            return hashed_node.equals(hashed);
        });
    }
    static compare_history_element_and_dom_element(dom_history_element, dom_element) {
        if (dom_history_element.element_hash) {
            if (this.compute_element_hash(dom_element) ===
                dom_history_element.element_hash) {
                return true;
            }
        }
        if (dom_history_element.stable_hash) {
            if (this.compute_stable_hash(dom_element) ===
                dom_history_element.stable_hash) {
                return true;
            }
        }
        const hashed_history = this._hash_dom_history_element(dom_history_element);
        const hashed_dom = this._hash_dom_element(dom_element);
        return hashed_history.equals(hashed_dom);
    }
    static _hash_dom_history_element(dom_history_element) {
        const branch_path_hash = this._parent_branch_path_hash(dom_history_element.entire_parent_branch_path);
        const attributes_hash = this._attributes_hash(dom_history_element.attributes);
        const xpath_hash = this._xpath_hash(dom_history_element.xpath);
        return new HashedDomElement(branch_path_hash, attributes_hash, xpath_hash);
    }
    static _hash_dom_element(dom_element) {
        const parent_branch_path = this._get_parent_branch_path(dom_element);
        const branch_path_hash = this._parent_branch_path_hash(parent_branch_path);
        const attributes_hash = this._attributes_hash(dom_element.attributes);
        const xpath_hash = this._xpath_hash(dom_element.xpath);
        return new HashedDomElement(branch_path_hash, attributes_hash, xpath_hash);
    }
    static _get_parent_branch_path(dom_element) {
        const parents = [];
        let current = dom_element;
        while (current && current.parent) {
            parents.push(current);
            current = current.parent;
        }
        parents.reverse();
        return parents.map((parent) => parent.tag_name);
    }
    static _parent_branch_path_hash(parent_branch_path) {
        return sha256(parent_branch_path.join('/'));
    }
    static _attributes_hash(attributes) {
        const attributes_string = Object.entries(attributes)
            .map(([key, value]) => `${key}=${value}`)
            .join('');
        return sha256(attributes_string);
    }
    static _xpath_hash(xpath) {
        return sha256(xpath);
    }
    static _text_hash(dom_element) {
        const text = dom_element.get_all_text_till_next_clickable_element();
        return sha256(text);
    }
}
