export class HashedDomElement {
    branch_path_hash;
    attributes_hash;
    xpath_hash;
    constructor(branch_path_hash, attributes_hash, xpath_hash) {
        this.branch_path_hash = branch_path_hash;
        this.attributes_hash = attributes_hash;
        this.xpath_hash = xpath_hash;
    }
    /**
     * Check equality with another HashedDomElement
     */
    equals(other) {
        return (this.branch_path_hash === other.branch_path_hash &&
            this.attributes_hash === other.attributes_hash &&
            this.xpath_hash === other.xpath_hash);
    }
}
export class DOMHistoryElement {
    tag_name;
    xpath;
    highlight_index;
    entire_parent_branch_path;
    attributes;
    shadow_root;
    css_selector;
    page_coordinates;
    viewport_coordinates;
    viewport_info;
    element_hash;
    stable_hash;
    ax_name;
    constructor(tag_name, xpath, highlight_index, entire_parent_branch_path, attributes, shadow_root = false, css_selector = null, page_coordinates = null, viewport_coordinates = null, viewport_info = null, element_hash = null, stable_hash = null, ax_name = null) {
        this.tag_name = tag_name;
        this.xpath = xpath;
        this.highlight_index = highlight_index;
        this.entire_parent_branch_path = entire_parent_branch_path;
        this.attributes = attributes;
        this.shadow_root = shadow_root;
        this.css_selector = css_selector;
        this.page_coordinates = page_coordinates;
        this.viewport_coordinates = viewport_coordinates;
        this.viewport_info = viewport_info;
        this.element_hash = element_hash;
        this.stable_hash = stable_hash;
        this.ax_name = ax_name;
    }
    to_dict() {
        return {
            tag_name: this.tag_name,
            xpath: this.xpath,
            highlight_index: this.highlight_index,
            entire_parent_branch_path: this.entire_parent_branch_path,
            attributes: this.attributes,
            shadow_root: this.shadow_root,
            css_selector: this.css_selector,
            page_coordinates: this.page_coordinates,
            viewport_coordinates: this.viewport_coordinates,
            viewport_info: this.viewport_info,
            element_hash: this.element_hash,
            stable_hash: this.stable_hash,
            ax_name: this.ax_name,
        };
    }
}
