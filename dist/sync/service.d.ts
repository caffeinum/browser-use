import type { BaseEvent } from '../agent/cloud-events.js';
import { DeviceAuthClient } from './auth.js';
export interface CloudSyncOptions {
    baseUrl?: string;
    enableAuth?: boolean;
    allowSessionEventsForAuth?: boolean;
}
export declare class CloudSync {
    private readonly baseUrl;
    private readonly enabled;
    readonly auth_client: DeviceAuthClient;
    private sessionId;
    private allowSessionEventsForAuth;
    private authFlowActive;
    constructor(options?: CloudSyncOptions);
    handle_event(event: BaseEvent): Promise<void>;
    private sendEvent;
    set_auth_flow_active(): void;
    wait_for_auth(): Promise<void>;
    authenticate(showInstructions?: boolean): Promise<boolean>;
}
