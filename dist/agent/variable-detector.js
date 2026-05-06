import { DetectedVariable as DetectedVariableModel } from './views.js';
const ACTION_FIELDS_TO_CHECK = ['text', 'query'];
const getActionPayload = (action) => {
    if (action && typeof action.model_dump === 'function') {
        return action.model_dump();
    }
    if (action && typeof action === 'object' && !Array.isArray(action)) {
        return action;
    }
    return {};
};
const ensureUniqueName = (baseName, existing) => {
    if (!(baseName in existing)) {
        return baseName;
    }
    let counter = 2;
    while (`${baseName}_${counter}` in existing) {
        counter += 1;
    }
    return `${baseName}_${counter}`;
};
const detectFromAttributes = (attributes) => {
    const inputType = String(attributes.type ?? '').toLowerCase();
    if (inputType === 'email')
        return ['email', 'email'];
    if (inputType === 'tel')
        return ['phone', 'phone'];
    if (inputType === 'date')
        return ['date', 'date'];
    if (inputType === 'number')
        return ['number', 'number'];
    if (inputType === 'url')
        return ['url', 'url'];
    const semanticFields = [
        attributes.id ?? '',
        attributes.name ?? '',
        attributes.placeholder ?? '',
        attributes['aria-label'] ?? '',
    ];
    const combined = semanticFields.join(' ').toLowerCase();
    if (['address', 'street', 'addr'].some((needle) => combined.includes(needle))) {
        if (combined.includes('billing'))
            return ['billing_address', null];
        if (combined.includes('shipping'))
            return ['shipping_address', null];
        return ['address', null];
    }
    if (['comment', 'note', 'message', 'description'].some((needle) => combined.includes(needle))) {
        return ['comment', null];
    }
    if (combined.includes('email') || combined.includes('e-mail')) {
        return ['email', 'email'];
    }
    if (['phone', 'tel', 'mobile', 'cell'].some((needle) => combined.includes(needle))) {
        return ['phone', 'phone'];
    }
    if (combined.includes('first') && combined.includes('name')) {
        return ['first_name', null];
    }
    if (combined.includes('last') && combined.includes('name')) {
        return ['last_name', null];
    }
    if (combined.includes('full') && combined.includes('name')) {
        return ['full_name', null];
    }
    if (combined.includes('name')) {
        return ['name', null];
    }
    if (['date', 'dob', 'birth'].some((needle) => combined.includes(needle))) {
        return ['date', 'date'];
    }
    if (combined.includes('city'))
        return ['city', null];
    if (combined.includes('state') || combined.includes('province')) {
        return ['state', null];
    }
    if (combined.includes('country'))
        return ['country', null];
    if (['zip', 'postal', 'postcode'].some((needle) => combined.includes(needle))) {
        return ['zip_code', 'postal_code'];
    }
    if (combined.includes('company') || combined.includes('organization')) {
        return ['company', null];
    }
    return null;
};
const detectFromValuePattern = (value) => {
    if (/^[\w.-]+@[\w.-]+\.\w+$/.test(value)) {
        return ['email', 'email'];
    }
    if (/^[\d\s\-()+]+$/.test(value)) {
        const digitsOnly = value.replace(/[\s\-()+]/g, '');
        if (digitsOnly.length >= 10) {
            return ['phone', 'phone'];
        }
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return ['date', 'date'];
    }
    const stripped = value.replace(/[\s-]/g, '');
    if (value.length >= 2 &&
        value.length <= 30 &&
        value[0] === value[0].toUpperCase() &&
        /^[A-Za-z]+$/.test(stripped)) {
        const words = value.trim().split(/\s+/);
        if (words.length === 1)
            return ['first_name', null];
        if (words.length === 2)
            return ['full_name', null];
        return ['name', null];
    }
    if (/^\d{1,9}$/.test(value)) {
        return ['number', 'number'];
    }
    return null;
};
const detectVariableType = (value, element) => {
    const attrs = element?.attributes;
    if (attrs && typeof attrs === 'object') {
        const normalizedAttrs = Object.fromEntries(Object.entries(attrs).map(([key, attrValue]) => [key, String(attrValue)]));
        const attrMatch = detectFromAttributes(normalizedAttrs);
        if (attrMatch) {
            return attrMatch;
        }
    }
    return detectFromValuePattern(value);
};
const detectInAction = (actionPayload, element, detected, detectedValues) => {
    for (const params of Object.values(actionPayload)) {
        if (!params || typeof params !== 'object' || Array.isArray(params)) {
            continue;
        }
        for (const field of ACTION_FIELDS_TO_CHECK) {
            const value = params[field];
            if (typeof value !== 'string' || !value.trim()) {
                continue;
            }
            if (detectedValues.has(value)) {
                continue;
            }
            const variableInfo = detectVariableType(value, element);
            if (!variableInfo) {
                continue;
            }
            const [baseName, format] = variableInfo;
            const uniqueName = ensureUniqueName(baseName, detected);
            detected[uniqueName] = new DetectedVariableModel(uniqueName, value, 'string', format);
            detectedValues.add(value);
        }
    }
};
export const detect_variables_in_history = (history) => {
    const detected = {};
    const detectedValues = new Set();
    const historyItems = Array.isArray(history?.history)
        ? history.history
        : [];
    for (const historyItem of historyItems) {
        const actions = historyItem?.model_output?.action;
        if (!Array.isArray(actions)) {
            continue;
        }
        const interactedElements = Array.isArray(historyItem?.state?.interacted_element)
            ? historyItem.state.interacted_element
            : [];
        for (let actionIndex = 0; actionIndex < actions.length; actionIndex += 1) {
            const actionPayload = getActionPayload(actions[actionIndex]);
            const element = interactedElements[actionIndex] ?? null;
            detectInAction(actionPayload, element, detected, detectedValues);
        }
    }
    return detected;
};
export const substitute_in_dict = (data, replacements) => {
    let count = 0;
    for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
            if (value in replacements) {
                data[key] = replacements[value];
                count += 1;
            }
            continue;
        }
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            count += substitute_in_dict(value, replacements);
            continue;
        }
        if (Array.isArray(value)) {
            for (let index = 0; index < value.length; index += 1) {
                const item = value[index];
                if (typeof item === 'string') {
                    if (item in replacements) {
                        value[index] = replacements[item];
                        count += 1;
                    }
                    continue;
                }
                if (item && typeof item === 'object' && !Array.isArray(item)) {
                    count += substitute_in_dict(item, replacements);
                }
            }
        }
    }
    return count;
};
export const _private_for_tests = {
    detectFromAttributes,
    detectFromValuePattern,
    detectVariableType,
    ensureUniqueName,
};
