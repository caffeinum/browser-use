import { createLogger } from './logging-config.js';
type Callback = (() => void) | undefined;
export interface SignalHandlerOptions {
    pause_callback?: Callback;
    resume_callback?: Callback;
    custom_exit_callback?: Callback;
    exit_on_second_int?: boolean;
    interruptible_task_patterns?: string[];
}
export declare class SignalHandler {
    loop: NodeJS.EventEmitter | null;
    pause_callback?: Callback;
    resume_callback?: Callback;
    custom_exit_callback?: Callback;
    exit_on_second_int: boolean;
    interruptible_task_patterns: string[];
    is_windows: boolean;
    private ctrl_c_pressed;
    private waiting_for_input;
    private bound_sigint;
    private bound_sigterm;
    constructor(options?: SignalHandlerOptions);
    register(): void;
    unregister(): void;
    private _handle_second_ctrl_c;
    private _cancel_interruptible_tasks;
    wait_for_resume(): Promise<void>;
    reset(): void;
    private sigint_handler;
    private sigterm_handler;
}
export declare const time_execution_sync: (additional_text?: string) => <T extends (...args: any[]) => any>(func: T) => T;
export declare const time_execution_async: (additional_text?: string) => <T extends (...args: any[]) => Promise<any>>(func: T) => T;
export declare const singleton: <T extends (...args: any[]) => any>(cls: T) => (...args: Parameters<T>) => ReturnType<T>;
export declare const check_env_variables: (keys: string[], predicate?: (values: string[]) => boolean) => boolean;
export declare const is_unsafe_pattern: (pattern: string) => boolean;
export declare const merge_dicts: (a: Record<string, any>, b: Record<string, any>, path?: (string | number)[]) => Record<string, any>;
export declare const get_browser_use_version: () => string;
export declare const check_latest_browser_use_version: () => Promise<string | null>;
export interface CreateTaskWithErrorHandlingOptions {
    name?: string;
    logger_instance?: ReturnType<typeof createLogger>;
    suppress_exceptions?: boolean;
}
export declare const create_task_with_error_handling: <T>(promise: Promise<T>, options?: CreateTaskWithErrorHandlingOptions) => Promise<T | undefined>;
export declare const sanitize_surrogates: (text: string) => string;
export declare const get_git_info: () => Record<string, string> | null;
export declare const _log_pretty_path: (input: unknown) => string;
export declare const _log_pretty_url: (value: string, max_len?: number | null) => string;
export declare const log_pretty_path: (input: unknown) => string;
export declare const log_pretty_url: (value: string, max_len?: number | null) => string;
export declare const uuid7str: () => string;
/**
 * Retry configuration options
 */
export interface RetryOptions {
    /** Maximum number of retry attempts (default: 3) */
    maxAttempts?: number;
    /** Delay between retries in milliseconds (default: 1000) */
    delayMs?: number;
    /** Exponential backoff multiplier (default: 1 = no backoff) */
    backoffMultiplier?: number;
    /** Maximum delay in milliseconds for exponential backoff (default: 30000) */
    maxDelayMs?: number;
    /** Function to determine if error is retryable (default: all errors retryable) */
    shouldRetry?: (error: Error, attempt: number) => boolean;
    /** Callback called on each retry attempt */
    onRetry?: (error: Error, attempt: number, nextDelayMs: number) => void;
}
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
export declare function retryAsync<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
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
export declare function createSemaphore(maxConcurrent: number): {
    /**
     * Acquire a semaphore slot
     * Waits if max concurrent operations are already running
     */
    acquire(): Promise<void>;
    /**
     * Release a semaphore slot
     * Allows next queued operation to proceed
     */
    release(): void;
    /**
     * Get current active count
     */
    getActiveCount(): number;
    /**
     * Get queue length
     */
    getQueueLength(): number;
};
/**
 * Check if a URL is a new tab page (about:blank/about:newtab/chrome://new-tab-page/chrome://newtab).
 */
export declare function is_new_tab_page(url: string): boolean;
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
export declare function match_url_with_domain_pattern(url: string, domain_pattern: string, log_warnings?: boolean): boolean;
export {};
