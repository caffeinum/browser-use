export class HistoryItem {
    step_number;
    evaluation_previous_goal;
    memory;
    next_goal;
    action_results;
    error;
    system_message;
    constructor(step_number = null, evaluation_previous_goal = null, memory = null, next_goal = null, action_results = null, error = null, system_message = null) {
        this.step_number = step_number;
        this.evaluation_previous_goal = evaluation_previous_goal;
        this.memory = memory;
        this.next_goal = next_goal;
        this.action_results = action_results;
        this.error = error;
        this.system_message = system_message;
        if (this.error && this.system_message) {
            throw new Error('Cannot have both error and system_message at the same time');
        }
    }
    to_string() {
        const stepStr = this.step_number != null ? 'step' : 'step_unknown';
        if (this.error) {
            return `<${stepStr}>\n${this.error}`;
        }
        if (this.system_message) {
            return this.system_message;
        }
        const parts = [];
        if (this.evaluation_previous_goal) {
            parts.push(`${this.evaluation_previous_goal}`);
        }
        if (this.memory) {
            parts.push(`${this.memory}`);
        }
        if (this.next_goal) {
            parts.push(`${this.next_goal}`);
        }
        if (this.action_results) {
            parts.push(this.action_results);
        }
        const content = parts.join('\n');
        return `<${stepStr}>\n${content}`;
    }
}
export class MessageHistory {
    system_message = null;
    state_message = null;
    context_messages = [];
    get_messages() {
        const messages = [];
        if (this.system_message)
            messages.push(this.system_message);
        if (this.state_message)
            messages.push(this.state_message);
        messages.push(...this.context_messages);
        return messages;
    }
}
export class MessageManagerState {
    history = new MessageHistory();
    tool_id = 1;
    agent_history_items = [
        new HistoryItem(0, null, null, null, null, null, 'Agent initialized'),
    ];
    read_state_description = '';
    read_state_images = [];
    compacted_memory = null;
    compaction_count = 0;
    last_compaction_step = null;
    get historyMessages() {
        return this.history.get_messages();
    }
    get_messages() {
        return this.history.get_messages();
    }
}
