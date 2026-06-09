import {
  CodeAgentHistory,
  CodeAgentHistoryList,
  type CodeAgentModelOutput,
  type CodeAgentResult,
  CodeAgentState,
  CodeAgentStepMetadata,
  NotebookSession,
} from './views.js';
import { create_namespace } from './namespace.js';
import type { BrowserSession } from '../browser/session.js';

type ExecutorFn = (
  source: string,
  namespace: Record<string, unknown>
) => Promise<unknown>;

const AsyncFunction = Object.getPrototypeOf(async function () {
  return undefined;
}).constructor as new (
  ...args: string[]
) => (...args: unknown[]) => Promise<unknown>;

const default_executor: ExecutorFn = async (source, namespace) => {
  const injectableNames = Object.keys(namespace).filter((name) =>
    /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)
  );
  const prelude = injectableNames
    .map((name) => `const ${name} = namespace[${JSON.stringify(name)}];`)
    .join('\n');
  const runner = new AsyncFunction(
    'namespace',
    `${prelude}\n${source}\nreturn undefined;`
  );
  return runner(namespace);
};

export interface CodeAgentOptions {
  task: string;
  browser_session: BrowserSession;
  namespace?: Record<string, unknown>;
  executor?: ExecutorFn;
}

export class CodeAgent {
  task: string;
  browser_session: BrowserSession;
  session: NotebookSession;
  namespace: Record<string, unknown>;
  complete_history: CodeAgentHistory[] = [];
  private readonly executor: ExecutorFn;

  constructor(options: CodeAgentOptions) {
    this.task = options.task;
    this.browser_session = options.browser_session;
    this.namespace = create_namespace(
      options.browser_session,
      options.namespace ? { namespace: options.namespace } : {}
    );
    this.session = new NotebookSession({ namespace: this.namespace });
    this.executor = options.executor ?? default_executor;
  }

  add_cell(source: string) {
    return this.session.add_cell(source);
  }

  async execute_cell(source: string) {
    return this._run_cell(this.add_cell(source));
  }

  private async _run_cell(cell: ReturnType<NotebookSession['add_cell']>) {
    const startedAt = Date.now() / 1000;
    cell.status = 'running';
    cell.execution_count = this.session.increment_execution_count();

    let resultItem: CodeAgentResult;
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
        success:
          typeof this.namespace._task_success === 'boolean'
            ? (this.namespace._task_success as boolean)
            : null,
      };
    } catch (error) {
      cell.status = 'error';
      cell.output = null;
      cell.error = String((error as Error)?.message ?? error);
      resultItem = {
        extracted_content: null,
        error: cell.error,
        is_done: false,
        success: false,
      };
    }

    const page = await this.browser_session.get_current_page();
    await this.browser_session.validate_page_after_action(page ?? null);
    const state = new CodeAgentState({
      url: typeof page?.url === 'function' ? page.url() : null,
      title: typeof page?.title === 'function' ? await page.title() : null,
    });
    const metadata = new CodeAgentStepMetadata({
      step_start_time: startedAt,
      step_end_time: Date.now() / 1000,
    });
    const modelOutput: CodeAgentModelOutput = {
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
    const pending = this.session.cells.filter(
      (cell) => cell.status === 'pending'
    );
    const toRun = pending.slice(0, Math.max(max_steps, 0));
    for (const cell of toRun) {
      await this._run_cell(cell);
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
