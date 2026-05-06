import { cap_text_length } from './utils.js';
import { time_execution_sync } from '../utils.js';
import { HistoryTreeProcessor } from './history-tree-processor/service.js';
export class DOMBaseNode {
    is_visible;
    parent;
    constructor(is_visible, parent = null) {
        this.is_visible = is_visible;
        this.parent = parent;
    }
}
export class DOMTextNode extends DOMBaseNode {
    text;
    type = 'TEXT_NODE';
    constructor(is_visible, parent, text) {
        super(is_visible, parent);
        this.text = text;
    }
    has_parent_with_highlight_index() {
        let current = this.parent;
        while (current) {
            if (current.highlight_index !== null &&
                current.highlight_index !== undefined) {
                return true;
            }
            current = current.parent;
        }
        return false;
    }
    is_parent_in_viewport() {
        return Boolean(this.parent?.is_in_viewport);
    }
    is_parent_top_element() {
        return Boolean(this.parent?.is_top_element);
    }
    toJSON() {
        return {
            text: this.text,
            type: this.type,
        };
    }
}
export const DEFAULT_INCLUDE_ATTRIBUTES = [
    'title',
    'type',
    'checked',
    'id',
    'name',
    'role',
    'value',
    'placeholder',
    'data-date-format',
    'alt',
    'aria-label',
    'aria-expanded',
    'data-state',
    'aria-checked',
    'aria-valuemin',
    'aria-valuemax',
    'aria-valuenow',
    'aria-placeholder',
    'pattern',
    'min',
    'max',
    'minlength',
    'maxlength',
    'step',
    'accept',
    'multiple',
    'inputmode',
    'autocomplete',
    'aria-autocomplete',
    'list',
    'data-mask',
    'data-inputmask',
    'data-datepicker',
    'format',
    'expected_format',
    'contenteditable',
    'pseudo',
    'checked',
    'selected',
    'expanded',
    'pressed',
    'disabled',
    'invalid',
    'valuemin',
    'valuemax',
    'valuenow',
    'keyshortcuts',
    'haspopup',
    'multiselectable',
    'required',
    'valuetext',
    'level',
    'busy',
    'live',
    'ax_name',
];
export class DOMElementNode extends DOMBaseNode {
    tag_name;
    xpath;
    attributes;
    children;
    is_interactive = false;
    is_top_element = false;
    is_in_viewport = false;
    shadow_root = false;
    highlight_index = null;
    viewport_coordinates = null;
    page_coordinates = null;
    viewport_info = null;
    is_new = null;
    cached_hash = null;
    constructor(is_visible, parent, tag_name, xpath, attributes, children) {
        super(is_visible, parent);
        this.tag_name = tag_name;
        this.xpath = xpath;
        this.attributes = attributes;
        this.children = children;
    }
    toJSON() {
        return {
            tag_name: this.tag_name,
            xpath: this.xpath,
            attributes: this.attributes,
            is_visible: this.is_visible,
            is_interactive: this.is_interactive,
            is_top_element: this.is_top_element,
            is_in_viewport: this.is_in_viewport,
            shadow_root: this.shadow_root,
            highlight_index: this.highlight_index,
            viewport_coordinates: this.viewport_coordinates,
            page_coordinates: this.page_coordinates,
            children: this.children.map((child) => child.toJSON()),
        };
    }
    toString() {
        let tag_str = `<${this.tag_name}`;
        for (const [key, value] of Object.entries(this.attributes)) {
            tag_str += ` ${key}="${value}"`;
        }
        tag_str += '>';
        const extras = [];
        if (this.is_interactive)
            extras.push('interactive');
        if (this.is_top_element)
            extras.push('top');
        if (this.shadow_root)
            extras.push('shadow-root');
        if (this.highlight_index !== null && this.highlight_index !== undefined) {
            extras.push(`highlight:${this.highlight_index}`);
        }
        if (this.is_in_viewport)
            extras.push('in-viewport');
        if (extras.length) {
            tag_str += ` [${extras.join(', ')}]`;
        }
        return tag_str;
    }
    get hash() {
        if (!this.cached_hash) {
            this.cached_hash = HistoryTreeProcessor._hash_dom_element(this);
        }
        return this.cached_hash;
    }
    get_all_text_till_next_clickable_element(max_depth = -1) {
        const text_parts = [];
        const collect_text = (node, current_depth) => {
            if (max_depth !== -1 && current_depth > max_depth) {
                return;
            }
            if (node instanceof DOMElementNode &&
                node !== this &&
                node.highlight_index !== null &&
                node.highlight_index !== undefined) {
                return;
            }
            if (node instanceof DOMTextNode) {
                text_parts.push(node.text);
            }
            else if (node instanceof DOMElementNode) {
                for (const child of node.children) {
                    collect_text(child, current_depth + 1);
                }
            }
        };
        collect_text(this, 0);
        return text_parts.join('\n').trim();
    }
    clickable_elements_to_string(include_attributes) {
        return CLICKABLE_ELEMENTS_TO_STRING_IMPL.call(this, include_attributes);
    }
}
const CLICKABLE_ELEMENTS_TO_STRING_IMPL = time_execution_sync('--clickable_elements_to_string')(function (include_attributes) {
    const formatted_text = [];
    const attributes_list = include_attributes ?? DEFAULT_INCLUDE_ATTRIBUTES;
    const process_node = (node, depth) => {
        const next_depth = depth;
        const depth_str = '\t'.repeat(depth);
        if (node instanceof DOMElementNode) {
            let working_depth = next_depth;
            if (node.highlight_index !== null && node.highlight_index !== undefined) {
                working_depth += 1;
                let text = node.get_all_text_till_next_clickable_element();
                let attributes_html_str = null;
                if (attributes_list.length) {
                    const attributes_to_include = Object.fromEntries(Object.entries(node.attributes)
                        .filter(([key, value]) => attributes_list.includes(key) && String(value).trim() !== '')
                        .map(([key, value]) => [key, String(value).trim()]));
                    const ordered_keys = attributes_list.filter((key) => key in attributes_to_include);
                    if (ordered_keys.length > 1) {
                        const keys_to_remove = new Set();
                        const seen_values = {};
                        for (const key of ordered_keys) {
                            const value = attributes_to_include[key];
                            if (value && value.length > 5) {
                                if (seen_values[value]) {
                                    keys_to_remove.add(key);
                                }
                                else {
                                    seen_values[value] = key;
                                }
                            }
                        }
                        for (const key of keys_to_remove) {
                            delete attributes_to_include[key];
                        }
                    }
                    if (node.tag_name === attributes_to_include.role) {
                        delete attributes_to_include.role;
                    }
                    for (const attr of ['aria-label', 'placeholder', 'title']) {
                        if (attributes_to_include[attr] &&
                            attributes_to_include[attr].trim().toLowerCase() ===
                                text.trim().toLowerCase()) {
                            delete attributes_to_include[attr];
                        }
                    }
                    if (Object.entries(attributes_to_include).length) {
                        attributes_html_str = Object.entries(attributes_to_include)
                            .map(([key, value]) => `${key}=${cap_text_length(value, 15)}`)
                            .join(' ');
                    }
                }
                const highlight_indicator = node.is_new
                    ? `*[${node.highlight_index}]`
                    : `[${node.highlight_index}]`;
                let line = `${depth_str}${highlight_indicator}<${node.tag_name}`;
                if (attributes_html_str) {
                    line += ` ${attributes_html_str}`;
                }
                if (text) {
                    text = text.trim();
                    if (!attributes_html_str) {
                        line += ' ';
                    }
                    line += `>${text}`;
                }
                else if (!attributes_html_str) {
                    line += ' ';
                }
                line += ' />';
                formatted_text.push(line);
            }
            for (const child of node.children) {
                process_node(child, working_depth);
            }
        }
        else if (node instanceof DOMTextNode) {
            if (node.has_parent_with_highlight_index()) {
                return;
            }
            if (node.parent?.is_visible && node.parent.is_top_element) {
                formatted_text.push(`${depth_str}${node.text}`);
            }
        }
    };
    process_node(this, 0);
    return formatted_text.join('\n');
});
export class DOMState {
    element_tree;
    selector_map;
    constructor(element_tree, selector_map) {
        this.element_tree = element_tree;
        this.selector_map = selector_map;
    }
    llm_representation(include_attributes) {
        return this.element_tree.clickable_elements_to_string(include_attributes);
    }
}
