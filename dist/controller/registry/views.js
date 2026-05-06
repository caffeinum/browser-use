import { z } from 'zod';
import { match_url_with_domain_pattern } from '../../utils.js';
const getPageUrl = (page) => {
    if (!page) {
        return '';
    }
    const candidate = page.url;
    if (typeof candidate === 'function') {
        try {
            return candidate.call(page);
        }
        catch {
            return '';
        }
    }
    return candidate ?? '';
};
// Render an action's param schema as compact JSON Schema for the LLM prompt.
// Replaces a prior raw dump of zod's private `_def` AST, which leaked
// internal keys like `innerType`/`defaultValue` and confused the LLM into
// copying default booleans into numeric fields (see scroll.num_pages bug).
function renderParamsJsonSchema(schema, skipKeys) {
    const raw = z.toJSONSchema(schema, { unrepresentable: 'any' });
    // Strip dialect noise the LLM doesn't need.
    delete raw.$schema;
    const properties = raw.properties ?? {};
    const filteredProps = {};
    for (const [key, value] of Object.entries(properties)) {
        if (skipKeys.has(key)) {
            continue;
        }
        filteredProps[key] = value;
    }
    raw.properties = filteredProps;
    if (Array.isArray(raw.required)) {
        raw.required = raw.required.filter((key) => typeof key === 'string' && !skipKeys.has(key));
        if (raw.required.length === 0) {
            delete raw.required;
        }
    }
    return raw;
}
export class RegisteredAction {
    name;
    description;
    handler;
    paramSchema;
    domains;
    pageFilter;
    terminates_sequence;
    constructor(name, description, handler, paramSchema, domains = null, pageFilter = null, terminates_sequence = false) {
        this.name = name;
        this.description = description;
        this.handler = handler;
        this.paramSchema = paramSchema;
        this.domains = domains;
        this.pageFilter = pageFilter;
        this.terminates_sequence = terminates_sequence;
    }
    promptDescription() {
        const skipKeys = new Set(['title']);
        let description = `${this.description}: \n`;
        description += `{${this.name}: `;
        const schemaShape = (this.paramSchema instanceof z.ZodObject && this.paramSchema.shape) ||
            ('shape' in this.paramSchema ? this.paramSchema.shape : null);
        const hideStructuredDoneSuccess = Boolean(this.name === 'done' &&
            schemaShape &&
            typeof schemaShape === 'object' &&
            Object.prototype.hasOwnProperty.call(schemaShape, 'data') &&
            Object.prototype.hasOwnProperty.call(schemaShape, 'success'));
        if (hideStructuredDoneSuccess) {
            skipKeys.add('success');
        }
        const hideExtractOutputSchema = Boolean(this.name === 'extract_structured_data' &&
            schemaShape &&
            typeof schemaShape === 'object' &&
            Object.prototype.hasOwnProperty.call(schemaShape, 'output_schema'));
        if (hideExtractOutputSchema) {
            skipKeys.add('output_schema');
        }
        const jsonSchema = renderParamsJsonSchema(this.paramSchema, skipKeys);
        description += JSON.stringify(jsonSchema);
        description += '}';
        return description;
    }
}
export class ActionModel {
    constructor(initialData = {}) {
        this.data = initialData;
    }
    data;
    toJSON() {
        return this.data;
    }
    model_dump(options) {
        const clone = JSON.parse(JSON.stringify(this.data));
        if (options?.exclude_none) {
            for (const [key, value] of Object.entries(clone)) {
                if (value === null || value === undefined) {
                    delete clone[key];
                }
            }
        }
        return clone;
    }
    model_dump_json(options) {
        return JSON.stringify(this.model_dump(options));
    }
    get_index() {
        for (const value of Object.values(this.data)) {
            if (value && typeof value === 'object' && 'index' in value) {
                return value.index ?? null;
            }
        }
        return null;
    }
    set_index(index) {
        const [actionName] = Object.keys(this.data);
        if (!actionName) {
            return;
        }
        const params = this.data[actionName];
        if (params && typeof params === 'object' && 'index' in params) {
            params.index = index;
        }
    }
}
export class ActionRegistry {
    actions = new Map();
    register(action) {
        this.actions.set(action.name, action);
    }
    remove(name) {
        this.actions.delete(name);
    }
    get(name) {
        return this.actions.get(name) ?? null;
    }
    getAll() {
        return Array.from(this.actions.values());
    }
    get actionsMap() {
        return new Map(this.actions);
    }
    get actionEntries() {
        return Array.from(this.actions.values());
    }
    _matchDomains(domains, pageUrl) {
        if (!domains || domains.length === 0) {
            return true;
        }
        if (!pageUrl) {
            return false;
        }
        return domains.some((pattern) => {
            try {
                return match_url_with_domain_pattern(pageUrl, pattern);
            }
            catch {
                return false;
            }
        });
    }
    _matchPageFilter(pageFilter, page) {
        if (!pageFilter) {
            return true;
        }
        try {
            return pageFilter(page);
        }
        catch {
            return false;
        }
    }
    getAvailableActions(page, includeActions) {
        const include = includeActions ? new Set(includeActions) : null;
        return this.actionEntries.filter((action) => {
            if (include && !include.has(action.name)) {
                return false;
            }
            if (!page) {
                return !action.pageFilter && !action.domains;
            }
            const pageUrl = getPageUrl(page);
            const domainAllowed = this._matchDomains(action.domains, pageUrl);
            const pageAllowed = this._matchPageFilter(action.pageFilter, page);
            return domainAllowed && pageAllowed;
        });
    }
    get_prompt_description(page) {
        return this.getAvailableActions(page)
            .map((action) => action.promptDescription())
            .join('\n');
    }
}
export class SpecialActionParameters {
    context = null;
    browser_session = null;
    browser = null;
    browser_context = null;
    page = null;
    page_extraction_llm = null;
    extraction_schema = null;
    file_system = null;
    available_file_paths = null;
    signal = null;
    has_sensitive_data = false;
    static get_browser_requiring_params() {
        return new Set(['browser_session', 'browser', 'browser_context', 'page']);
    }
}
