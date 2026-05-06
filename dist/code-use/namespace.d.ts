import type { BrowserSession } from '../browser/session.js';
export interface CreateNamespaceOptions {
    namespace?: Record<string, unknown>;
}
export declare const create_namespace: (browser_session: BrowserSession, options?: CreateNamespaceOptions) => Record<string, unknown>;
