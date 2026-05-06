import { BrowserSession } from '../browser/session.js';
export class SessionRegistry {
    sessions = new Map();
    session_factory;
    constructor(options = {}) {
        this.session_factory =
            options.session_factory ?? (() => new BrowserSession());
    }
    async get_or_create_session(name) {
        const existing = this.sessions.get(name);
        if (existing) {
            existing.updated_at = new Date();
            return existing;
        }
        const browser_session = this.session_factory(name);
        const session = {
            name,
            browser_session,
            created_at: new Date(),
            updated_at: new Date(),
        };
        this.sessions.set(name, session);
        return session;
    }
    list_sessions() {
        return [...this.sessions.values()].map((session) => ({
            name: session.name,
            created_at: session.created_at.toISOString(),
            updated_at: session.updated_at.toISOString(),
            tab_count: session.browser_session.tabs.length,
        }));
    }
    async close_session(name) {
        const existing = this.sessions.get(name);
        if (!existing) {
            return false;
        }
        await existing.browser_session.stop();
        this.sessions.delete(name);
        return true;
    }
    async close_all() {
        for (const name of [...this.sessions.keys()]) {
            await this.close_session(name);
        }
    }
}
