import { createLogger } from '../logging-config.js';
import { EventBus } from '../event-bus.js';
import type { Controller } from '../controller/service.js';
import type { FileSystem } from '../filesystem/file-system.js';
import { SystemPrompt } from './prompts.js';
import { MessageManager } from './message-manager/service.js';
import { BrowserStateSummary } from '../browser/views.js';
import { BrowserSession } from '../browser/session.js';
import { BrowserProfile } from '../browser/profile.js';
import type { Browser, BrowserContext, Page } from '../browser/types.js';
import type { BaseChatModel } from '../llm/base.js';
import { ContentPartImageParam, ContentPartTextParam } from '../llm/messages.js';
import { ActionResult, AgentHistoryList, AgentOutput, AgentSettings, AgentState, AgentStepInfo, ActionModel, DetectedVariable, MessageCompactionSettings } from './views.js';
import type { StructuredOutputParser } from './views.js';
import { ScreenshotService } from '../screenshots/service.js';
import { ProductTelemetry } from '../telemetry/service.js';
import { type SkillService } from '../skills/index.js';
export declare const log_response: (response: AgentOutput, registry?: Controller<any>, logInstance?: import("../logging-config.js").Logger) => void;
type ControllerContext = unknown;
type AgentHookFunc<Context, AgentStructuredOutput> = (agent: Agent<Context, AgentStructuredOutput>) => Promise<void> | void;
interface RerunHistoryOptions {
    max_retries?: number;
    skip_failures?: boolean;
    delay_between_actions?: number;
    max_step_interval?: number;
    wait_for_elements?: boolean;
    summary_llm?: BaseChatModel | null;
    ai_step_llm?: BaseChatModel | null;
    signal?: AbortSignal | null;
}
interface LoadAndRerunOptions extends RerunHistoryOptions {
    variables?: Record<string, string> | null;
}
interface AgentConstructorParams<Context, AgentStructuredOutput> {
    task: string;
    llm?: BaseChatModel | null;
    page?: Page | null;
    browser?: Browser | BrowserSession | null;
    browser_context?: BrowserContext | null;
    browser_profile?: BrowserProfile | null;
    browser_session?: BrowserSession | null;
    tools?: Controller<Context> | null;
    controller?: Controller<Context> | null;
    sensitive_data?: Record<string, string | Record<string, string>> | null;
    initial_actions?: Array<Record<string, Record<string, unknown>>> | null;
    directly_open_url?: boolean;
    register_new_step_callback?: ((summary: BrowserStateSummary, output: AgentOutput, step: number) => void | Promise<void>) | null;
    register_done_callback?: ((history: AgentHistoryList<AgentStructuredOutput>) => void | Promise<void>) | null;
    register_should_stop_callback?: (() => Promise<boolean>) | null;
    register_external_agent_status_raise_error_callback?: (() => Promise<boolean>) | null;
    output_model_schema?: StructuredOutputParser<AgentStructuredOutput> | null;
    extraction_schema?: Record<string, unknown> | null;
    use_vision?: boolean | 'auto';
    include_recent_events?: boolean;
    sample_images?: Array<ContentPartTextParam | ContentPartImageParam> | null;
    llm_screenshot_size?: [number, number] | null;
    save_conversation_path?: string | null;
    save_conversation_path_encoding?: BufferEncoding | null;
    max_failures?: number;
    override_system_message?: string | null;
    extend_system_message?: string | null;
    generate_gif?: boolean | string;
    available_file_paths?: string[] | null;
    include_attributes?: string[];
    max_actions_per_step?: number;
    use_thinking?: boolean;
    flash_mode?: boolean;
    use_judge?: boolean;
    ground_truth?: string | null;
    max_history_items?: number | null;
    page_extraction_llm?: BaseChatModel | null;
    fallback_llm?: BaseChatModel | null;
    judge_llm?: BaseChatModel | null;
    skill_ids?: Array<string | '*'> | null;
    skills?: Array<string | '*'> | null;
    skill_service?: SkillService | null;
    enable_planning?: boolean;
    planning_replan_on_stall?: number;
    planning_exploration_limit?: number;
    injected_agent_state?: AgentState | null;
    context?: Context | null;
    source?: string | null;
    file_system_path?: string | null;
    task_id?: string | null;
    cloud_sync?: any;
    calculate_cost?: boolean;
    display_files_in_done_text?: boolean;
    include_tool_call_examples?: boolean;
    vision_detail_level?: AgentSettings['vision_detail_level'];
    session_attachment_mode?: AgentSettings['session_attachment_mode'];
    llm_timeout?: number | null;
    step_timeout?: number;
    final_response_after_failure?: boolean;
    message_compaction?: MessageCompactionSettings | boolean | null;
    loop_detection_window?: number;
    loop_detection_enabled?: boolean;
    _url_shortening_limit?: number;
}
export declare class Agent<Context = ControllerContext, AgentStructuredOutput = unknown> {
    private static _sharedSessionStepLocks;
    static DEFAULT_AGENT_DATA_DIR: string;
    browser_session: BrowserSession | null;
    llm: BaseChatModel;
    judge_llm: BaseChatModel;
    unfiltered_actions: string;
    initial_actions: Array<Record<string, Record<string, unknown>>> | null;
    initial_url: string | null;
    register_new_step_callback: AgentConstructorParams<Context, AgentStructuredOutput>['register_new_step_callback'];
    register_done_callback: AgentConstructorParams<Context, AgentStructuredOutput>['register_done_callback'];
    register_should_stop_callback: AgentConstructorParams<Context, AgentStructuredOutput>['register_should_stop_callback'];
    register_external_agent_status_raise_error_callback: AgentConstructorParams<Context, AgentStructuredOutput>['register_external_agent_status_raise_error_callback'];
    context: Context | null;
    telemetry: ProductTelemetry;
    eventbus: EventBus;
    enable_cloud_sync: boolean;
    cloud_sync: any;
    file_system: FileSystem | null;
    screenshot_service: ScreenshotService | null;
    agent_directory: string;
    private _current_screenshot_path;
    has_downloads_path: boolean;
    private _last_known_downloads;
    version: string;
    source: string;
    step_start_time: number;
    _external_pause_event: {
        resolve: (() => void) | null;
        promise: Promise<void>;
    };
    output_model_schema: StructuredOutputParser<AgentStructuredOutput> | null;
    extraction_schema: Record<string, unknown> | null;
    id: string;
    task_id: string;
    session_id: string;
    task: string;
    controller: Controller<Context>;
    settings: AgentSettings;
    token_cost_service: any;
    state: AgentState;
    history: AgentHistoryList<AgentStructuredOutput>;
    _message_manager: MessageManager;
    available_file_paths: string[];
    sensitive_data: Record<string, string | Record<string, string>> | null;
    _logger: ReturnType<typeof createLogger> | null;
    _file_system_path: string | null;
    agent_current_page: Page | null;
    _session_start_time: number;
    _task_start_time: number;
    _force_exit_telemetry_logged: boolean;
    private _closePromise;
    private _hasBrowserSessionClaim;
    private _sharedPinnedTabId;
    private _enforceDoneOnlyForCurrentStep;
    system_prompt_class: SystemPrompt;
    ActionModel: typeof ActionModel;
    AgentOutput: typeof AgentOutput;
    DoneActionModel: typeof ActionModel;
    DoneAgentOutput: typeof AgentOutput;
    private _fallback_llm;
    private _using_fallback_llm;
    private _original_llm;
    private _url_shortening_limit;
    private skill_service;
    private _skills_registered;
    constructor(params: AgentConstructorParams<Context, AgentStructuredOutput>);
    private _normalizeMessageCompactionSetting;
    private _createSessionIdWithAgentSuffix;
    private _buildEventBusName;
    private _copyBrowserProfile;
    private _getBrowserContextFromPage;
    private _claim_or_isolate_browser_session;
    private _release_browser_session_claim;
    private _has_any_browser_session_attachments;
    private _is_shared_session_mode;
    private _capture_shared_pinned_tab;
    private _restore_shared_pinned_tab_if_needed;
    private _run_with_shared_session_step_lock;
    private _cleanup_shared_session_step_lock_if_unused;
    private _init_browser_session;
    /**
     * Convert dictionary-based actions to ActionModel instances
     */
    private _convertInitialActions;
    /**
     * Handle model-specific vision capabilities
     * Some models like DeepSeek and Grok don't support vision yet
     */
    private _handleModelSpecificVision;
    /**
     * Verify that the LLM API keys are setup and the LLM API is responding properly.
     * Also handles model capability detection.
     */
    private _verifyAndSetupLlm;
    /**
     * Validates security settings when sensitive_data is provided
     * Checks if allowed_domains is properly configured to prevent credential leakage
     */
    private _validateSecuritySettings;
    private _initFileSystem;
    private _setScreenshotService;
    get logger(): import("../logging-config.js").Logger;
    get message_manager(): MessageManager;
    /**
     * Get the browser instance from the browser session
     */
    get browser(): Browser;
    /**
     * Get the browser context from the browser session
     */
    get browserContext(): BrowserContext;
    /**
     * Get the browser profile from the browser session
     */
    get browserProfile(): BrowserProfile;
    get is_using_fallback_llm(): boolean;
    get current_llm_model(): string;
    /**
     * Add a new task to the agent, keeping the same task_id as tasks are continuous
     */
    addNewTask(newTask: string): void;
    private _enhanceTaskWithSchema;
    private _getOutputModelSchemaPayload;
    private _getToolsOutputModelSchema;
    private _getOutputModelSchemaName;
    private _resolveStructuredOutputActionSchema;
    private _extract_start_url;
    /**
     * Take a step and return whether the task is done and valid
     * @returns Tuple of [is_done, is_valid]
     */
    takeStep(stepInfo?: AgentStepInfo): Promise<[boolean, boolean]>;
    /**
     * Remove think tags from text
     */
    private _removeThinkTags;
    /**
     * Log a comprehensive summary of the next action(s)
     */
    private _logNextActionSummary;
    private _set_browser_use_version_and_source;
    /**
     * Setup dynamic action models from controller's registry
     * Initially only include actions with no filters
     */
    private _setup_action_models;
    private _register_skills_as_actions;
    private _get_unavailable_skills_info;
    /**
     * Update action models with page-specific actions
     * Called during each step to filter actions based on current page context
     */
    private _updateActionModelsForPage;
    private _execute_initial_actions;
    run(max_steps?: number, on_step_start?: AgentHookFunc<Context, AgentStructuredOutput> | null, on_step_end?: AgentHookFunc<Context, AgentStructuredOutput> | null): Promise<AgentHistoryList<AgentStructuredOutput>>;
    private _executeWithTimeout;
    _step(step_info?: AgentStepInfo | null, signal?: AbortSignal | null): Promise<void>;
    private _prepare_context;
    private _maybe_compact_messages;
    private _storeScreenshotForStep;
    private _get_next_action;
    private _execute_actions;
    private _post_process;
    multi_act(actions: Array<Record<string, Record<string, unknown>>>, options?: {
        check_for_new_elements?: boolean;
        signal?: AbortSignal | null;
    }): Promise<ActionResult[]>;
    private _generate_rerun_summary;
    private _execute_ai_step;
    rerun_history(history: AgentHistoryList, options?: RerunHistoryOptions): Promise<ActionResult[]>;
    private _execute_history_step;
    private _historyStepNeedsElementMatching;
    private _countExpectedElementsFromHistory;
    private _waitForMinimumElements;
    private _extractActionIndex;
    private _extractActionType;
    private _sameHistoryElement;
    private _is_redundant_retry_step;
    private _is_menu_opener_step;
    private _is_menu_item_element;
    private _reexecute_menu_opener;
    private _formatHistoryElementForError;
    private _update_action_indices;
    load_and_rerun(history_file?: string | null, options?: LoadAndRerunOptions): Promise<ActionResult[]>;
    detect_variables(): Record<string, DetectedVariable>;
    save_history(file_path?: string | null): void;
    private _coerceHistoryElement;
    private _substitute_variables_in_history;
    private _clone_history_for_substitution;
    private _createAbortError;
    private _throwIfAborted;
    private _relayAbortSignal;
    private _formatDelaySeconds;
    private _sleep;
    wait_until_resumed(): Promise<void>;
    log_completion(): Promise<void>;
    pause(): void;
    resume(): void;
    stop(): void;
    close(): Promise<void>;
    /**
     * Get the trace and trace_details objects for the agent
     * Contains comprehensive metadata about the agent run for debugging and analysis
     */
    get_trace_object(): {
        trace: Record<string, any>;
        trace_details: Record<string, any>;
    };
    private _log_agent_run;
    private _createInterruptedError;
    private _raise_if_stopped_or_paused;
    private _handle_post_llm_processing;
    /** Handle all types of errors that can occur during a step (python c011 parity). */
    private _handle_step_error;
    private _finalize;
    private _handle_final_step;
    private _max_total_failures;
    private _handle_failure_limit_recovery;
    private _update_plan_from_model_output;
    private _render_plan_description;
    private _inject_replan_nudge;
    private _inject_exploration_nudge;
    private _inject_loop_detection_nudge;
    private _update_loop_detector_actions;
    private _update_loop_detector_page_state;
    private _inject_budget_warning;
    private _run_simple_judge;
    private _judge_trace;
    private _judge_and_log;
    private _replace_urls_in_text;
    private _process_messages_and_replace_long_urls_shorter_ones;
    private _replace_shortened_urls_in_string;
    private _replace_shortened_urls_in_value;
    private _parseCompletionPayload;
    private _isModelActionMissing;
    private _getOutputActionNames;
    private _toStrictActionParamSchema;
    private _buildActionOutputSchema;
    private _buildLlmOutputFormat;
    private _get_model_output_with_retry;
    private _try_switch_to_fallback_llm;
    private _log_fallback_switch;
    private _validateAndNormalizeActions;
    private _update_action_models_for_page;
    private _check_and_update_downloads;
    private _update_available_file_paths;
    private _log_step_context;
    private _log_first_step_startup;
    private _log_step_completion_summary;
    private _log_agent_event;
    private _make_history_item;
    save_file_system_state(): void;
}
export {};
