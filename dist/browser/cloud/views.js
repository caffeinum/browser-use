export const MAX_FREE_USER_SESSION_TIMEOUT = 15;
export const MAX_PAID_USER_SESSION_TIMEOUT = 240;
export class CloudBrowserResponse {
    id;
    status;
    liveUrl;
    cdpUrl;
    timeoutAt;
    startedAt;
    finishedAt;
    constructor(payload) {
        if (!payload?.id || !payload?.status) {
            throw new CloudBrowserError('Invalid cloud browser response: missing id or status');
        }
        this.id = String(payload.id);
        this.status = String(payload.status);
        this.liveUrl = String(payload.liveUrl ?? payload.live_url ?? '');
        this.cdpUrl = String(payload.cdpUrl ?? payload.cdp_url ?? '');
        this.timeoutAt = String(payload.timeoutAt ?? payload.timeout_at ?? '');
        this.startedAt = String(payload.startedAt ?? payload.started_at ?? '');
        this.finishedAt = payload.finishedAt ?? payload.finished_at ?? null;
    }
}
export class CloudBrowserError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CloudBrowserError';
    }
}
export class CloudBrowserAuthError extends CloudBrowserError {
    constructor(message) {
        super(message);
        this.name = 'CloudBrowserAuthError';
    }
}
