import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { stderr } from 'node:process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import * as minimatchModule from 'minimatch';
import { createLogger } from './logging-config.js';
loadEnv();
const logger = createLogger('browser_use.utils');
let _exiting = false;
const minimatch = (minimatchModule.minimatch ??
    minimatchModule.default ??
    minimatchModule);
export class SignalHandler {
    loop = null;
    pause_callback;
    resume_callback;
    custom_exit_callback;
    exit_on_second_int;
    interruptible_task_patterns;
    is_windows;
    ctrl_c_pressed = false;
    waiting_for_input = false;
    bound_sigint = this.sigint_handler.bind(this);
    bound_sigterm = this.sigterm_handler.bind(this);
    constructor(options = {}) {
        this.pause_callback = options.pause_callback;
        this.resume_callback = options.resume_callback;
        this.custom_exit_callback = options.custom_exit_callback;
        this.exit_on_second_int = options.exit_on_second_int ?? true;
        this.interruptible_task_patterns = options.interruptible_task_patterns ?? [
            'step',
            'multi_act',
            'get_next_action',
        ];
        this.is_windows = os.platform() === 'win32';
    }
    register() {
        process.on('SIGINT', this.bound_sigint);
        process.on('SIGTERM', this.bound_sigterm);
    }
    unregister() {
        process.off('SIGINT', this.bound_sigint);
        process.off('SIGTERM', this.bound_sigterm);
    }
    _handle_second_ctrl_c() {
        if (!_exiting) {
            _exiting = true;
            if (this.custom_exit_callback) {
                try {
                    this.custom_exit_callback();
                }
                catch (error) {
                    logger.error(`Error in exit callback: ${error.message}`);
                }
            }
        }
        stderr.write('\n\n🛑  Got second Ctrl+C. Exiting immediately...\n');
        stderr.write('\x1b[?25h\x1b[0m\x1b[?1l\x1b[?2004l\r');
        process.exit(0);
    }
    _cancel_interruptible_tasks() {
        // Node.js does not provide asyncio-style task cancellation.
        // Users should manage their own interruptible work via pause/resume callbacks.
    }
    async wait_for_resume() {
        this.waiting_for_input = true;
        const green = '\x1b[32;1m';
        const red = '\x1b[31m';
        const blink = '\x1b[33;5m';
        const unblink = '\x1b[0m';
        const reset = '\x1b[0m';
        stderr.write(`➡️  Press ${green}[Enter]${reset} to resume or ${red}[Ctrl+C]${reset} again to exit${blink}...${unblink} `);
        await new Promise((resolve) => {
            const rl = readline.createInterface({
                input: process.stdin,
                output: stderr,
            });
            const cleanup = () => {
                this.waiting_for_input = false;
                rl.close();
                resolve();
            };
            rl.once('line', () => {
                if (this.resume_callback) {
                    try {
                        this.resume_callback();
                    }
                    catch (error) {
                        logger.error(`Error in resume callback: ${error.message}`);
                    }
                }
                cleanup();
            });
            rl.once('SIGINT', () => {
                this._handle_second_ctrl_c();
                cleanup();
            });
        });
    }
    reset() {
        this.ctrl_c_pressed = false;
        this.waiting_for_input = false;
    }
    sigint_handler() {
        if (_exiting) {
            process.exit(0);
        }
        if (this.ctrl_c_pressed) {
            if (this.waiting_for_input) {
                return;
            }
            if (this.exit_on_second_int) {
                this._handle_second_ctrl_c();
            }
        }
        this.ctrl_c_pressed = true;
        this._cancel_interruptible_tasks();
        if (this.pause_callback) {
            try {
                this.pause_callback();
            }
            catch (error) {
                logger.error(`Error in pause callback: ${error.message}`);
            }
        }
        stderr.write('----------------------------------------------------------------------\n');
    }
    sigterm_handler() {
        if (!_exiting) {
            _exiting = true;
            stderr.write('\n\n🛑 SIGTERM received. Exiting immediately...\n\n');
            if (this.custom_exit_callback) {
                this.custom_exit_callback();
            }
        }
        process.exit(0);
    }
}
const strip_hyphen = (value) => value.replace(/^-+|-+$/g, '').trim();
const pick_logger = (args) => {
    if (args.length > 0) {
        const candidate = args[0];
        if (candidate && candidate.logger) {
            return candidate.logger;
        }
    }
    return logger;
};
export const time_execution_sync = (additional_text = '') => (func) => {
    const label = strip_hyphen(additional_text);
    const wrapper = function (...args) {
        const start = performance.now();
        const result = func.apply(this, args);
        const execution_time = (performance.now() - start) / 1000;
        if (execution_time > 0.25) {
            pick_logger(args).debug(`⏳ ${label}() took ${execution_time.toFixed(2)}s`);
        }
        return result;
    };
    return wrapper;
};
export const time_execution_async = (additional_text = '') => (func) => {
    const label = strip_hyphen(additional_text);
    const wrapper = async function (...args) {
        const start = performance.now();
        const result = await func.apply(this, args);
        const execution_time = (performance.now() - start) / 1000;
        if (execution_time > 0.25) {
            pick_logger(args).debug(`⏳ ${label}() took ${execution_time.toFixed(2)}s`);
        }
        return result;
    };
    return wrapper;
};
export const singleton = (cls) => {
    let instance;
    return (...args) => {
        if (instance === undefined) {
            instance = cls(...args);
        }
        return instance;
    };
};
export const check_env_variables = (keys, predicate = (values) => values.every((value) => value.trim().length > 0)) => {
    const values = keys.map((key) => process.env[key] ?? '');
    return predicate(values);
};
export const is_unsafe_pattern = (pattern) => {
    if (pattern.includes('://')) {
        const [, ...rest] = pattern.split('://');
        pattern = rest.join('://');
    }
    const bare_domain = pattern.replace('.*', '').replace('*.', '');
    return bare_domain.includes('*');
};
export const merge_dicts = (a, b, path = []) => {
    for (const key of Object.keys(b)) {
        if (key in a) {
            if (typeof a[key] === 'object' &&
                !Array.isArray(a[key]) &&
                typeof b[key] === 'object' &&
                !Array.isArray(b[key])) {
                merge_dicts(a[key], b[key], [...path, key]);
            }
            else if (Array.isArray(a[key]) && Array.isArray(b[key])) {
                a[key] = [...a[key], ...b[key]];
            }
            else if (a[key] !== b[key]) {
                throw new Error(`Conflict at ${[...path, key].join('.')}`);
            }
        }
        else {
            a[key] = b[key];
        }
    }
    return a;
};
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const package_root = path.resolve(__dirname, '..');
let cached_version = null;
export const get_browser_use_version = () => {
    if (cached_version) {
        return cached_version;
    }
    try {
        const package_json = JSON.parse(fs.readFileSync(path.join(package_root, 'package.json'), 'utf-8'));
        if (package_json?.version) {
            const version = String(package_json.version);
            cached_version = version;
            process.env.LIBRARY_VERSION = version;
            return version;
        }
    }
    catch (error) {
        logger.debug(`Error detecting browser-use version: ${error.message}`);
    }
    return 'unknown';
};
export const check_latest_browser_use_version = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    timeout.unref?.();
    try {
        const response = await fetch('https://registry.npmjs.org/browser-use/latest', {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
            signal: controller.signal,
        });
        if (!response.ok) {
            return null;
        }
        const payload = (await response.json());
        if (typeof payload.version === 'string' && payload.version.trim()) {
            return payload.version.trim();
        }
        return null;
    }
    catch {
        return null;
    }
    finally {
        clearTimeout(timeout);
    }
};
export const create_task_with_error_handling = (promise, options = {}) => {
    const { name = 'unnamed', logger_instance, suppress_exceptions = false, } = options;
    const log = logger_instance ?? logger;
    return promise.catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        if (suppress_exceptions) {
            log.error(`Exception in background task [${name}]: ${message}`);
            return undefined;
        }
        log.warning(`Exception in background task [${name}]: ${message}`);
        throw error;
    });
};
export const sanitize_surrogates = (text) => {
    let result = '';
    for (let index = 0; index < text.length; index += 1) {
        const code = text.charCodeAt(index);
        // High surrogate
        if (code >= 0xd800 && code <= 0xdbff) {
            const nextCode = index + 1 < text.length ? text.charCodeAt(index + 1) : null;
            if (nextCode != null && nextCode >= 0xdc00 && nextCode <= 0xdfff) {
                result += text[index] + text[index + 1];
                index += 1;
            }
            continue;
        }
        // Low surrogate without preceding high surrogate
        if (code >= 0xdc00 && code <= 0xdfff) {
            continue;
        }
        result += text[index];
    }
    return result;
};
let cached_git_info;
export const get_git_info = () => {
    if (cached_git_info !== undefined) {
        return cached_git_info;
    }
    try {
        const git_dir = path.join(package_root, '.git');
        if (!fs.existsSync(git_dir)) {
            cached_git_info = null;
            return null;
        }
        const commit_hash = execSync('git rev-parse HEAD', {
            cwd: package_root,
            stdio: ['ignore', 'pipe', 'ignore'],
        })
            .toString()
            .trim();
        const branch = execSync('git rev-parse --abbrev-ref HEAD', {
            cwd: package_root,
            stdio: ['ignore', 'pipe', 'ignore'],
        })
            .toString()
            .trim();
        const remote_url = execSync('git config --get remote.origin.url', {
            cwd: package_root,
            stdio: ['ignore', 'pipe', 'ignore'],
        })
            .toString()
            .trim();
        const commit_timestamp = execSync('git show -s --format=%ci HEAD', {
            cwd: package_root,
            stdio: ['ignore', 'pipe', 'ignore'],
        })
            .toString()
            .trim();
        cached_git_info = { commit_hash, branch, remote_url, commit_timestamp };
        return cached_git_info;
    }
    catch (error) {
        logger.debug(`Error getting git info: ${error.message}`);
        cached_git_info = null;
        return null;
    }
};
export const _log_pretty_path = (input) => {
    if (!input) {
        return '';
    }
    if (typeof input !== 'string') {
        return `<${input.constructor?.name || typeof input}>`;
    }
    const normalized = input.trim();
    if (!normalized) {
        return '';
    }
    let pretty_path = normalized.replace(os.homedir(), '~');
    pretty_path = pretty_path.replace(process.cwd(), '.');
    return pretty_path.includes(' ') ? `"${pretty_path}"` : pretty_path;
};
export const _log_pretty_url = (value, max_len = 22) => {
    let sanitized = value
        .replace('https://', '')
        .replace('http://', '')
        .replace('www.', '');
    if (max_len !== null && sanitized.length > max_len) {
        sanitized = `${sanitized.slice(0, max_len)}…`;
    }
    return sanitized;
};
export const log_pretty_path = _log_pretty_path;
export const log_pretty_url = _log_pretty_url;
export const uuid7str = () => {
    const timestamp = Buffer.alloc(6);
    const now = Date.now();
    timestamp.writeUIntBE(now, 0, 6);
    const random = crypto.randomBytes(10);
    const bytes = Buffer.concat([timestamp, random]);
    bytes[6] = (bytes[6] & 0x0f) | 0x70;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
/**
 * Retry an async function with configurable attempts and delays
 * Implements exponential backoff with jitter
 *
 * @param fn - The async function to retry
 * @param options - Retry configuration
 * @returns The result of the function
 * @throws The last error if all retries fail
 *
 * @example
 * const result = await retryAsync(
 *   async () => await fetchData(),
 *   { maxAttempts: 3, delayMs: 1000, backoffMultiplier: 2 }
 * );
 */
export async function retryAsync(fn, options = {}) {
    const { maxAttempts = 3, delayMs = 1000, backoffMultiplier = 1, maxDelayMs = 30000, shouldRetry = () => true, onRetry, } = options;
    let lastError = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            // Check if we should retry
            const isLastAttempt = attempt === maxAttempts;
            if (isLastAttempt || !shouldRetry(lastError, attempt)) {
                throw lastError;
            }
            // Calculate delay with exponential backoff and jitter
            const baseDelay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
            const jitter = Math.random() * 0.3 * baseDelay; // Add up to 30% jitter
            const nextDelay = Math.min(baseDelay + jitter, maxDelayMs);
            // Notify about retry
            if (onRetry) {
                onRetry(lastError, attempt, nextDelay);
            }
            // Wait before next attempt
            await new Promise((resolve) => setTimeout(resolve, nextDelay));
        }
    }
    // This should never be reached, but TypeScript requires it
    throw lastError || new Error('Retry failed with unknown error');
}
/**
 * Create a semaphore for limiting concurrent operations
 *
 * @example
 * const semaphore = createSemaphore(3); // Allow max 3 concurrent operations
 * await semaphore.acquire();
 * try {
 *   await doWork();
 * } finally {
 *   semaphore.release();
 * }
 */
