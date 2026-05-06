export declare abstract class BaseTelemetryEvent {
    abstract name: string;
    properties(): Record<string, unknown>;
}
type BaseSequence = Array<string | null | undefined> | undefined;
export interface AgentTelemetryPayload {
    task: string;
    model: string;
    model_provider: string;
    max_steps: number;
    max_actions_per_step: number;
    use_vision: boolean | 'auto';
    version: string;
    source: string;
    cdp_url: string | null;
    agent_type: string | null;
    action_errors: BaseSequence;
    action_history: Array<Array<Record<string, unknown>> | null> | undefined;
    urls_visited: BaseSequence;
    steps: number;
    total_input_tokens: number;
    total_output_tokens: number;
    prompt_cached_tokens: number;
    total_tokens: number;
    total_duration_seconds: number;
    success: boolean | null;
    final_result_response: string | null;
    error_message: string | null;
    judge_verdict?: boolean | null;
    judge_reasoning?: string | null;
    judge_failure_reason?: string | null;
    judge_reached_captcha?: boolean | null;
    judge_impossible_task?: boolean | null;
}
export declare class AgentTelemetryEvent extends BaseTelemetryEvent implements AgentTelemetryPayload {
    name: string;
    task: string;
    model: string;
    model_provider: string;
    max_steps: number;
    max_actions_per_step: number;
    use_vision: boolean | 'auto';
    version: string;
    source: string;
    cdp_url: string | null;
    agent_type: string | null;
    action_errors: BaseSequence;
    action_history: Array<Array<Record<string, unknown>> | null> | undefined;
    urls_visited: BaseSequence;
    steps: number;
    total_input_tokens: number;
    total_output_tokens: number;
    prompt_cached_tokens: number;
    total_tokens: number;
    total_duration_seconds: number;
    success: boolean | null;
    final_result_response: string | null;
    error_message: string | null;
    judge_verdict: boolean | null;
    judge_reasoning: string | null;
    judge_failure_reason: string | null;
    judge_reached_captcha: boolean | null;
    judge_impossible_task: boolean | null;
    constructor(payload: AgentTelemetryPayload);
}
export interface MCPClientTelemetryPayload {
    server_name: string;
    command: string;
    tools_discovered: number;
    version: string;
    action: string;
    tool_name?: string | null;
    duration_seconds?: number | null;
    error_message?: string | null;
}
export declare class MCPClientTelemetryEvent extends BaseTelemetryEvent implements MCPClientTelemetryPayload {
    name: string;
    server_name: string;
    command: string;
    tools_discovered: number;
    version: string;
    action: string;
    tool_name: string | null;
    duration_seconds: number | null;
    error_message: string | null;
    constructor(payload: MCPClientTelemetryPayload);
}
export interface MCPServerTelemetryPayload {
    version: string;
    action: string;
    tool_name?: string | null;
    duration_seconds?: number | null;
    error_message?: string | null;
    parent_process_cmdline?: string | null;
}
export declare class MCPServerTelemetryEvent extends BaseTelemetryEvent implements MCPServerTelemetryPayload {
    name: string;
    version: string;
    action: string;
    tool_name: string | null;
    duration_seconds: number | null;
    error_message: string | null;
    parent_process_cmdline: string | null;
    constructor(payload: MCPServerTelemetryPayload);
}
export interface CLITelemetryPayload {
    version: string;
    action: string;
    mode: string;
    model?: string | null;
    model_provider?: string | null;
    duration_seconds?: number | null;
    error_message?: string | null;
}
export declare class CLITelemetryEvent extends BaseTelemetryEvent implements CLITelemetryPayload {
    name: string;
    version: string;
    action: string;
    mode: string;
    model: string | null;
    model_provider: string | null;
    duration_seconds: number | null;
    error_message: string | null;
    constructor(payload: CLITelemetryPayload);
}
export {};
