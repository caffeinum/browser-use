import { CodeAgentHistory, CodeAgentHistoryList, CodeAgentState, CodeAgentStepMetadata, NotebookSession, } from './views.js';
import { create_namespace } from './namespace.js';
const AsyncFunction = Object.getPrototypeOf(async function () {
    return undefined;
}).constructor;
const default_executor = async (source, namespace) => {
    const injectableNames = Object.keys(namespace).filter((name) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name));
    const prelude = injectableNames
        .map((name) => `const ${name} = namespace[${JSON.stringify(name)}];`)
        .join('\n');
    const runner = new AsyncFunction('namespace', `${prelude}\n${source}\nreturn undefined;`);
    return runner(namespace);
};
export class CodeAgent {
    task;
    browser_session;
    session;
    namespace;
    complete_history = [];
    executor;
    constructor(options) {
        this.task = options.task;
        this.browser_session = options.browser_session;
        this.namespace = create_namespace(options.browser_session, options.namespace ? { namespace: options.namespace } : {});
        this.session = new NotebookSession({ namespace: this.namespace });
        this.executor = options.executor ?? default_executor;
    }
    add_cell(source) {
        return this.session.add_cell(source);
    }
    async execute_cell(source) {
        const cell = this.add_cell(source);
        const startedAt = Date.now() / 1000;
        cell.status = 'running';
        cell.execution_count = this.session.increment_execution_count();
        let resultItem;
        try {
            const output = await this.executor(cell.source, this.namespace);
            cell.status = 'success';
            cell.output =
                output == null
                    ? null
                    : typeof output === 'string'
                        ? output
                        : JSON.stringify(output);
            cell.error = null;
            resultItem = {
                extracted_content: cell.output,
                error: null,
                is_done: Boolean(this.namespace._task_done),
                success: typeof this.namespace._task_success === 'boolean'
                    ? this.namespace._task_success
                    : null,
            };
        }
        catch (error) {
            cell.status = 'error';
            cell.output = null;
            cell.error = String(error?.message ?? error);
            resultItem = {
                extracted_content: null,
                error: cell.error,
                is_done: false,
                success: false,
            };
        }
        const page = await this.browser_session.get_current_page();
        const state = new CodeAgentState({
            url: typeof page?.url === 'function' ? page.url() : null,
            title: typeof page?.title === 'function' ? await page.title() : null,
        });
        const metadata = new CodeAgentStepMetadata({
            step_start_time: startedAt,
            step_end_time: Date.now() / 1000,
        });
        const modelOutput = {
            model_output: cell.source,
            full_response: cell.source,
        };
        const historyItem = new CodeAgentHistory({
            model_output: modelOutput,
            result: [resultItem],
            state,
            metadata,
        });
        this.complete_history.push(historyItem);
        this.session._complete_history = [...this.complete_history];
        return cell;
    }
    async run(max_steps = 100) {
        const pending = this.session.cells.filter((cell) => cell.status === 'pending');
        const toRun = pending.slice(0, Math.max(max_steps, 0));
        for (const cell of toRun) {
            await this.execute_cell(cell.source);
        }
        return this.history;
    }
    get history() {
        return new CodeAgentHistoryList(this.complete_history, null);
    }
    async close() {
        // Keep lifecycle explicit; caller controls browser shutdown.
    }
}
