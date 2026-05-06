import axios from 'axios';
import { createLogger } from '../logging-config.js';
import { CONFIG } from '../config.js';
import { DeviceAuthClient, TEMP_USER_ID } from './auth.js';
const logger = createLogger('browser_use.sync');
const stripTrailingSlash = (input) => input.replace(/\/+$/, '');
const ensureArray = (value) => Array.isArray(value) ? value : [value];
export class CloudSync {
    baseUrl;
    enabled;
    auth_client;
    sessionId = null;
    allowSessionEventsForAuth;
    authFlowActive = false;
    constructor(options = {}) {
        const enableAuth = options.enableAuth ?? true;
        this.baseUrl = stripTrailingSlash(options.baseUrl ?? CONFIG.BROWSER_USE_CLOUD_API_URL);
        this.enabled = CONFIG.BROWSER_USE_CLOUD_SYNC && enableAuth;
        this.allowSessionEventsForAuth = options.allowSessionEventsForAuth ?? false;
        this.auth_client = new DeviceAuthClient(this.baseUrl);
    }
    async handle_event(event) {
        try {
            if (!this.enabled) {
                return;
            }
            if (event.event_type === 'CreateAgentSessionEvent' &&
                event?.id != null) {
                this.sessionId = String(event.id);
            }
            if (this.auth_client.is_authenticated) {
                await this.sendEvent(event);
                return;
            }
            if (this.allowSessionEventsForAuth || this.authFlowActive) {
                await this.sendEvent(event);
                if (event.event_type === 'CreateAgentSessionEvent') {
                    this.authFlowActive = true;
                }
                return;
            }
            logger.debug(`Skipping event ${event.event_type} - user not authenticated`);
        }
        catch (error) {
            logger.error(`Failed to handle ${event.event_type}: ${error.message}`);
        }
    }
    async sendEvent(event) {
        try {
            const headers = {};
            const currentUserId = event.user_id ?? null;
            if (this.auth_client.is_authenticated) {
                if (currentUserId !== TEMP_USER_ID) {
                    event.user_id = this.auth_client.user_id;
                }
            }
            else if (!currentUserId) {
                event.user_id = TEMP_USER_ID;
            }
            Object.assign(headers, this.auth_client.get_headers());
            event.device_id =
                event.device_id ?? this.auth_client.device_id;
            const payload = typeof event?.toJSON === 'function'
                ? event.toJSON()
                : { ...event };
            const events = ensureArray(payload);
            await axios.post(`${this.baseUrl}/api/v1/events`, {
                events: events.map((entry) => ({
                    ...entry,
                    device_id: entry.device_id ?? this.auth_client.device_id,
                })),
            }, { headers, timeout: 10_000 });
        }
        catch (error) {
            const status = error?.response?.status;
            if (status) {
                logger.debug(`Failed to send sync event: POST ${this.baseUrl}/api/v1/events ${status} - ${String(error?.response?.data ?? '')}`);
            }
            else if (error?.code === 'ECONNABORTED') {
                logger.debug(`Event send timed out after 10 seconds: ${event}`);
            }
            else {
                logger.debug(`Unexpected error sending event ${event}: ${typeOfError(error)}`);
            }
        }
    }
    set_auth_flow_active() {
        this.authFlowActive = true;
        this.allowSessionEventsForAuth = true;
    }
    // Backward-compatible no-op; auth is no longer background-scheduled here.
    async wait_for_auth() { }
    async authenticate(showInstructions = true) {
        if (!this.enabled) {
            return false;
        }
        if (this.auth_client.is_authenticated) {
            if (showInstructions) {
                logger.info('✅ Already authenticated! Skipping OAuth flow.');
            }
            return true;
        }
        return this.auth_client.authenticate(this.sessionId, showInstructions);
    }
}
const typeOfError = (error) => {
    if (error instanceof Error) {
        return `${error.name}: ${error.message}`;
    }
    return String(error);
};