export function createSemaphore(maxConcurrent) {
    let activeCount = 0;
    const queue = [];
    return {
        /**
         * Acquire a semaphore slot
         * Waits if max concurrent operations are already running
         */
        async acquire() {
            if (activeCount < maxConcurrent) {
                activeCount++;
                return;
            }
            await new Promise((resolve) => {
                queue.push(resolve);
            });
        },
        /**
         * Release a semaphore slot
         * Allows next queued operation to proceed
         */
        release() {
            const next = queue.shift();
            if (next) {
                next();
            }
            else {
                activeCount--;
            }
        },
        /**
         * Get current active count
         */
        getActiveCount() {
            return activeCount;
        },
        /**
         * Get queue length
         */
        getQueueLength() {
            return queue.length;
        },
    };
}
/**
 * Check if a URL is a new tab page (about:blank/about:newtab/chrome://new-tab-page/chrome://newtab).
 */
export function is_new_tab_page(url) {
    return (url === 'about:blank' ||
        url === 'about:newtab' ||
        url === 'chrome://new-tab-page/' ||
        url === 'chrome://new-tab-page' ||
        url === 'chrome://newtab/' ||
        url === 'chrome://newtab');
}
/**
 * Check if a URL matches a domain pattern. SECURITY CRITICAL.
 *
 * Supports optional glob patterns and schemes:
 * - *.example.com will match sub.example.com and example.com
 * - *google.com will match google.com, agoogle.com, and www.google.com
 * - http*://example.com will match http://example.com, https://example.com
 * - chrome-extension://* will match chrome-extension://aaaaaaaaaaaa and chrome-extension://bbbbbbbbbbbbb
 *
 * When no scheme is specified, https is used by default for security.
 * For example, 'example.com' will match 'https://example.com' but not 'http://example.com'.
 *
 * Note: New tab pages (about:blank, chrome://new-tab-page) must be handled at the callsite, not inside this function.
 */
