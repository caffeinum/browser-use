interface AgentReference {
    task_id: string;
    session_id: string;
    task: string;
    llm: {
        model?: string;
        model_name?: string;
    };
    state: {
        stopped: boolean;
        paused: boolean;
        n_steps: number;
        model_dump?: () => Record<string, unknown>;
    };
    history: {
        final_result(): string | null;
        is_done(): boolean;
    };
    browser_session: {
        id: string;
        browser_profile?: {
            viewport?: {
                width: number;
                height: number;
            };
            user_agent?: string | null;
            headless?: boolean;
            allowed_domains?: string[];
        };
    };
    browser_profile?: {
        viewport?: {
            width: number;
            height: number;
        };
        user_agent?: string | null;
        headless?: boolean;
        allowed_domains?: string[];
    };
    cloud_sync?: {
        auth_client?: {
            device_id?: string | null;
        };
    };
    _task_start_time?: number;
}
interface AgentWithState extends AgentReference {
    state: AgentReference['state'] & {
        model_dump?: () => Record<string, unknown>;
    };
}
export declare abstract class BaseEvent {
    readonly event_type: string;
    id: string;
    user_id: string;
    device_id: string | null;
    protected constructor(event_type: string, init?: Partial<BaseEvent>);
    toJSON(): {
        event_type: string;
        id: string;
        user_id: string;
        device_id: string | null;
    };
}
export declare class UpdateAgentTaskEvent extends BaseEvent {
    stopped: boolean | null;
    paused: boolean | null;
    done_output: string | null;
    finished_at: Date | null;
    agent_state: Record<string, unknown> | null;
    user_feedback_type: string | null;
    user_comment: string | null;
    gif_url: string | null;
    constructor(init: Partial<UpdateAgentTaskEvent> & {
        id: string;
    });
    static fromAgent(agent: AgentWithState): UpdateAgentTaskEvent;
    toJSON(): {
        stopped: boolean | null;
        paused: boolean | null;
        done_output: string | null;
        finished_at: string | null;
        agent_state: Record<string, unknown> | null;
        user_feedback_type: string | null;
        user_comment: string | null;
        gif_url: string | null;
        event_type: string;
        id: string;
        user_id: string;
        device_id: string | null;
    };
}
export declare class CreateAgentOutputFileEvent extends BaseEvent {
    task_id: string;
    file_name: string;
    file_content: string | null;
    content_type: string | null;
    created_at: Date;
    constructor(init: {
        user_id?: string;
        device_id?: string | null;
        task_id: string;
        id?: string;
        file_name: string;
        file_content?: string | null;
        content_type?: string | null;
        created_at?: Date;
    });
    static fromAgentAndFile(agent: AgentReference, outputPath: string): Promise<CreateAgentOutputFileEvent>;
    toJSON(): {
        task_id: string;
        file_name: string;
        file_content: string | null;
        content_type: string | null;
        created_at: string;
        event_type: string;
        id: string;
        user_id: string;
        device_id: string | null;
    };
}
export declare class CreateAgentStepEvent extends BaseEvent {
    created_at: Date;
    agent_task_id: string;
    step: number;
    evaluation_previous_goal: string;
    memory: string;
    next_goal: string;
    actions: Array<Record<string, unknown>>;
    screenshot_url: string | null;
    url: string;
    constructor(init: {
        user_id?: string;
        device_id?: string | null;
        agent_task_id: string;
        id?: string;
        step: number;
        evaluation_previous_goal: string;
        memory: string;
        next_goal: string;
        actions: Array<Record<string, unknown>>;
        screenshot_url?: string | null;
        url: string;
        created_at?: Date;
    });
    static fromAgentStep(agent: AgentWithState, model_output: {
        current_state: {
            evaluation_previous_goal: string;
            memory: string;
            next_goal: string;
        };
        action: any[];
    }, result: Array<unknown>, actions_data: Array<Record<string, unknown>>, browser_state_summary: {
        screenshot?: string | null;
        url: string;
    }): CreateAgentStepEvent;
    toJSON(): {
        created_at: string;
        agent_task_id: string;
        step: number;
        evaluation_previous_goal: string;
        memory: string;
        next_goal: string;
        actions: Record<string, unknown>[];
        screenshot_url: string | null;
        url: string;
        event_type: string;
        id: string;
        user_id: string;
        device_id: string | null;
    };
}
export declare class CreateAgentTaskEvent extends BaseEvent {
    agent_session_id: string;
    llm_model: string;
    stopped: boolean;
    paused: boolean;
    task: string;
    done_output: string | null;
    scheduled_task_id: string | null;
    started_at: Date;
    finished_at: Date | null;
    agent_state: Record<string, unknown>;
    user_feedback_type: string | null;
    user_comment: string | null;
    gif_url: string | null;
    constructor(init: {
        user_id?: string;
        device_id?: string | null;
        agent_session_id: string;
        id?: string;
        llm_model: string;
        task: string;
        stopped?: boolean;
        paused?: boolean;
        done_output?: string | null;
        scheduled_task_id?: string | null;
        started_at?: Date;
        finished_at?: Date | null;
        agent_state?: Record<string, unknown>;
        user_feedback_type?: string | null;
        user_comment?: string | null;
        gif_url?: string | null;
    });
    static fromAgent(agent: AgentWithState): CreateAgentTaskEvent;
    toJSON(): {
        agent_session_id: string;
        llm_model: string;
        task: string;
        stopped: boolean;
        paused: boolean;
        done_output: string | null;
        scheduled_task_id: string | null;
        started_at: string;
        finished_at: string | null;
        agent_state: Record<string, unknown>;
        user_feedback_type: string | null;
        user_comment: string | null;
        gif_url: string | null;
        event_type: string;
        id: string;
        user_id: string;
        device_id: string | null;
    };
}
export declare class CreateAgentSessionEvent extends BaseEvent {
    browser_session_id: string;
    browser_session_live_url: string;
    browser_session_cdp_url: string;
    browser_session_stopped: boolean;
    browser_session_stopped_at: Date | null;
    is_source_api: boolean | null;
    browser_state: Record<string, unknown>;
    browser_session_data: Record<string, unknown> | null;
    constructor(init: {
        user_id?: string;
        device_id?: string | null;
        browser_session_id: string;
        id?: string;
        browser_state?: Record<string, unknown>;
        browser_session_live_url?: string;
        browser_session_cdp_url?: string;
        browser_session_stopped?: boolean;
        browser_session_stopped_at?: Date | null;
        is_source_api?: boolean | null;
        browser_session_data?: Record<string, unknown> | null;
    });
    static fromAgent(agent: AgentReference): CreateAgentSessionEvent;
    toJSON(): {
        browser_session_id: string;
        browser_session_live_url: string;
        browser_session_cdp_url: string;
        browser_session_stopped: boolean;
        browser_session_stopped_at: string | null;
        is_source_api: boolean | null;
        browser_state: Record<string, unknown>;
        browser_session_data: Record<string, unknown> | null;
        event_type: string;
        id: string;
        user_id: string;
        device_id: string | null;
    };
}
export declare class UpdateAgentSessionEvent extends BaseEvent {
    browser_session_stopped: boolean | null;
    browser_session_stopped_at: Date | null;
    end_reason: string | null;
    constructor(init: Partial<UpdateAgentSessionEvent> & {
        id: string;
        user_id?: string;
    });
    toJSON(): {
        browser_session_stopped: boolean | null;
        browser_session_stopped_at: string | null;
        end_reason: string | null;
        event_type: string;
        id: string;
        user_id: string;
        device_id: string | null;
    };
}
export {};
