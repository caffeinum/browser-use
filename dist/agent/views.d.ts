import { ActionModel } from '../controller/registry/views.js';
import { BrowserStateHistory } from '../browser/views.js';
import type { DOMHistoryElement } from '../dom/history-tree-processor/view.js';
import { type SelectorMap } from '../dom/views.js';
import type { FileSystemState } from '../filesystem/file-system.js';
import type { BaseChatModel } from '../llm/base.js';
import { MessageManagerState } from './message-manager/views.js';
import type { UsageSummary } from '../tokens/views.js';
export { ActionModel };
export interface StructuredOutputParser<T = unknown> {
    parse?: (input: string) => T;
    model_validate_json?: (input: string) => T;
    model_json_schema?: () => unknown;
    schema?: unknown;
}
export interface ActionResultInit {
    is_done?: boolean | null;
    success?: boolean | null;
    judgement?: Record<string, unknown> | null;
    error?: string | null;
    attachments?: string[] | null;
    images?: Array<Record<string, unknown>> | null;
    metadata?: Record<string, unknown> | null;
    long_term_memory?: string | null;
    extracted_content?: string | null;
    include_extracted_content_only_once?: boolean;
    include_in_memory?: boolean;
}
export declare class ActionResult {
    is_done: boolean | null;
    success: boolean | null;
    judgement: Record<string, unknown> | null;
    error: string | null;
    attachments: string[] | null;
    images: Array<Record<string, unknown>> | null;
    metadata: Record<string, unknown> | null;
    long_term_memory: string | null;
    extracted_content: string | null;
    include_extracted_content_only_once: boolean;
    include_in_memory: boolean;
    constructor(init?: ActionResultInit);
    private validate;
    toJSON(): {
        is_done: boolean | null;
        success: boolean | null;
        judgement: Record<string, unknown> | null;
        error: string | null;
        attachments: string[] | null;
        images: Record<string, unknown>[] | null;
        metadata: Record<string, unknown> | null;
        long_term_memory: string | null;
        extracted_content: string | null;
        include_extracted_content_only_once: boolean;
        include_in_memory: boolean;
    };
    model_dump(): {
        is_done: boolean | null;
        success: boolean | null;
        judgement: Record<string, unknown> | null;
        error: string | null;
        attachments: string[] | null;
        images: Record<string, unknown>[] | null;
        metadata: Record<string, unknown> | null;
        long_term_memory: string | null;
        extracted_content: string | null;
        include_extracted_content_only_once: boolean;
        include_in_memory: boolean;
    };
    model_dump_json(): string;
}
export declare class PageFingerprint {
    readonly url: string;
    readonly element_count: number;
    readonly text_hash: string;
    constructor(url: string, element_count: number, text_hash: string);
    static from_browser_state(url: string, dom_text: string, element_count: number): PageFingerprint;
    equals(other: PageFingerprint): boolean;
}
export declare const compute_action_hash: (action_name: string, params: Record<string, unknown>) => string;
export declare class ActionLoopDetector {
    window_size: number;
    recent_action_hashes: string[];
    recent_page_fingerprints: PageFingerprint[];
    max_repetition_count: number;
    most_repeated_hash: string | null;
    consecutive_stagnant_pages: number;
    constructor(init?: Partial<ActionLoopDetector>);
    record_action(action_name: string, params: Record<string, unknown>): void;
    record_page_state(url: string, dom_text: string, element_count: number): void;
    private update_repetition_stats;
    get_nudge_message(): string | null;
}
export interface MessageCompactionSettings {
    enabled: boolean;
    compact_every_n_steps: number;
    trigger_char_count: number | null;
    trigger_token_count: number | null;
    chars_per_token: number;
    keep_last_items: number;
    summary_max_chars: number;
    include_read_state: boolean;
    compaction_llm: BaseChatModel | null;
}
export declare const defaultMessageCompactionSettings: () => MessageCompactionSettings;
export declare const normalizeMessageCompactionSettings: (settings: Partial<MessageCompactionSettings> | MessageCompactionSettings) => MessageCompactionSettings;
export interface AgentSettings {
    session_attachment_mode: 'copy' | 'strict' | 'shared';
    use_vision: boolean | 'auto';
    include_recent_events: boolean;
    vision_detail_level: 'auto' | 'low' | 'high';
    save_conversation_path: string | null;
    save_conversation_path_encoding: string | null;
    max_failures: number;
    generate_gif: boolean | string;
    override_system_message: string | null;
    extend_system_message: string | null;
    include_attributes: string[];
    max_actions_per_step: number;
    use_thinking: boolean;
    flash_mode: boolean;
    use_judge: boolean;
    ground_truth: string | null;
    max_history_items: number | null;
    page_extraction_llm: unknown | null;
    enable_planning: boolean;
    planning_replan_on_stall: number;
    planning_exploration_limit: number;
    calculate_cost: boolean;
    include_tool_call_examples: boolean;
    llm_timeout: number;
    step_timeout: number;
    final_response_after_failure: boolean;
    message_compaction: MessageCompactionSettings | null;
    loop_detection_window: number;
    loop_detection_enabled: boolean;
}
export declare const defaultAgentSettings: () => AgentSettings;
export declare class AgentState {
    agent_id: string;
    n_steps: number;
    consecutive_failures: number;
    last_result: ActionResult[] | null;
    last_plan: string | null;
    plan: PlanItem[] | null;
    current_plan_item_index: number;
    plan_generation_step: number | null;
    last_model_output: AgentOutput | null;
    paused: boolean;
    stopped: boolean;
    session_initialized: boolean;
    follow_up_task: boolean;
    message_manager_state: MessageManagerState;
    file_system_state: FileSystemState | null;
    loop_detector: ActionLoopDetector;
    constructor(init?: Partial<AgentState>);
    model_dump(): Record<string, unknown>;
    toJSON(): Record<string, unknown>;
}
export declare class AgentStepInfo {
    step_number: number;
    max_steps: number;
    constructor(step_number: number, max_steps: number);
    is_last_step(): boolean;
}
export declare class StepMetadata {
    step_start_time: number;
    step_end_time: number;
    step_number: number;
    step_interval: number | null;
    constructor(step_start_time: number, step_end_time: number, step_number: number, step_interval?: number | null);
    get duration_seconds(): number;
}
export type PlanItemStatus = 'pending' | 'current' | 'done' | 'skipped';
export declare class PlanItem {
    text: string;
    status: PlanItemStatus;
    constructor(init?: Partial<PlanItem>);
    model_dump(): {
        text: string;
        status: PlanItemStatus;
    };
}
export interface AgentBrain {
    thinking: string | null;
    evaluation_previous_goal: string;
    memory: string;
    next_goal: string;
}
export declare class AgentOutput {
    thinking: string | null;
    evaluation_previous_goal: string | null;
    memory: string | null;
    next_goal: string | null;
    current_plan_item: number | null;
    plan_update: string[] | null;
    action: ActionModel[];
    constructor(init?: Partial<AgentOutput>);
    get current_state(): AgentBrain;
    model_dump(): {
        thinking: string | null;
        evaluation_previous_goal: string | null;
        memory: string | null;
        next_goal: string | null;
        current_plan_item: number | null;
        plan_update: string[] | null;
        action: any[];
    };
    model_dump_json(): string;
    toJSON(): {
        thinking: string | null;
        evaluation_previous_goal: string | null;
        memory: string | null;
        next_goal: string | null;
        current_plan_item: number | null;
        plan_update: string[] | null;
        action: any[];
    };
    static fromJSON(data: any): AgentOutput;
    static type_with_custom_actions<T extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T): {
        new (init?: Partial<AgentOutput>): {
            thinking: string | null;
            evaluation_previous_goal: string | null;
            memory: string | null;
            next_goal: string | null;
            current_plan_item: number | null;
            plan_update: string[] | null;
            action: ActionModel[];
            get current_state(): AgentBrain;
            model_dump(): {
                thinking: string | null;
                evaluation_previous_goal: string | null;
                memory: string | null;
                next_goal: string | null;
                current_plan_item: number | null;
                plan_update: string[] | null;
                action: any[];
            };
            model_dump_json(): string;
            toJSON(): {
                thinking: string | null;
                evaluation_previous_goal: string | null;
                memory: string | null;
                next_goal: string | null;
                current_plan_item: number | null;
                plan_update: string[] | null;
                action: any[];
            };
        };
        fromJSON(data: any): AgentOutput;
        type_with_custom_actions<T extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T): /*elided*/ any;
        type_with_custom_actions_no_thinking<T_1 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_1): {
            new (init?: Partial<AgentOutput>): {
                thinking: string | null;
                evaluation_previous_goal: string | null;
                memory: string | null;
                next_goal: string | null;
                current_plan_item: number | null;
                plan_update: string[] | null;
                action: ActionModel[];
                get current_state(): AgentBrain;
                model_dump(): {
                    thinking: string | null;
                    evaluation_previous_goal: string | null;
                    memory: string | null;
                    next_goal: string | null;
                    current_plan_item: number | null;
                    plan_update: string[] | null;
                    action: any[];
                };
                model_dump_json(): string;
                toJSON(): {
                    thinking: string | null;
                    evaluation_previous_goal: string | null;
                    memory: string | null;
                    next_goal: string | null;
                    current_plan_item: number | null;
                    plan_update: string[] | null;
                    action: any[];
                };
            };
            fromJSON(data: any): AgentOutput;
            type_with_custom_actions<T extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T): /*elided*/ any;
            type_with_custom_actions_no_thinking<T_1 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_1): /*elided*/ any;
            type_with_custom_actions_flash_mode<T_2 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_2): {
                new (init?: Partial<AgentOutput>): {
                    thinking: string | null;
                    evaluation_previous_goal: string | null;
                    memory: string | null;
                    next_goal: string | null;
                    current_plan_item: number | null;
                    plan_update: string[] | null;
                    action: ActionModel[];
                    get current_state(): AgentBrain;
                    model_dump(): {
                        thinking: string | null;
                        evaluation_previous_goal: string | null;
                        memory: string | null;
                        next_goal: string | null;
                        current_plan_item: number | null;
                        plan_update: string[] | null;
                        action: any[];
                    };
                    model_dump_json(): string;
                    toJSON(): {
                        thinking: string | null;
                        evaluation_previous_goal: string | null;
                        memory: string | null;
                        next_goal: string | null;
                        current_plan_item: number | null;
                        plan_update: string[] | null;
                        action: any[];
                    };
                };
                fromJSON(data: any): AgentOutput;
                type_with_custom_actions<T extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T): /*elided*/ any;
                type_with_custom_actions_no_thinking<T_1 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_1): /*elided*/ any;
                type_with_custom_actions_flash_mode<T_2 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_2): /*elided*/ any;
            };
        };
        type_with_custom_actions_flash_mode<T_1 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_1): {
            new (init?: Partial<AgentOutput>): {
                thinking: string | null;
                evaluation_previous_goal: string | null;
                memory: string | null;
                next_goal: string | null;
                current_plan_item: number | null;
                plan_update: string[] | null;
                action: ActionModel[];
                get current_state(): AgentBrain;
                model_dump(): {
                    thinking: string | null;
                    evaluation_previous_goal: string | null;
                    memory: string | null;
                    next_goal: string | null;
                    current_plan_item: number | null;
                    plan_update: string[] | null;
                    action: any[];
                };
                model_dump_json(): string;
                toJSON(): {
                    thinking: string | null;
                    evaluation_previous_goal: string | null;
                    memory: string | null;
                    next_goal: string | null;
                    current_plan_item: number | null;
                    plan_update: string[] | null;
                    action: any[];
                };
            };
            fromJSON(data: any): AgentOutput;
            type_with_custom_actions<T extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T): /*elided*/ any;
            type_with_custom_actions_no_thinking<T_2 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_2): {
                new (init?: Partial<AgentOutput>): {
                    thinking: string | null;
                    evaluation_previous_goal: string | null;
                    memory: string | null;
                    next_goal: string | null;
                    current_plan_item: number | null;
                    plan_update: string[] | null;
                    action: ActionModel[];
                    get current_state(): AgentBrain;
                    model_dump(): {
                        thinking: string | null;
                        evaluation_previous_goal: string | null;
                        memory: string | null;
                        next_goal: string | null;
                        current_plan_item: number | null;
                        plan_update: string[] | null;
                        action: any[];
                    };
                    model_dump_json(): string;
                    toJSON(): {
                        thinking: string | null;
                        evaluation_previous_goal: string | null;
                        memory: string | null;
                        next_goal: string | null;
                        current_plan_item: number | null;
                        plan_update: string[] | null;
                        action: any[];
                    };
                };
                fromJSON(data: any): AgentOutput;
                type_with_custom_actions<T extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T): /*elided*/ any;
                type_with_custom_actions_no_thinking<T_2 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_2): /*elided*/ any;
                type_with_custom_actions_flash_mode<T_1 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_1): /*elided*/ any;
            };
            type_with_custom_actions_flash_mode<T_1 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_1): /*elided*/ any;
        };
    };
    static type_with_custom_actions_no_thinking<T extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T): {
        new (init?: Partial<AgentOutput>): {
            thinking: string | null;
            evaluation_previous_goal: string | null;
            memory: string | null;
            next_goal: string | null;
            current_plan_item: number | null;
            plan_update: string[] | null;
            action: ActionModel[];
            get current_state(): AgentBrain;
            model_dump(): {
                thinking: string | null;
                evaluation_previous_goal: string | null;
                memory: string | null;
                next_goal: string | null;
                current_plan_item: number | null;
                plan_update: string[] | null;
                action: any[];
            };
            model_dump_json(): string;
            toJSON(): {
                thinking: string | null;
                evaluation_previous_goal: string | null;
                memory: string | null;
                next_goal: string | null;
                current_plan_item: number | null;
                plan_update: string[] | null;
                action: any[];
            };
        };
        fromJSON(data: any): AgentOutput;
        type_with_custom_actions<T_1 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_1): {
            new (init?: Partial<AgentOutput>): {
                thinking: string | null;
                evaluation_previous_goal: string | null;
                memory: string | null;
                next_goal: string | null;
                current_plan_item: number | null;
                plan_update: string[] | null;
                action: ActionModel[];
                get current_state(): AgentBrain;
                model_dump(): {
                    thinking: string | null;
                    evaluation_previous_goal: string | null;
                    memory: string | null;
                    next_goal: string | null;
                    current_plan_item: number | null;
                    plan_update: string[] | null;
                    action: any[];
                };
                model_dump_json(): string;
                toJSON(): {
                    thinking: string | null;
                    evaluation_previous_goal: string | null;
                    memory: string | null;
                    next_goal: string | null;
                    current_plan_item: number | null;
                    plan_update: string[] | null;
                    action: any[];
                };
            };
            fromJSON(data: any): AgentOutput;
            type_with_custom_actions<T_1 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_1): /*elided*/ any;
            type_with_custom_actions_no_thinking<T extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T): /*elided*/ any;
            type_with_custom_actions_flash_mode<T_2 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_2): {
                new (init?: Partial<AgentOutput>): {
                    thinking: string | null;
                    evaluation_previous_goal: string | null;
                    memory: string | null;
                    next_goal: string | null;
                    current_plan_item: number | null;
                    plan_update: string[] | null;
                    action: ActionModel[];
                    get current_state(): AgentBrain;
                    model_dump(): {
                        thinking: string | null;
                        evaluation_previous_goal: string | null;
                        memory: string | null;
                        next_goal: string | null;
                        current_plan_item: number | null;
                        plan_update: string[] | null;
                        action: any[];
                    };
                    model_dump_json(): string;
                    toJSON(): {
                        thinking: string | null;
                        evaluation_previous_goal: string | null;
                        memory: string | null;
                        next_goal: string | null;
                        current_plan_item: number | null;
                        plan_update: string[] | null;
                        action: any[];
                    };
                };
                fromJSON(data: any): AgentOutput;
                type_with_custom_actions<T_1 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_1): /*elided*/ any;
                type_with_custom_actions_no_thinking<T extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T): /*elided*/ any;
                type_with_custom_actions_flash_mode<T_2 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_2): /*elided*/ any;
            };
        };
        type_with_custom_actions_no_thinking<T extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T): /*elided*/ any;
        type_with_custom_actions_flash_mode<T_1 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_1): {
            new (init?: Partial<AgentOutput>): {
                thinking: string | null;
                evaluation_previous_goal: string | null;
                memory: string | null;
                next_goal: string | null;
                current_plan_item: number | null;
                plan_update: string[] | null;
                action: ActionModel[];
                get current_state(): AgentBrain;
                model_dump(): {
                    thinking: string | null;
                    evaluation_previous_goal: string | null;
                    memory: string | null;
                    next_goal: string | null;
                    current_plan_item: number | null;
                    plan_update: string[] | null;
                    action: any[];
                };
                model_dump_json(): string;
                toJSON(): {
                    thinking: string | null;
                    evaluation_previous_goal: string | null;
                    memory: string | null;
                    next_goal: string | null;
                    current_plan_item: number | null;
                    plan_update: string[] | null;
                    action: any[];
                };
            };
            fromJSON(data: any): AgentOutput;
            type_with_custom_actions<T_2 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_2): {
                new (init?: Partial<AgentOutput>): {
                    thinking: string | null;
                    evaluation_previous_goal: string | null;
                    memory: string | null;
                    next_goal: string | null;
                    current_plan_item: number | null;
                    plan_update: string[] | null;
                    action: ActionModel[];
                    get current_state(): AgentBrain;
                    model_dump(): {
                        thinking: string | null;
                        evaluation_previous_goal: string | null;
                        memory: string | null;
                        next_goal: string | null;
                        current_plan_item: number | null;
                        plan_update: string[] | null;
                        action: any[];
                    };
                    model_dump_json(): string;
                    toJSON(): {
                        thinking: string | null;
                        evaluation_previous_goal: string | null;
                        memory: string | null;
                        next_goal: string | null;
                        current_plan_item: number | null;
                        plan_update: string[] | null;
                        action: any[];
                    };
                };
                fromJSON(data: any): AgentOutput;
                type_with_custom_actions<T_2 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_2): /*elided*/ any;
                type_with_custom_actions_no_thinking<T extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T): /*elided*/ any;
                type_with_custom_actions_flash_mode<T_1 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_1): /*elided*/ any;
            };
            type_with_custom_actions_no_thinking<T extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T): /*elided*/ any;
            type_with_custom_actions_flash_mode<T_1 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_1): /*elided*/ any;
        };
    };
    static type_with_custom_actions_flash_mode<T extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T): {
        new (init?: Partial<AgentOutput>): {
            thinking: string | null;
            evaluation_previous_goal: string | null;
            memory: string | null;
            next_goal: string | null;
            current_plan_item: number | null;
            plan_update: string[] | null;
            action: ActionModel[];
            get current_state(): AgentBrain;
            model_dump(): {
                thinking: string | null;
                evaluation_previous_goal: string | null;
                memory: string | null;
                next_goal: string | null;
                current_plan_item: number | null;
                plan_update: string[] | null;
                action: any[];
            };
            model_dump_json(): string;
            toJSON(): {
                thinking: string | null;
                evaluation_previous_goal: string | null;
                memory: string | null;
                next_goal: string | null;
                current_plan_item: number | null;
                plan_update: string[] | null;
                action: any[];
            };
        };
        fromJSON(data: any): AgentOutput;
        type_with_custom_actions<T_1 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_1): {
            new (init?: Partial<AgentOutput>): {
                thinking: string | null;
                evaluation_previous_goal: string | null;
                memory: string | null;
                next_goal: string | null;
                current_plan_item: number | null;
                plan_update: string[] | null;
                action: ActionModel[];
                get current_state(): AgentBrain;
                model_dump(): {
                    thinking: string | null;
                    evaluation_previous_goal: string | null;
                    memory: string | null;
                    next_goal: string | null;
                    current_plan_item: number | null;
                    plan_update: string[] | null;
                    action: any[];
                };
                model_dump_json(): string;
                toJSON(): {
                    thinking: string | null;
                    evaluation_previous_goal: string | null;
                    memory: string | null;
                    next_goal: string | null;
                    current_plan_item: number | null;
                    plan_update: string[] | null;
                    action: any[];
                };
            };
            fromJSON(data: any): AgentOutput;
            type_with_custom_actions<T_1 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_1): /*elided*/ any;
            type_with_custom_actions_no_thinking<T_2 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_2): {
                new (init?: Partial<AgentOutput>): {
                    thinking: string | null;
                    evaluation_previous_goal: string | null;
                    memory: string | null;
                    next_goal: string | null;
                    current_plan_item: number | null;
                    plan_update: string[] | null;
                    action: ActionModel[];
                    get current_state(): AgentBrain;
                    model_dump(): {
                        thinking: string | null;
                        evaluation_previous_goal: string | null;
                        memory: string | null;
                        next_goal: string | null;
                        current_plan_item: number | null;
                        plan_update: string[] | null;
                        action: any[];
                    };
                    model_dump_json(): string;
                    toJSON(): {
                        thinking: string | null;
                        evaluation_previous_goal: string | null;
                        memory: string | null;
                        next_goal: string | null;
                        current_plan_item: number | null;
                        plan_update: string[] | null;
                        action: any[];
                    };
                };
                fromJSON(data: any): AgentOutput;
                type_with_custom_actions<T_1 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_1): /*elided*/ any;
                type_with_custom_actions_no_thinking<T_2 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_2): /*elided*/ any;
                type_with_custom_actions_flash_mode<T extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T): /*elided*/ any;
            };
            type_with_custom_actions_flash_mode<T extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T): /*elided*/ any;
        };
        type_with_custom_actions_no_thinking<T_1 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_1): {
            new (init?: Partial<AgentOutput>): {
                thinking: string | null;
                evaluation_previous_goal: string | null;
                memory: string | null;
                next_goal: string | null;
                current_plan_item: number | null;
                plan_update: string[] | null;
                action: ActionModel[];
                get current_state(): AgentBrain;
                model_dump(): {
                    thinking: string | null;
                    evaluation_previous_goal: string | null;
                    memory: string | null;
                    next_goal: string | null;
                    current_plan_item: number | null;
                    plan_update: string[] | null;
                    action: any[];
                };
                model_dump_json(): string;
                toJSON(): {
                    thinking: string | null;
                    evaluation_previous_goal: string | null;
                    memory: string | null;
                    next_goal: string | null;
                    current_plan_item: number | null;
                    plan_update: string[] | null;
                    action: any[];
                };
            };
            fromJSON(data: any): AgentOutput;
            type_with_custom_actions<T_2 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_2): {
                new (init?: Partial<AgentOutput>): {
                    thinking: string | null;
                    evaluation_previous_goal: string | null;
                    memory: string | null;
                    next_goal: string | null;
                    current_plan_item: number | null;
                    plan_update: string[] | null;
                    action: ActionModel[];
                    get current_state(): AgentBrain;
                    model_dump(): {
                        thinking: string | null;
                        evaluation_previous_goal: string | null;
                        memory: string | null;
                        next_goal: string | null;
                        current_plan_item: number | null;
                        plan_update: string[] | null;
                        action: any[];
                    };
                    model_dump_json(): string;
                    toJSON(): {
                        thinking: string | null;
                        evaluation_previous_goal: string | null;
                        memory: string | null;
                        next_goal: string | null;
                        current_plan_item: number | null;
                        plan_update: string[] | null;
                        action: any[];
                    };
                };
                fromJSON(data: any): AgentOutput;
                type_with_custom_actions<T_2 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_2): /*elided*/ any;
                type_with_custom_actions_no_thinking<T_1 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_1): /*elided*/ any;
                type_with_custom_actions_flash_mode<T extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T): /*elided*/ any;
            };
            type_with_custom_actions_no_thinking<T_1 extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T_1): /*elided*/ any;
            type_with_custom_actions_flash_mode<T extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T): /*elided*/ any;
        };
        type_with_custom_actions_flash_mode<T extends ActionModel>(custom_actions: new (initialData?: Record<string, any>) => T): /*elided*/ any;
    };
}
export declare class AgentHistory {
    model_output: AgentOutput | null;
    result: ActionResult[];
    state: BrowserStateHistory;
    metadata: StepMetadata | null;
    state_message: string | null;
    constructor(model_output: AgentOutput | null, result: ActionResult[], state: BrowserStateHistory, metadata?: StepMetadata | null, state_message?: string | null);
    static get_interacted_element(model_output: AgentOutput, selector_map: SelectorMap): (DOMHistoryElement | null)[];
    private static _filterSensitiveDataFromString;
    private static _filterSensitiveDataFromDict;
    toJSON(sensitive_data?: Record<string, string | Record<string, string>> | null): {
        model_output: {
            thinking: string | null;
            evaluation_previous_goal: string | null;
            memory: string | null;
            next_goal: string | null;
            current_plan_item: number | null;
            plan_update: string[] | null;
            action: any[];
        } | null;
        result: {
            is_done: boolean | null;
            success: boolean | null;
            judgement: Record<string, unknown> | null;
            error: string | null;
            attachments: string[] | null;
            images: Record<string, unknown>[] | null;
            metadata: Record<string, unknown> | null;
            long_term_memory: string | null;
            extracted_content: string | null;
            include_extracted_content_only_once: boolean;
            include_in_memory: boolean;
        }[];
        state: {
            tabs: import("../index.js").TabInfo[];
            screenshot_path: string | null;
            interacted_element: ({
                tag_name: string;
                xpath: string;
                highlight_index: number | null;
                entire_parent_branch_path: string[];
                attributes: Record<string, string>;
                shadow_root: boolean;
                css_selector: string | null;
                page_coordinates: import("../index.js").CoordinateSet | null;
                viewport_coordinates: import("../index.js").CoordinateSet | null;
                viewport_info: import("../index.js").ViewportInfo | null;
                element_hash: string | null;
                stable_hash: string | null;
                ax_name: string | null;
            } | null)[];
            url: string;
            title: string;
        };
        metadata: {
            step_start_time: number;
            step_end_time: number;
            step_number: number;
            step_interval: number | null;
        } | null;
        state_message: string | null;
    };
}
export declare class AgentHistoryList<TStructured = unknown> {
    history: AgentHistory[];
    usage: UsageSummary | null;
    _output_model_schema: StructuredOutputParser<TStructured> | null;
    constructor(history?: AgentHistory[], usage?: UsageSummary | null);
    total_duration_seconds(): number;
    add_item(history_item: AgentHistory): void;
    last_action(): any;
    errors(): (string | null)[];
    final_result(): string | null;
    is_done(): boolean;
    is_successful(): boolean | null;
    judgement(): Record<string, unknown> | null;
    is_judged(): boolean;
    is_validated(): boolean | null;
    has_errors(): boolean;
    urls(): string[];
    screenshot_paths(n_last?: number | null, return_none_if_not_screenshot?: boolean): (string | null)[];
    screenshots(n_last?: number | null, return_none_if_not_screenshot?: boolean): (string | null)[];
    action_names(): string[];
    model_thoughts(): AgentBrain[];
    model_outputs(): AgentOutput[];
    model_actions(): Record<string, unknown>[];
    action_history(): Record<string, unknown>[][];
    action_results(): ActionResult[];
    extracted_content(): (string | null)[];
    model_actions_filtered(include?: string[]): Record<string, unknown>[];
    number_of_steps(): number;
    agent_steps(): string[];
    get structured_output(): TStructured | null;
    get_structured_output(outputModel: StructuredOutputParser<TStructured>): TStructured | null;
    save_to_file(filepath: string, sensitive_data?: Record<string, string | Record<string, string>> | null): void;
    static load_from_file(filepath: string, outputModel: typeof AgentOutput): AgentHistoryList;
    static load_from_dict(payload: Record<string, unknown>, outputModel: typeof AgentOutput): AgentHistoryList;
    toJSON(sensitive_data?: Record<string, string | Record<string, string>> | null): {
        history: {
            model_output: {
                thinking: string | null;
                evaluation_previous_goal: string | null;
                memory: string | null;
                next_goal: string | null;
                current_plan_item: number | null;
                plan_update: string[] | null;
                action: any[];
            } | null;
            result: {
                is_done: boolean | null;
                success: boolean | null;
                judgement: Record<string, unknown> | null;
                error: string | null;
                attachments: string[] | null;
                images: Record<string, unknown>[] | null;
                metadata: Record<string, unknown> | null;
                long_term_memory: string | null;
                extracted_content: string | null;
                include_extracted_content_only_once: boolean;
                include_in_memory: boolean;
            }[];
            state: {
                tabs: import("../index.js").TabInfo[];
                screenshot_path: string | null;
                interacted_element: ({
                    tag_name: string;
                    xpath: string;
                    highlight_index: number | null;
                    entire_parent_branch_path: string[];
                    attributes: Record<string, string>;
                    shadow_root: boolean;
                    css_selector: string | null;
                    page_coordinates: import("../index.js").CoordinateSet | null;
                    viewport_coordinates: import("../index.js").CoordinateSet | null;
                    viewport_info: import("../index.js").ViewportInfo | null;
                    element_hash: string | null;
                    stable_hash: string | null;
                    ax_name: string | null;
                } | null)[];
                url: string;
                title: string;
            };
            metadata: {
                step_start_time: number;
                step_end_time: number;
                step_number: number;
                step_interval: number | null;
            } | null;
            state_message: string | null;
        }[];
    };
    model_dump(sensitive_data?: Record<string, string | Record<string, string>> | null): {
        history: {
            model_output: {
                thinking: string | null;
                evaluation_previous_goal: string | null;
                memory: string | null;
                next_goal: string | null;
                current_plan_item: number | null;
                plan_update: string[] | null;
                action: any[];
            } | null;
            result: {
                is_done: boolean | null;
                success: boolean | null;
                judgement: Record<string, unknown> | null;
                error: string | null;
                attachments: string[] | null;
                images: Record<string, unknown>[] | null;
                metadata: Record<string, unknown> | null;
                long_term_memory: string | null;
                extracted_content: string | null;
                include_extracted_content_only_once: boolean;
                include_in_memory: boolean;
            }[];
            state: {
                tabs: import("../index.js").TabInfo[];
                screenshot_path: string | null;
                interacted_element: ({
                    tag_name: string;
                    xpath: string;
                    highlight_index: number | null;
                    entire_parent_branch_path: string[];
                    attributes: Record<string, string>;
                    shadow_root: boolean;
                    css_selector: string | null;
                    page_coordinates: import("../index.js").CoordinateSet | null;
                    viewport_coordinates: import("../index.js").CoordinateSet | null;
                    viewport_info: import("../index.js").ViewportInfo | null;
                    element_hash: string | null;
                    stable_hash: string | null;
                    ax_name: string | null;
                } | null)[];
                url: string;
                title: string;
            };
            metadata: {
                step_start_time: number;
                step_end_time: number;
                step_number: number;
                step_interval: number | null;
            } | null;
            state_message: string | null;
        }[];
    };
}
export declare class DetectedVariable {
    name: string;
    original_value: string;
    type: string;
    format: string | null;
    constructor(name: string, original_value: string, type?: string, format?: string | null);
    model_dump(): {
        name: string;
        original_value: string;
        type: string;
        format: string | null;
    };
}
export declare class VariableMetadata {
    detected_variables: Record<string, DetectedVariable>;
    constructor(detected_variables?: Record<string, DetectedVariable>);
}
export declare class AgentError extends Error {
    static VALIDATION_ERROR: string;
    static RATE_LIMIT_ERROR: string;
    static NO_VALID_ACTION: string;
    static format_error(error: Error, include_trace?: boolean): string;
}
