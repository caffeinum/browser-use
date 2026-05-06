import type { Message } from '../../llm/messages.js';
export declare class HistoryItem {
    step_number: number | null;
    evaluation_previous_goal: string | null;
    memory: string | null;
    next_goal: string | null;
    action_results: string | null;
    error: string | null;
    system_message: string | null;
    constructor(step_number?: number | null, evaluation_previous_goal?: string | null, memory?: string | null, next_goal?: string | null, action_results?: string | null, error?: string | null, system_message?: string | null);
    to_string(): string;
}
export declare class MessageHistory {
    system_message: Message | null;
    state_message: Message | null;
    context_messages: Message[];
    get_messages(): Message[];
}
export declare class MessageManagerState {
    history: MessageHistory;
    tool_id: number;
    agent_history_items: HistoryItem[];
    read_state_description: string;
    read_state_images: Array<Record<string, unknown>>;
    compacted_memory: string | null;
    compaction_count: number;
    last_compaction_step: number | null;
    get historyMessages(): Message[];
    get_messages(): Message[];
}
