import type { BrowserStateSummary } from '../browser/views.js';
import type { BrowserSession } from '../browser/session.js';
export declare const format_browser_state_for_llm: (state: BrowserStateSummary, namespace: Record<string, unknown>, _browser_session: BrowserSession) => Promise<string>;
