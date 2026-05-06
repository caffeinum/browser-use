import { z } from 'zod';
import { createHmac } from 'node:crypto';
import { createLogger } from '../../logging-config.js';
import { observe_debug } from '../../observability.js';
import { time_execution_async } from '../../utils.js';
import { is_new_tab_page, match_url_with_domain_pattern } from '../../utils.js';
import { BrowserError } from '../../browser/views.js';
import { ActionModel, ActionRegistry, RegisteredAction } from './views.js';
const logger = createLogger('browser_use.controller.registry');
const SPECIAL_PARAM_NAMES = new Set([
    'context',
    'browser_session',
    'browser',
    'browser_context',
    'page',
    'page_url',
    'cdp_client',
    'page_extraction_llm',
    'available_file_paths',
    'has_sensitive_data',
    'file_system',
    'extraction_schema',
    'sensitive_data',
    'signal',
]);
const splitTopLevelParameters = (paramsSource) => {
    const segments = [];
    let current = '';
    let depthParen = 0;
    let depthBrace = 0;
    let depthBracket = 0;
    let quote = null;
    let escaped = false;
    const flush = () => {
        const trimmed = current.trim();
        if (trimmed) {
            segments.push(trimmed);
        }
        current = '';
    };
    for (const char of paramsSource) {
        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }
        if (char === '\\') {
            current += char;
            escaped = true;
            continue;
        }
        if (quote) {
            current += char;
            if (char === quote) {
                quote = null;
            }
            continue;
        }
        if (char === "'" || char === '"' || char === '`') {
            current += char;
            quote = char;
            continue;
        }
        if (char === '(')
            depthParen += 1;
        else if (char === ')')
            depthParen -= 1;
        else if (char === '{')
            depthBrace += 1;
        else if (char === '}')
            depthBrace -= 1;
        else if (char === '[')
            depthBracket += 1;
        else if (char === ']')
            depthBracket -= 1;
        if (char === ',' &&
            depthParen === 0 &&
            depthBrace === 0 &&
            depthBracket === 0) {
            flush();
            continue;
        }
        current += char;
    }
    flush();
    return segments;
};
const extractFunctionParameters = (fn) => {
    const source = fn.toString().trim();
    if (!source) {
        return null;
    }
    let paramsSource;
    const arrowIndex = source.indexOf('=>');
    if (arrowIndex !== -1) {
        let lhs = source.slice(0, arrowIndex).trim();
        if (lhs.startsWith('async ')) {
            lhs = lhs.slice('async '.length).trim();
        }
        if (lhs.startsWith('(') && lhs.endsWith(')')) {
            paramsSource = lhs.slice(1, -1);
        }
        else {
            paramsSource = lhs;
        }
    }
    else {
        const openIndex = source.indexOf('(');
        const closeIndex = source.indexOf(')', openIndex + 1);
        if (openIndex === -1 || closeIndex === -1) {
            return null;
        }
        paramsSource = source.slice(openIndex + 1, closeIndex);
    }
    const tokens = splitTopLevelParameters(paramsSource);
    if (!tokens.length) {
        return [];
    }
    const parsed = [];
    for (const token of tokens) {
        if (token.startsWith('...')) {
            const fnName = fn.name || '<anonymous>';
            throw new Error(`Action '${fnName}' has ${token} which is not allowed. Actions must have explicit positional parameters only.`);
        }
        if (token.includes('{') ||
            token.includes('}') ||
            token.includes('[') ||
            token.includes(']')) {
            return null;
        }
        const eqIndex = token.indexOf('=');
        const name = (eqIndex === -1 ? token : token.slice(0, eqIndex)).trim();
        if (!name) {
            return null;
        }
        parsed.push({
            name,
            hasDefault: eqIndex !== -1,
        });
    }
    return parsed;
};
const isAbortError = (error) => error instanceof Error && error.name === 'AbortError';
const createAbortError = (reason) => {
    if (isAbortError(reason)) {
        return reason;
    }
    const message = reason instanceof Error ? reason.message : 'Operation aborted';
    const error = new Error(message);
    error.name = 'AbortError';
    if (reason !== undefined) {
        error.cause = reason;
    }
    return error;
};
const wrapActionExecutionError = (actionName, error) => {
    if (error instanceof BrowserError) {
        return error;
    }
    const message = error instanceof Error ? error.message : String(error);
    const wrapped = new Error(`Error executing action ${actionName}: ${message}`);
    if (error !== undefined) {
        wrapped.cause = error;
    }
    return wrapped;
};
const isSpecialContextMissingError = (error) => {
    if (!(error instanceof Error)) {
        return false;
    }
    return (error.message.includes('requires browser_session but none provided') ||
        error.message.includes('requires page_extraction_llm but none provided'));
};
const safeJsonStringify = (value) => {
    try {
        return JSON.stringify(value);
    }
    catch {
        return String(value);
    }
};
const isTimeoutError = (error) => error instanceof Error && error.name === 'TimeoutError';
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const decodeBase32Secret = (secret) => {
    const sanitized = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
    if (!sanitized.length) {
        throw new Error('Invalid TOTP secret: empty base32 payload');
    }
    let bits = 0;
    let bitBuffer = 0;
    const bytes = [];
    for (const char of sanitized) {
        const value = BASE32_ALPHABET.indexOf(char);
        if (value < 0) {
            throw new Error(`Invalid base32 character in TOTP secret: ${char}`);
        }
        bitBuffer = (bitBuffer << 5) | value;
        bits += 5;
        while (bits >= 8) {
            bytes.push((bitBuffer >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    if (!bytes.length) {
        throw new Error('Invalid TOTP secret: failed to decode base32 payload');
    }
    return Buffer.from(bytes);
};
const generateTotpCode = (secret) => {
    const key = decodeBase32Secret(secret);
    const counter = Math.floor(Date.now() / 1000 / 30);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter));
    const hmac = createHmac('sha1', key).update(counterBuffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binaryCode = ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);
    return String(binaryCode % 1_000_000).padStart(6, '0');
};
export class Registry {
    registry = new ActionRegistry();
    excludeActions;
    constructor(exclude_actions = null) {
        this.excludeActions = new Set(exclude_actions ?? []);
    }
    action(description, options = {}) {
        if (options.allowed_domains && options.domains) {
            throw new Error("Cannot specify both 'domains' and 'allowed_domains' - they are aliases for the same parameter");
        }
        let schema = options.param_model ?? z.object({}).strict();
        const actionNameOverride = options.action_name ?? null;
        const domains = options.allowed_domains ?? options.domains ?? null;
        const pageFilter = options.page_filter ?? null;
        const terminatesSequence = options.terminates_sequence ?? false;
        return (handler) => {
            const actionName = actionNameOverride ?? handler.name;
            if (this.excludeActions.has(actionName)) {
                return handler;
            }
            const parsedHandlerParams = extractFunctionParameters(handler);
            let normalizedHandler = handler;
            if (!options.param_model) {
                const supportsCompatSignature = Boolean(parsedHandlerParams &&
                    parsedHandlerParams.length > 0 &&
                    !(parsedHandlerParams.length <= 2 &&
                        parsedHandlerParams[0]?.name === 'params'));
                if (supportsCompatSignature && parsedHandlerParams) {
                    const actionParams = parsedHandlerParams.filter((entry) => !SPECIAL_PARAM_NAMES.has(entry.name));
                    const shape = Object.fromEntries(actionParams.map((entry) => [
                        entry.name,
                        entry.hasDefault ? z.any().optional() : z.any(),
                    ]));
                    schema = z.object(shape).strict();
                    normalizedHandler = ((params, ctx) => {
                        const args = parsedHandlerParams.map((entry) => {
                            if (SPECIAL_PARAM_NAMES.has(entry.name)) {
                                const value = ctx[entry.name];
                                if ((value === null || value === undefined) &&
                                    !entry.hasDefault) {
                                    throw new Error(`Action ${actionName} requires ${entry.name} but none provided.`);
                                }
                                return value;
                            }
                            const value = params[entry.name];
                            if (value === undefined && !entry.hasDefault) {
                                throw new Error(`${actionName}() missing required parameter '${entry.name}'`);
                            }
                            return value;
                        });
                        return handler(...args);
                    });
                }
            }
            const action = new RegisteredAction(actionName, description, normalizedHandler, schema, domains, pageFilter, terminatesSequence);
            this.registry.register(action);
            return normalizedHandler;
        };
    }
    get_action(action_name) {
        return this.registry.get(action_name);
    }
    exclude_action(action_name) {
        this.excludeActions.add(action_name);
        this.registry.remove(action_name);
    }
    remove_action(action_name) {
        this.registry.remove(action_name);
    }
    get_all_actions() {
        return this.registry.actionsMap;
    }
    execute_action = observe_debug({
        name: 'execute_action',
        ignore_input: true,
        ignore_output: true,
    })(time_execution_async('--execute_action')(async (action_name, params, { browser_session = null, page_extraction_llm = null, extraction_schema = null, file_system = null, sensitive_data = null, available_file_paths = null, signal = null, context = null, } = {}) => {
        const action = this.registry.get(action_name);
        if (!action) {
            throw new Error(`Action ${action_name} not found`);
        }
        const parsed = action.paramSchema.safeParse(params);
        if (!parsed.success) {
            throw new Error(`Invalid parameters ${safeJsonStringify(params)} for action ${action_name}: ${parsed.error.message}`);
        }
        let validatedParams = parsed.data;
        let currentUrl = null;
        if (browser_session?.agent_current_page?.url) {
            currentUrl = browser_session.agent_current_page.url();
        }
        else if (browser_session?.get_current_page) {
            const currentPage = await browser_session.get_current_page();
            currentUrl = currentPage?.url() ?? null;
        }
        if (sensitive_data) {
            validatedParams = this.replace_sensitive_data(validatedParams, sensitive_data, currentUrl);
        }
        let page = null;
        if (browser_session?.get_current_page) {
            page = await browser_session.get_current_page();
        }
        const ctx = {
            context,
            browser_session,
            browser: browser_session,
            browser_context: browser_session,
            page,
            page_url: currentUrl,
            cdp_client: browser_session?.cdp_client ?? null,
            page_extraction_llm,
            extraction_schema,
            file_system,
            available_file_paths,
            sensitive_data,
            signal,
            has_sensitive_data: (action_name === 'input_text' || action_name === 'input') &&
                Boolean(sensitive_data),
        };
        if (signal?.aborted) {
            throw createAbortError(signal.reason);
        }
        try {
            return await action.handler(validatedParams, ctx);
        }
        catch (error) {
            if (signal?.aborted || isAbortError(error)) {
                throw createAbortError(signal?.reason ?? error);
            }
            if (isTimeoutError(error)) {
                throw new Error(`Error executing action ${action_name} due to timeout.`, { cause: error });
            }
            if (isSpecialContextMissingError(error)) {
                throw error;
            }
            throw wrapActionExecutionError(action_name, error);
        }
    }));
    replace_sensitive_data(params, sensitiveData, currentUrl) {
        const secretPattern = /<secret>(.*?)<\/secret>/g;
        const applicableSecrets = {};
        for (const [domainOrKey, content] of Object.entries(sensitiveData)) {
            if (content && typeof content === 'object' && !Array.isArray(content)) {
                if (currentUrl &&
                    !is_new_tab_page(currentUrl) &&
                    match_url_with_domain_pattern(currentUrl, domainOrKey)) {
                    Object.assign(applicableSecrets, content);
                }
            }
            else if (typeof content === 'string') {
                applicableSecrets[domainOrKey] = content;
            }
        }
        const cloneValue = (value) => {
            if (Array.isArray(value)) {
                return value.map((item) => cloneValue(item));
            }
            if (value && typeof value === 'object') {
                return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cloneValue(v)]));
            }
            return value;
        };
        const processed = cloneValue(params);
        const replaced = new Set();
        const missing = new Set();
        const traverse = (value) => {
            if (typeof value === 'string') {
                return value.replace(secretPattern, (_, placeholderValue) => {
                    const placeholder = String(placeholderValue);
                    if (placeholder in applicableSecrets) {
                        replaced.add(placeholder);
                        const replacement = applicableSecrets[placeholder];
                        if (placeholder.endsWith('bu_2fa_code')) {
                            return generateTotpCode(replacement);
                        }
                        return replacement;
                    }
                    missing.add(placeholder);
                    return `<secret>${placeholder}</secret>`;
                });
            }
            if (Array.isArray(value)) {
                return value.map(traverse);
            }
            if (value && typeof value === 'object') {
                for (const [key, val] of Object.entries(value)) {
                    value[key] = traverse(val);
                }
            }
            return value;
        };
        traverse(processed);
        this.log_sensitive_data_usage(replaced, currentUrl);
        if (missing.size > 0) {
            logger.warning(`Missing or empty keys in sensitive_data dictionary: ${Array.from(missing).join(', ')}`);
        }
        return processed;
    }
    log_sensitive_data_usage(placeholders, currentUrl) {
        if (!placeholders.size) {
            return;
        }
        const urlInfo = currentUrl && !is_new_tab_page(currentUrl) ? ` on ${currentUrl}` : '';
        logger.info(`🔒 Using sensitive data placeholders: ${Array.from(placeholders).sort().join(', ')}${urlInfo}`);
    }
    create_action_model(options = {}) {
        const { include_actions = null, page = null } = options;
        const availableActions = this.registry.getAvailableActions(page, include_actions);
        class DynamicActionModel extends ActionModel {
            static available_actions = availableActions.map((action) => action.name);
        }
        Object.defineProperty(DynamicActionModel, 'name', {
            value: 'ActionModel',
        });
        return DynamicActionModel;
    }
    get_prompt_description(page) {
        return this.registry.get_prompt_description(page ?? undefined);
    }
}