export function match_url_with_domain_pattern(url, domain_pattern, log_warnings = false) {
    try {
        // Note: new tab pages should be handled at the callsite, not here
        if (is_new_tab_page(url)) {
            return false;
        }
        const parsed_url = new URL(url);
        // Extract only the hostname and scheme components
        const scheme = parsed_url.protocol.replace(':', '').toLowerCase();
        const domain = parsed_url.hostname.toLowerCase();
        if (!scheme || !domain) {
            return false;
        }
        // Normalize the domain pattern
        const normalizedPattern = domain_pattern.toLowerCase();
        // Handle pattern with scheme
        let pattern_scheme;
        let pattern_domain;
        if (normalizedPattern.includes('://')) {
            const parts = normalizedPattern.split('://');
            pattern_scheme = parts[0];
            pattern_domain = parts[1];
        }
        else {
            pattern_scheme = 'https'; // Default to matching only https for security
            pattern_domain = normalizedPattern;
        }
        // Handle port in pattern (we strip ports from patterns since we already extracted only the hostname from the URL)
        if (pattern_domain.includes(':') && !pattern_domain.startsWith(':')) {
            pattern_domain = pattern_domain.split(':')[0];
        }
        // If scheme doesn't match using minimatch, return false
        if (!minimatch(scheme, pattern_scheme)) {
            return false;
        }
        // Check for exact match
        if (pattern_domain === '*' || domain === pattern_domain) {
            return true;
        }
        // Handle glob patterns
        if (pattern_domain.includes('*')) {
            // Check for unsafe glob patterns
            // First, check for patterns like *.*.domain which are unsafe
            if ((pattern_domain.match(/\*\./g) || []).length > 1 ||
                (pattern_domain.match(/\.\*/g) || []).length > 1) {
                if (log_warnings) {
                    console.error(`⛔️ Multiple wildcards in pattern=[${domain_pattern}] are not supported`);
                }
                return false; // Don't match unsafe patterns
            }
            // Check for wildcards in TLD part (example.*)
            if (pattern_domain.endsWith('.*')) {
                if (log_warnings) {
                    console.error(`⛔️ Wildcard TLDs like in pattern=[${domain_pattern}] are not supported for security`);
                }
                return false; // Don't match unsafe patterns
            }
            // Then check for embedded wildcards
            const bare_domain = pattern_domain.replace('*.', '');
            if (bare_domain.includes('*')) {
                if (log_warnings) {
                    console.error(`⛔️ Only *.domain style patterns are supported, ignoring pattern=[${domain_pattern}]`);
                }
                return false; // Don't match unsafe patterns
            }
            // Special handling so that *.google.com also matches bare google.com
            if (pattern_domain.startsWith('*.')) {
                const base = pattern_domain.slice(2); // Remove '*.'
                if (domain === base || domain.endsWith('.' + base)) {
                    return true;
                }
            }
            // Use minimatch for pattern matching
            return minimatch(domain, pattern_domain);
        }
        // No match
        return false;
    }
    catch (error) {
        // Invalid URL or pattern
        return false;
    }
}
