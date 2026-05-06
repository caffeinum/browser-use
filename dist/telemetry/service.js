import fs from 'node:fs';
import path from 'node:path';
import { PostHog } from 'posthog-node';
import { createLogger } from '../logging-config.js';
import { CONFIG } from '../config.js';
import { uuid7str } from '../utils.js';
const logger = createLogger('browser_use.telemetry');
const POSTHOG_EVENT_SETTINGS = {
    process_person_profile: true,
};
export class ProductTelemetry {
    client = null;
    debugLogging;
    userIdFile;
    cachedUserId = null;
    constructor() {
        this.debugLogging = CONFIG.BROWSER_USE_LOGGING_LEVEL === 'debug';
        this.userIdFile = path.join(CONFIG.BROWSER_USE_CONFIG_DIR, 'device_id');
        if (!CONFIG.ANONYMIZED_TELEMETRY) {
            logger.debug('Telemetry disabled');
            return;
        }
        try {
            this.client = new PostHog('phc_F8JMNjW1i2KbGUTaW1unnDdLSPCoyc52SGRU0JecaUh', {
                host: 'https://eu.i.posthog.com',
                disableGeoip: false,
                enableExceptionAutocapture: true,
            });
        }
        catch (error) {
            logger.error(`Failed to initialize PostHog client: ${error.message}`);
            this.client = null;
        }
    }
    capture(event) {
        if (!this.client) {
            return;
        }
        try {
            this.client.capture({
                distinctId: this.userId,
                event: event.name,
                properties: {
                    ...event.properties(),
                    ...POSTHOG_EVENT_SETTINGS,
                },
            });
        }
        catch (error) {
            logger.error(`Failed to send telemetry event ${event.name}: ${error.message}`);
        }
    }
    flush() {
        if (!this.client) {
            return;
        }
        try {
            this.client.flush();
            logger.debug('PostHog client telemetry queue flushed.');
        }
        catch (error) {
            logger.error(`Failed to flush PostHog client: ${error.message}`);
        }
    }
    get userId() {
        if (this.cachedUserId) {
            return this.cachedUserId;
        }
        try {
            if (!fs.existsSync(this.userIdFile)) {
                fs.mkdirSync(path.dirname(this.userIdFile), { recursive: true });
                this.cachedUserId = uuid7str();
                fs.writeFileSync(this.userIdFile, this.cachedUserId, 'utf-8');
            }
            else {
                this.cachedUserId = fs.readFileSync(this.userIdFile, 'utf-8');
            }
        }
        catch {
            this.cachedUserId = 'UNKNOWN_USER_ID';
        }
        return this.cachedUserId;
    }
}
export const productTelemetry = new ProductTelemetry();
