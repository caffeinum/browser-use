import { CONFIG } from '../../config.js';
import { DeviceAuthClient } from '../../sync/auth.js';
import { CloudBrowserAuthError, CloudBrowserError } from './views.js';
const stripTrailingSlash = (input) => input.replace(/\/+$/, '');
export class CloudManagementClient {
    api_base_url;
    explicit_api_key;
    fetch_impl;
    constructor(options = {}) {
        this.api_base_url = stripTrailingSlash(options.api_base_url ?? CONFIG.BROWSER_USE_CLOUD_API_URL);
        this.explicit_api_key = options.api_key ?? null;
        this.fetch_impl = options.fetch_impl ?? fetch;
    }
    resolve_api_key() {
        if (this.explicit_api_key?.trim()) {
            return this.explicit_api_key.trim();
        }
        if (process.env.BROWSER_USE_API_KEY?.trim()) {
            return process.env.BROWSER_USE_API_KEY.trim();
        }
        const savedToken = new DeviceAuthClient(this.api_base_url).api_token?.trim();
        return savedToken || null;
    }
    auth_headers(extra_headers = {}) {
        const api_key = this.resolve_api_key();
        if (!api_key) {
            throw new CloudBrowserAuthError('No authentication token found. Set BROWSER_USE_API_KEY to use cloud APIs.');
        }
        return {
            'X-Browser-Use-API-Key': api_key,
            'Content-Type': 'application/json',
            ...extra_headers,
        };
    }
    async request_json(path, init) {
        const response = await this.fetch_impl(`${this.api_base_url}${path}`, {
            ...init,
            headers: this.auth_headers(init.headers),
        });
        const text = await response.text();
        let payload = null;
        if (text) {
            try {
                payload = JSON.parse(text);
            }
            catch {
                payload = text;
            }
        }
        if (!response.ok) {
            const details = payload && typeof payload === 'object'
                ? JSON.stringify(payload)
                : String(payload ?? '');
            if (response.status === 401 || response.status === 403) {
                throw new CloudBrowserAuthError(`Cloud API authentication failed (${response.status})`);
            }
            throw new CloudBrowserError(`Cloud API request failed (${response.status}): ${details}`);
        }
        return payload;
    }
    build_query(params) {
        const query = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null && String(value).length > 0) {
                query.set(key, String(value));
            }
        }
        const rendered = query.toString();
        return rendered ? `?${rendered}` : '';
    }
    async list_tasks(options = {}) {
        return await this.request_json(`/api/v2/tasks${this.build_query(options)}`, { method: 'GET' });
    }
    async create_task(request) {
        return await this.request_json('/api/v2/tasks', {
            method: 'POST',
            body: JSON.stringify(request),
        });
    }
    async get_task(task_id) {
        return await this.request_json(`/api/v2/tasks/${encodeURIComponent(task_id)}`, { method: 'GET' });
    }
    async update_task(task_id, action) {
        return await this.request_json(`/api/v2/tasks/${encodeURIComponent(task_id)}`, {
            method: 'PATCH',
            body: JSON.stringify({ action }),
        });
    }
    async get_task_logs(task_id) {
        return await this.request_json(`/api/v2/tasks/${encodeURIComponent(task_id)}/logs`, { method: 'GET' });
    }
    async list_sessions(options = {}) {
        return await this.request_json(`/api/v2/sessions${this.build_query(options)}`, { method: 'GET' });
    }
    async create_session(request) {
        return await this.request_json('/api/v2/sessions', {
            method: 'POST',
            body: JSON.stringify(request),
        });
    }
    async get_session(session_id) {
        return await this.request_json(`/api/v2/sessions/${encodeURIComponent(session_id)}`, { method: 'GET' });
    }
    async update_session(session_id, action) {
        return await this.request_json(`/api/v2/sessions/${encodeURIComponent(session_id)}`, {
            method: 'PATCH',
            body: JSON.stringify({ action }),
        });
    }
    async delete_session(session_id) {
        await this.request_json(`/api/v2/sessions/${encodeURIComponent(session_id)}`, { method: 'DELETE' });
    }
    async create_session_public_share(session_id) {
        return await this.request_json(`/api/v2/sessions/${encodeURIComponent(session_id)}/public-share`, { method: 'POST' });
    }
    async delete_session_public_share(session_id) {
        await this.request_json(`/api/v2/sessions/${encodeURIComponent(session_id)}/public-share`, { method: 'DELETE' });
    }
    async list_profiles(options = {}) {
        return await this.request_json(`/api/v2/profiles${this.build_query(options)}`, { method: 'GET' });
    }
    async create_profile(request = {}) {
        return await this.request_json('/api/v2/profiles', {
            method: 'POST',
            body: JSON.stringify(request),
        });
    }
    async get_profile(profile_id) {
        return await this.request_json(`/api/v2/profiles/${encodeURIComponent(profile_id)}`, { method: 'GET' });
    }
    async update_profile(profile_id, request = {}) {
        return await this.request_json(`/api/v2/profiles/${encodeURIComponent(profile_id)}`, {
            method: 'PATCH',
            body: JSON.stringify(request),
        });
    }
    async delete_profile(profile_id) {
        await this.request_json(`/api/v2/profiles/${encodeURIComponent(profile_id)}`, { method: 'DELETE' });
    }
}
