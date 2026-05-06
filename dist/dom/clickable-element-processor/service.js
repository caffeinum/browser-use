import crypto from 'node:crypto';
import { DOMElementNode } from '../views.js';
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
export class ClickableElementProcessor {
    static get_clickable_elements_hashes(dom_element) {
        const hashes = new Set();
        for (const element of this.get_clickable_elements(dom_element)) {
            hashes.add(this.hash_dom_element(element));
        }
        return hashes;
    }
    static get_clickable_elements(dom_element) {
        const elements = [];
        const traverse = (node) => {
            for (const child of node.children) {
                if (child instanceof DOMElementNode) {
                    if (child.highlight_index !== null &&
                        child.highlight_index !== undefined) {
                        elements.push(child);
                    }
                    traverse(child);
                }
            }
        };
        traverse(dom_element);
        return elements;
    }
    static hash_dom_element(dom_element) {
        const parent_branch_path = this._get_parent_branch_path(dom_element);
        const branch_path_hash = this._parent_branch_path_hash(parent_branch_path);
        const attributes_hash = this._attributes_hash(dom_element.attributes);
        const xpath_hash = this._xpath_hash(dom_element.xpath);
        return this._hash_string(`${branch_path_hash}-${attributes_hash}-${xpath_hash}`);
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
        return this._hash_string(attributes_string);
    }
    static _xpath_hash(xpath) {
        return this._hash_string(xpath);
    }
    static _hash_string(value) {
        return sha256(value);
    }
}
