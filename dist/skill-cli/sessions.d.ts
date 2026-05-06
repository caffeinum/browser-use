import { BrowserSession } from '../browser/session.js';
export interface SessionInfo {
    name: string;
    browser_session: BrowserSession;
    created_at: Date;
    updated_at: Date;
}
export interface SessionRegistryOptions {
    session_factory?: (name: string) => BrowserSession;
}
export declare class SessionRegistry {
    private readonly sessions;
    private readonly session_factory;
    constructor(options?: SessionRegistryOptions);
    get_or_create_session(name: string): Promise<SessionInfo>;
    list_sessions(): {
        name: string;
        created_at: string;
        updated_at: string;
        tab_count: number;
    }[];
    close_session(name: string): Promise<boolean>;
    close_all(): Promise<void>;
}
