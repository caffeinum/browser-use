import type { UsageSummary } from '../tokens/views.js';
export type CellType = 'code' | 'markdown';
export type ExecutionStatus = 'pending' | 'running' | 'success' | 'error';
export interface CodeCellInit {
    id?: string;
    cell_type?: CellType;
    source: string;
    output?: string | null;
    execution_count?: number | null;
    status?: ExecutionStatus;
    error?: string | null;
    browser_state?: string | null;
}
export declare class CodeCell {
    id: string;
    cell_type: CellType;
    source: string;
    output: string | null;
    execution_count: number | null;
    status: ExecutionStatus;
    error: string | null;
    browser_state: string | null;
    constructor(init: CodeCellInit);
}
export interface CodeAgentModelOutput {
    model_output: string;
    full_response: string;
}
export interface CodeAgentResult {
    extracted_content?: string | null;
    error?: string | null;
    is_done: boolean;
    success?: boolean | null;
}
export declare class CodeAgentState {
    url: string | null;
    title: string | null;
    screenshot_path: string | null;
    constructor(init: {
        url?: string | null;
        title?: string | null;
        screenshot_path?: string | null;
    });
    get_screenshot(): string | null;
}
export declare class CodeAgentStepMetadata {
    input_tokens: number | null;
    output_tokens: number | null;
    step_start_time: number;
    step_end_time: number;
    constructor(init: {
        input_tokens?: number | null;
        output_tokens?: number | null;
        step_start_time: number;
        step_end_time: number;
    });
    get duration_seconds(): number;
}
export declare class CodeAgentHistory {
    model_output: CodeAgentModelOutput | null;
    result: CodeAgentResult[];
    state: CodeAgentState;
    metadata: CodeAgentStepMetadata | null;
    screenshot_path: string | null;
    constructor(init: {
        model_output?: CodeAgentModelOutput | null;
        result?: CodeAgentResult[];
        state: CodeAgentState;
        metadata?: CodeAgentStepMetadata | null;
        screenshot_path?: string | null;
    });
}
export declare class CodeAgentHistoryList {
    private readonly complete_history;
    private readonly usage_summary;
    constructor(complete_history: CodeAgentHistory[], usage_summary?: UsageSummary | null);
    get history(): CodeAgentHistory[];
    get usage(): UsageSummary | null;
    final_result(): string | null;
    is_done(): boolean;
    is_successful(): boolean | null;
    errors(): (string | null)[];
    has_errors(): boolean;
    urls(): (string | null)[];
    action_results(): CodeAgentResult[];
    extracted_content(): string[];
    number_of_steps(): number;
    total_duration_seconds(): number;
}
export declare class NotebookSession {
    id: string;
    cells: CodeCell[];
    current_execution_count: number;
    namespace: Record<string, unknown>;
    _complete_history: CodeAgentHistory[];
    _usage_summary: UsageSummary | null;
    constructor(init?: {
        id?: string;
        cells?: CodeCell[];
        current_execution_count?: number;
        namespace?: Record<string, unknown>;
    });
    add_cell(source: string): CodeCell;
    get_cell(cell_id: string): CodeCell | null;
    get_latest_cell(): CodeCell;
    increment_execution_count(): number;
    get history(): CodeAgentHistoryList;
}
