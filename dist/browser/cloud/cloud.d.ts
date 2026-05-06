import { CloudBrowserResponse, type CreateBrowserRequest } from './views.js';
export interface CloudBrowserClientOptions {
    api_base_url?: string;
    api_key?: string | null;
    fetch_impl?: typeof fetch;
}
export declare class CloudBrowserClient {
    private readonly api_base_url;
    private readonly explicit_api_key;
    private readonly fetch_impl;
    current_session_id: string | null;
    constructor(options?: CloudBrowserClientOptions);
    private _resolve_api_key;
    private _auth_headers;
    private _create_request_body;
    private _request_json;
    create_browser(request: CreateBrowserRequest, extra_headers?: Record<string, string>): Promise<CloudBrowserResponse>;
    stop_browser(session_id?: string | null, extra_headers?: Record<string, string>): Promise<CloudBrowserResponse>;
    close(): Promise<void>;
}
