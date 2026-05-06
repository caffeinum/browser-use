import { BrowserCreatedData, ErrorData, LogData, ResultData, SandboxError } from './views.js';
export interface SandboxOptions {
    api_key?: string | null;
    server_url?: string | null;
    log_level?: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | string;
    quiet?: boolean;
    headers?: Record<string, string>;
    cloud_profile_id?: string | null;
    cloud_proxy_country_code?: string | null;
    cloud_timeout?: number | null;
    fetch_impl?: typeof fetch;
    on_browser_created?: (event: BrowserCreatedData) => void | Promise<void>;
    on_instance_ready?: () => void | Promise<void>;
    on_log?: (event: LogData) => void | Promise<void>;
    on_result?: (event: ResultData) => void | Promise<void>;
    on_error?: (event: ErrorData) => void | Promise<void>;
}
export declare const sandbox: (options?: SandboxOptions) => <TArgs extends unknown[], TResult>(fn: (...args: TArgs) => Promise<TResult> | TResult) => (...args: TArgs) => Promise<TResult>;
export { SandboxError };
