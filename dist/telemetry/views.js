import { is_running_in_docker } from '../config.js';
export class BaseTelemetryEvent {
    properties() {
        const entries = Object.entries(this).filter(([key]) => key !== 'name');
        return {
            ...Object.fromEntries(entries),
            is_docker: is_running_in_docker(),
        };
    }
}
export class AgentTelemetryEvent extends BaseTelemetryEvent {
    name = 'agent_event';
    task;
    model;
    model_provider;
    max_steps;
    max_actions_per_step;
    use_vision;
    version;
    source;
    cdp_url;
    agent_type;
    action_errors;
    action_history;
    urls_visited;
    steps;
    total_input_tokens;
    total_output_tokens;
    prompt_cached_tokens;
    total_tokens;
    total_duration_seconds;
    success;
    final_result_response;
    error_message;
    judge_verdict;
    judge_reasoning;
    judge_failure_reason;
    judge_reached_captcha;
    judge_impossible_task;
    constructor(payload) {
        super();
        this.task = payload.task;
        this.model = payload.model;
        this.model_provider = payload.model_provider;
        this.max_steps = payload.max_steps;
        this.max_actions_per_step = payload.max_actions_per_step;
        this.use_vision = payload.use_vision;
        this.version = payload.version;
        this.source = payload.source;
        this.cdp_url = payload.cdp_url;
        this.agent_type = payload.agent_type;
        this.action_errors = payload.action_errors;
        this.action_history = payload.action_history;
        this.urls_visited = payload.urls_visited;
        this.steps = payload.steps;
        this.total_input_tokens = payload.total_input_tokens;
        this.total_output_tokens = payload.total_output_tokens;
        this.prompt_cached_tokens = payload.prompt_cached_tokens;
        this.total_tokens = payload.total_tokens;
        this.total_duration_seconds = payload.total_duration_seconds;
        this.success = payload.success;
        this.final_result_response = payload.final_result_response;
        this.error_message = payload.error_message;
        this.judge_verdict = payload.judge_verdict ?? null;
        this.judge_reasoning = payload.judge_reasoning ?? null;
        this.judge_failure_reason = payload.judge_failure_reason ?? null;
        this.judge_reached_captcha = payload.judge_reached_captcha ?? null;
        this.judge_impossible_task = payload.judge_impossible_task ?? null;
    }
}
export class MCPClientTelemetryEvent extends BaseTelemetryEvent {
    name = 'mcp_client_event';
    server_name;
    command;
    tools_discovered;
    version;
    action;
    tool_name;
    duration_seconds;
    error_message;
    constructor(payload) {
        super();
        this.server_name = payload.server_name;
        this.command = payload.command;
        this.tools_discovered = payload.tools_discovered;
        this.version = payload.version;
        this.action = payload.action;
        this.tool_name = payload.tool_name ?? null;
        this.duration_seconds = payload.duration_seconds ?? null;
        this.error_message = payload.error_message ?? null;
    }
}
export class MCPServerTelemetryEvent extends BaseTelemetryEvent {
    name = 'mcp_server_event';
    version;
    action;
    tool_name;
    duration_seconds;
    error_message;
    parent_process_cmdline;
    constructor(payload) {
        super();
        this.version = payload.version;
        this.action = payload.action;
        this.tool_name = payload.tool_name ?? null;
        this.duration_seconds = payload.duration_seconds ?? null;
        this.error_message = payload.error_message ?? null;
        this.parent_process_cmdline = payload.parent_process_cmdline ?? null;
    }
}
export class CLITelemetryEvent extends BaseTelemetryEvent {
    name = 'cli_event';
    version;
    action;
    mode;
    model;
    model_provider;
    duration_seconds;
    error_message;
    constructor(payload) {
        super();
        this.version = payload.version;
        this.action = payload.action;
        this.mode = payload.mode;
        this.model = payload.model ?? null;
        this.model_provider = payload.model_provider ?? null;
        this.duration_seconds = payload.duration_seconds ?? null;
        this.error_message = payload.error_message ?? null;
    }
}
