import { DOMElementNode } from '../dom/views.js';
const normalizeBoolLike = (value) => {
    const normalized = String(value ?? '')
        .trim()
        .toLowerCase();
    return normalized === 'true' || normalized === 'checked' || normalized === '';
};
const summarizeText = (text, maxLength = 30) => {
    const compact = text.replace(/\s+/g, ' ').trim();
    if (!compact) {
        return '';
    }
    return compact.length > maxLength
        ? `${compact.slice(0, maxLength)}...`
        : compact;
};
export const getClickDescription = (node) => {
    const parts = [node.tag_name];
    const inputType = node.attributes.type;
    if (node.tag_name === 'input' && inputType) {
        parts.push(`type=${inputType}`);
        if (inputType === 'checkbox') {
            const isChecked = normalizeBoolLike(node.attributes.checked);
            parts.push(`checkbox-state=${isChecked ? 'checked' : 'unchecked'}`);
        }
    }
    const role = node.attributes.role;
    if (role) {
        parts.push(`role=${role}`);
        if (role === 'checkbox') {
            const isChecked = normalizeBoolLike(node.attributes['aria-checked']);
            parts.push(`checkbox-state=${isChecked ? 'checked' : 'unchecked'}`);
        }
    }
    if (['label', 'span', 'div'].includes(node.tag_name) &&
        !parts.some((part) => part.startsWith('type='))) {
        const hiddenCheckboxChild = node.children.find((child) => child instanceof DOMElementNode &&
            child.tag_name === 'input' &&
            child.attributes.type === 'checkbox' &&
            !child.is_visible);
        if (hiddenCheckboxChild) {
            const isChecked = normalizeBoolLike(hiddenCheckboxChild.attributes.checked);
            parts.push(`checkbox-state=${isChecked ? 'checked' : 'unchecked'}`);
        }
    }
    const text = summarizeText(node.get_all_text_till_next_clickable_element());
    if (text) {
        parts.push(`"${text}"`);
    }
    for (const attribute of ['id', 'name', 'aria-label']) {
        const value = node.attributes[attribute];
        if (value && value.trim().length > 0) {
            parts.push(`${attribute}=${value.slice(0, 20)}`);
        }
    }
    return parts.join(' ');
};
