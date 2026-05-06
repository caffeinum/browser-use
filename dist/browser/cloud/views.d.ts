export type ProxyCountryCode = 'us' | 'uk' | 'fr' | 'it' | 'jp' | 'au' | 'de' | 'fi' | 'ca' | 'in' | string;
export declare const MAX_FREE_USER_SESSION_TIMEOUT = 15;
export declare const MAX_PAID_USER_SESSION_TIMEOUT = 240;
export interface CreateBrowserRequest {
    cloud_profile_id?: string | null;
    cloud_proxy_country_code?: ProxyCountryCode | null;
    cloud_timeout?: number | null;
    profile_id?: string | null;
    proxy_country_code?: ProxyCountryCode | null;
    timeout?: number | null;
}
export interface CloudBrowserResponsePayload {
    id: string;
    status: string;
    liveUrl?: string;
    live_url?: string;
    cdpUrl?: string;
    cdp_url?: string;
    timeoutAt?: string;
    timeout_at?: string;
    startedAt?: string;
    started_at?: string;
    finishedAt?: string | null;
    finished_at?: string | null;
}
export declare class CloudBrowserResponse {
    id: string;
    status: string;
    liveUrl: string;
    cdpUrl: string;
    timeoutAt: string;
    startedAt: string;
    finishedAt: string | null;
    constructor(payload: CloudBrowserResponsePayload);
}
export declare class CloudBrowserError extends Error {
    constructor(message: string);
}
export declare class CloudBrowserAuthError extends CloudBrowserError {
    constructor(message: string);
}
