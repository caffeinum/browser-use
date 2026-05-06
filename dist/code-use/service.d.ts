import { CodeAgentHistory, CodeAgentHistoryList, NotebookSession } from './views.js';
import type { BrowserSession } from '../browser/session.js';
type ExecutorFn = (source: string, namespace: Record<string, unknown>) => Promise<unknown>;
export interface CodeAgentOptions {
    task: string;
    browser_session: BrowserSession;
    namespace?: Record<string, unknown>;
    executor?: ExecutorFn;
}
export declare class CodeAgent {
    task: string;
    browser_session: BrowserSession;
    session: NotebookSession;
    namespace: Record<string, unknown>;
    complete_history: CodeAgentHistory[];
    private readonly executor;
    constructor(options: CodeAgentOptions);
    add_cell(source: string): import("./views.js").CodeCell;
    execute_cell(source: string): Promise<import("./views.js").CodeCell>;
    run(max_steps?: number): Promise<CodeAgentHistoryList>;
    get history(): CodeAgentHistoryList;
    close(): Promise<void>;
}
export {};
