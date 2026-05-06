import fs from 'node:fs';
import { uuid7str } from '../utils.js';
export class CodeCell {
    id;
    cell_type;
    source;
    output;
    execution_count;
    status;
    error;
    browser_state;
    constructor(init) {
        this.id = init.id ?? uuid7str();
        this.cell_type = init.cell_type ?? 'code';
        this.source = init.source;
        this.output = init.output ?? null;
        this.execution_count = init.execution_count ?? null;
        this.status = init.status ?? 'pending';
        this.error = init.error ?? null;
        this.browser_state = init.browser_state ?? null;
    }
}
export class CodeAgentState {
    url;
    title;
    screenshot_path;
    constructor(init) {
        this.url = init.url ?? null;
        this.title = init.title ?? null;
        this.screenshot_path = init.screenshot_path ?? null;
    }
    get_screenshot() {
        if (!this.screenshot_path || !fs.existsSync(this.screenshot_path)) {
            return null;
        }
        return Buffer.from(fs.readFileSync(this.screenshot_path)).toString('base64');
    }
}
export class CodeAgentStepMetadata {
    input_tokens;
    output_tokens;
    step_start_time;
    step_end_time;
    constructor(init) {
        this.input_tokens = init.input_tokens ?? null;
        this.output_tokens = init.output_tokens ?? null;
        this.step_start_time = init.step_start_time;
        this.step_end_time = init.step_end_time;
    }
    get duration_seconds() {
        return this.step_end_time - this.step_start_time;
    }
}
export class CodeAgentHistory {
    model_output;
    result;
    state;
    metadata;
    screenshot_path;
    constructor(init) {
        this.model_output = init.model_output ?? null;
        this.result = init.result ?? [];
        this.state = init.state;
        this.metadata = init.metadata ?? null;
        this.screenshot_path = init.screenshot_path ?? null;
    }
}
export class CodeAgentHistoryList {
    complete_history;
    usage_summary;
    constructor(complete_history, usage_summary = null) {
        this.complete_history = complete_history;
        this.usage_summary = usage_summary;
    }
    get history() {
        return this.complete_history;
    }
    get usage() {
        return this.usage_summary;
    }
    final_result() {
        const last = this.complete_history[this.complete_history.length - 1];
        if (!last?.result?.length) {
            return null;
        }
        return last.result[last.result.length - 1].extracted_content ?? null;
    }
    is_done() {
        const last = this.complete_history[this.complete_history.length - 1];
        if (!last?.result?.length) {
            return false;
        }
        return Boolean(last.result[last.result.length - 1].is_done);
    }
    is_successful() {
        const last = this.complete_history[this.complete_history.length - 1];
        if (!last?.result?.length) {
            return null;
        }
        const final = last.result[last.result.length - 1];
        return final.is_done ? (final.success ?? null) : null;
    }
    errors() {
        return this.complete_history.map((entry) => {
            const withError = entry.result.find((result) => Boolean(result.error));
            return withError?.error ?? null;
        });
    }
    has_errors() {
        return this.errors().some((error) => Boolean(error));
    }
    urls() {
        return this.complete_history.map((entry) => entry.state.url);
    }
    action_results() {
        return this.complete_history.flatMap((entry) => entry.result);
    }
    extracted_content() {
        return this.action_results()
            .map((entry) => entry.extracted_content ?? null)
            .filter((entry) => typeof entry === 'string');
    }
    number_of_steps() {
        return this.complete_history.length;
    }
    total_duration_seconds() {
        return this.complete_history.reduce((sum, entry) => {
            return sum + (entry.metadata?.duration_seconds ?? 0);
        }, 0);
    }
}
export class NotebookSession {
    id;
    cells;
    current_execution_count;
    namespace;
    _complete_history;
    _usage_summary;
    constructor(init = {}) {
        this.id = init.id ?? uuid7str();
        this.cells = init.cells ?? [];
        this.current_execution_count = init.current_execution_count ?? 0;
        this.namespace = init.namespace ?? {};
        this._complete_history = [];
        this._usage_summary = null;
    }
    add_cell(source) {
        const cell = new CodeCell({ source });
        this.cells.push(cell);
        return cell;
    }
    get_cell(cell_id) {
        return this.cells.find((cell) => cell.id === cell_id) ?? null;
    }
    get_latest_cell() {
        return this.cells[this.cells.length - 1] ?? null;
    }
    increment_execution_count() {
        this.current_execution_count += 1;
        return this.current_execution_count;
    }
    get history() {
        return new CodeAgentHistoryList(this._complete_history, this._usage_summary);
    }
}
