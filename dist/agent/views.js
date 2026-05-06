import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { ActionModel } from '../controller/registry/views.js';
import { BrowserStateHistory } from '../browser/views.js';
import { HistoryTreeProcessor } from '../dom/history-tree-processor/service.js';
import { DEFAULT_INCLUDE_ATTRIBUTES, } from '../dom/views.js';
import { MessageManagerState } from './message-manager/views.js';
// Re-export ActionModel for agent/service.ts
export { ActionModel };
const parseStructuredOutput = (schema, value) => {
    if (!schema) {
        return null;
    }
    if (schema.parse) {
        return schema.parse(value);
    }
    if (schema.model_validate_json) {
        return schema.model_validate_json(value);
    }
    return null;
};
export class ActionResult {
    is_done;
    success;
    judgement;
    error;
    attachments;
    images;
    metadata;
    long_term_memory;
    extracted_content;
    include_extracted_content_only_once;
    include_in_memory;
    constructor(init = {}) {
        this.is_done = init.is_done ?? false;
        this.success = init.success ?? null;
        this.judgement = init.judgement ?? null;
        this.error = init.error ?? null;
        this.attachments = init.attachments ?? null;
        this.images = init.images ?? null;
        this.metadata = init.metadata ?? null;
        this.long_term_memory = init.long_term_memory ?? null;
        this.extracted_content = init.extracted_content ?? null;
        this.include_extracted_content_only_once =
            init.include_extracted_content_only_once ?? false;
        this.include_in_memory = init.include_in_memory ?? false;
        this.validate();
    }
    validate() {
        if (this.success === true && this.is_done !== true) {
            throw new Error('success=True can only be set when is_done=True. For regular actions that succeed, leave success as None. Use success=False only for actions that fail.');
        }
    }
    toJSON() {
        return {
            is_done: this.is_done,
            success: this.success,
            judgement: this.judgement,
            error: this.error,
            attachments: this.attachments,
            images: this.images,
            metadata: this.metadata,
            long_term_memory: this.long_term_memory,
            extracted_content: this.extracted_content,
            include_extracted_content_only_once: this.include_extracted_content_only_once,
            include_in_memory: this.include_in_memory,
        };
    }
    model_dump() {
        return this.toJSON();
    }
    model_dump_json() {
        return JSON.stringify(this.toJSON());
    }
}
export class PageFingerprint {
    url;
    element_count;
    text_hash;
    constructor(url, element_count, text_hash) {
        this.url = url;
        this.element_count = element_count;
        this.text_hash = text_hash;
    }
    static from_browser_state(url, dom_text, element_count) {
        const text_hash = createHash('sha256')
            .update(dom_text, 'utf8')
            .digest('hex')
            .slice(0, 16);
        return new PageFingerprint(url, element_count, text_hash);
    }
    equals(other) {
        return (this.url === other.url &&
            this.element_count === other.element_count &&
            this.text_hash === other.text_hash);
    }
}
const stableSerialize = (value) => {
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value !== 'object') {
        return String(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
    }
    const entries = Object.entries(value)
        .filter(([, entryValue]) => entryValue !== null && entryValue !== undefined)
        .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries
        .map(([key, entryValue]) => `${key}:${stableSerialize(entryValue)}`)
        .join(',')}}`;
};
const normalizeActionForHash = (action_name, params) => {
    if (action_name === 'search' || action_name === 'search_google') {
        const query = String(params.query ?? '');
        const tokens = Array.from(new Set(query
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(Boolean))).sort();
        const engine = typeof params.engine === 'string' && params.engine.trim()
            ? params.engine.trim().toLowerCase()
            : action_name === 'search_google'
                ? 'google'
                : 'google';
        return `search|${engine}|${tokens.join('|')}`;
    }
    if (action_name === 'click' ||
        action_name === 'click_element' ||
        action_name === 'click_element_by_index') {
        return `click|${String(params.index ?? '')}`;
    }
    if (action_name === 'input' || action_name === 'input_text') {
        const text = String(params.text ?? '')
            .trim()
            .toLowerCase();
        return `input|${String(params.index ?? '')}|${text}`;
    }
    if (action_name === 'navigate' || action_name === 'go_to_url') {
        return `navigate|${String(params.url ?? '')}`;
    }
    if (action_name.startsWith('scroll')) {
        const direction = typeof params.down === 'boolean'
            ? params.down
                ? 'down'
                : 'up'
            : action_name.includes('up')
                ? 'up'
                : 'down';
        const index = String(params.index ?? '');
        return `scroll|${direction}|${index}`;
    }
    return `${action_name}|${stableSerialize(params)}`;
};
export const compute_action_hash = (action_name, params) => {
    const normalized = normalizeActionForHash(action_name, params);
    return createHash('sha256')
        .update(normalized, 'utf8')
        .digest('hex')
        .slice(0, 12);
};
export class ActionLoopDetector {
    window_size;
    recent_action_hashes;
    recent_page_fingerprints;
    max_repetition_count;
    most_repeated_hash;
    consecutive_stagnant_pages;
    constructor(init) {
        this.window_size = init?.window_size ?? 20;
        this.recent_action_hashes = init?.recent_action_hashes ?? [];
        this.recent_page_fingerprints = init?.recent_page_fingerprints ?? [];
        this.max_repetition_count = init?.max_repetition_count ?? 0;
        this.most_repeated_hash = init?.most_repeated_hash ?? null;
        this.consecutive_stagnant_pages = init?.consecutive_stagnant_pages ?? 0;
    }
    record_action(action_name, params) {
        const hash = compute_action_hash(action_name, params);
        this.recent_action_hashes.push(hash);
        if (this.recent_action_hashes.length > this.window_size) {
            this.recent_action_hashes = this.recent_action_hashes.slice(-this.window_size);
        }
        this.update_repetition_stats();
    }
    record_page_state(url, dom_text, element_count) {
        const fp = PageFingerprint.from_browser_state(url, dom_text, element_count);
        const last = this.recent_page_fingerprints.at(-1);
        if (last && last.equals(fp)) {
            this.consecutive_stagnant_pages += 1;
        }
        else {
            this.consecutive_stagnant_pages = 0;
        }
        this.recent_page_fingerprints.push(fp);
        if (this.recent_page_fingerprints.length > 5) {
            this.recent_page_fingerprints = this.recent_page_fingerprints.slice(-5);
        }
    }
    update_repetition_stats() {
        if (!this.recent_action_hashes.length) {
            this.max_repetition_count = 0;
            this.most_repeated_hash = null;
            return;
        }
        const counts = new Map();
        for (const hash of this.recent_action_hashes) {
            counts.set(hash, (counts.get(hash) ?? 0) + 1);
        }
        let maxHash = null;
        let maxCount = 0;
        for (const [hash, count] of counts.entries()) {
            if (count > maxCount) {
                maxHash = hash;
                maxCount = count;
            }
        }
        this.most_repeated_hash = maxHash;
        this.max_repetition_count = maxCount;
    }
    get_nudge_message() {
        const messages = [];
        if (this.max_repetition_count >= 12) {
            messages.push(`Heads up: you have repeated a similar action ${this.max_repetition_count} times in the last ${this.recent_action_hashes.length} actions. If you are making progress with each repetition, keep going. If not, a different approach might get you there faster.`);
        }
        else if (this.max_repetition_count >= 8) {
            messages.push(`Heads up: you have repeated a similar action ${this.max_repetition_count} times in the last ${this.recent_action_hashes.length} actions. Are you still making progress with each attempt? If so, carry on. Otherwise, it might be worth trying a different approach.`);
        }
        else if (this.max_repetition_count >= 5) {
            messages.push(`Heads up: you have repeated a similar action ${this.max_repetition_count} times in the last ${this.recent_action_hashes.length} actions. If this is intentional and making progress, carry on. If not, it might be worth reconsidering your approach.`);
        }
        if (this.consecutive_stagnant_pages >= 5) {
            messages.push(`The page content has not changed across ${this.consecutive_stagnant_pages} consecutive actions. Your actions might not be having the intended effect. It could be worth trying a different element or approach.`);
        }
        if (!messages.length) {
            return null;
        }
        return messages.join('\n\n');
    }
}
export const defaultMessageCompactionSettings = () => ({
    enabled: true,
    compact_every_n_steps: 15,
    trigger_char_count: 40000,
    trigger_token_count: null,
    chars_per_token: 4,
    keep_last_items: 6,
    summary_max_chars: 6000,
    include_read_state: false,
    compaction_llm: null,
});
export const normalizeMessageCompactionSettings = (settings) => {
    const merged = {
        ...defaultMessageCompactionSettings(),
        ...settings,
    };
    if (merged.trigger_char_count != null && merged.trigger_token_count != null) {
        throw new Error('Set trigger_char_count or trigger_token_count for message_compaction, not both.');
    }
    if (merged.trigger_token_count != null) {
        merged.trigger_char_count = Math.floor(merged.trigger_token_count * merged.chars_per_token);
    }
    else if (merged.trigger_char_count == null) {
        merged.trigger_char_count = 40000;
    }
    return merged;
};
export const defaultAgentSettings = () => ({
    session_attachment_mode: 'copy',
    use_vision: true,
    include_recent_events: false,
    vision_detail_level: 'auto',
    save_conversation_path: null,
    save_conversation_path_encoding: 'utf-8',
    max_failures: 3,
    generate_gif: false,
    override_system_message: null,
    extend_system_message: null,
    include_attributes: [...DEFAULT_INCLUDE_ATTRIBUTES],
    max_actions_per_step: 5,
    use_thinking: true,
    flash_mode: false,
    use_judge: true,
    ground_truth: null,
    max_history_items: null,
    page_extraction_llm: null,
    enable_planning: true,
    planning_replan_on_stall: 3,
    planning_exploration_limit: 5,
    calculate_cost: false,
    include_tool_call_examples: false,
    llm_timeout: 60,
    step_timeout: 180,
    final_response_after_failure: true,
    message_compaction: null,
    loop_detection_window: 20,
    loop_detection_enabled: true,
});
export class AgentState {
    agent_id;
    n_steps;
    consecutive_failures;
    last_result;
    last_plan;
    plan;
    current_plan_item_index;
    plan_generation_step;
    last_model_output;
    paused;
    stopped;
    session_initialized;
    follow_up_task;
    message_manager_state;
    file_system_state;
    loop_detector;
    constructor(init) {
        this.agent_id = init?.agent_id ?? '';
        this.n_steps = init?.n_steps ?? 1;
        this.consecutive_failures = init?.consecutive_failures ?? 0;
        this.last_result = init?.last_result ?? null;
        this.last_plan = init?.last_plan ?? null;
        this.plan =
            init?.plan?.map((item) => item instanceof PlanItem ? item : new PlanItem(item)) ?? null;
        this.current_plan_item_index = init?.current_plan_item_index ?? 0;
        this.plan_generation_step = init?.plan_generation_step ?? null;
        this.last_model_output = init?.last_model_output ?? null;
        this.paused = init?.paused ?? false;
        this.stopped = init?.stopped ?? false;
        this.session_initialized = init?.session_initialized ?? false;
        this.follow_up_task = init?.follow_up_task ?? false;
        if (init?.message_manager_state instanceof MessageManagerState) {
            this.message_manager_state = init.message_manager_state;
        }
        else if (init?.message_manager_state) {
            this.message_manager_state = Object.assign(new MessageManagerState(), init.message_manager_state);
        }
        else {
            this.message_manager_state = new MessageManagerState();
        }
        this.file_system_state = init?.file_system_state ?? null;
        if (init?.loop_detector instanceof ActionLoopDetector) {
            this.loop_detector = init.loop_detector;
        }
        else if (init?.loop_detector) {
            this.loop_detector = Object.assign(new ActionLoopDetector(), init.loop_detector);
        }
        else {
            this.loop_detector = new ActionLoopDetector();
        }
    }
    model_dump() {
        return {
            agent_id: this.agent_id,
            n_steps: this.n_steps,
            consecutive_failures: this.consecutive_failures,
            last_result: this.last_result?.map((result) => result.model_dump()) ?? null,
            last_plan: this.last_plan,
            plan: this.plan?.map((item) => item.model_dump()) ?? null,
            current_plan_item_index: this.current_plan_item_index,
            plan_generation_step: this.plan_generation_step,
            last_model_output: this.last_model_output?.model_dump() ?? null,
            paused: this.paused,
            stopped: this.stopped,
            session_initialized: this.session_initialized,
            follow_up_task: this.follow_up_task,
            message_manager_state: JSON.parse(JSON.stringify(this.message_manager_state)),
            file_system_state: this.file_system_state,
            loop_detector: JSON.parse(JSON.stringify(this.loop_detector)),
        };
    }
    toJSON() {
        return this.model_dump();
    }
}
export class AgentStepInfo {
    step_number;
    max_steps;
    constructor(step_number, max_steps) {
        this.step_number = step_number;
        this.max_steps = max_steps;
    }
    is_last_step() {
        return this.step_number >= this.max_steps - 1;
    }
}
export class StepMetadata {
    step_start_time;
    step_end_time;
    step_number;
    step_interval;
    constructor(step_start_time, step_end_time, step_number, step_interval = null) {
        this.step_start_time = step_start_time;
        this.step_end_time = step_end_time;
        this.step_number = step_number;
        this.step_interval = step_interval;
    }
    get duration_seconds() {
        return this.step_end_time - this.step_start_time;
    }
}
export class PlanItem {
    text;
    status;
    constructor(init) {
        this.text = init?.text ?? '';
        this.status = init?.status ?? 'pending';
    }
    model_dump() {
        return {
            text: this.text,
            status: this.status,
        };
    }
}
export class AgentOutput {
    thinking;
    evaluation_previous_goal;
    memory;
    next_goal;
    current_plan_item;
    plan_update;
    action;
    constructor(init) {
        this.thinking = init?.thinking ?? null;
        this.evaluation_previous_goal = init?.evaluation_previous_goal ?? null;
        this.memory = init?.memory ?? null;
        this.next_goal = init?.next_goal ?? null;
        this.current_plan_item = init?.current_plan_item ?? null;
        this.plan_update = init?.plan_update ?? null;
        this.action = (init?.action ?? []).map((entry) => entry instanceof ActionModel ? entry : new ActionModel(entry));
    }
    get current_state() {
        return {
            thinking: this.thinking,
            evaluation_previous_goal: this.evaluation_previous_goal ?? '',
            memory: this.memory ?? '',
            next_goal: this.next_goal ?? '',
        };
    }
    model_dump() {
        return {
            thinking: this.thinking,
            evaluation_previous_goal: this.evaluation_previous_goal,
            memory: this.memory,
            next_goal: this.next_goal,
            current_plan_item: this.current_plan_item,
            plan_update: this.plan_update,
            action: this.action.map((action) => action.model_dump?.() ?? action),
        };
    }
    model_dump_json() {
        return JSON.stringify(this.model_dump());
    }
    toJSON() {
        return this.model_dump();
    }
    static fromJSON(data) {
        if (!data) {
            return new AgentOutput();
        }
        const actions = Array.isArray(data.action)
            ? data.action.map((item) => new ActionModel(item))
            : [];
        return new AgentOutput({
            thinking: data.thinking ?? null,
            evaluation_previous_goal: data.evaluation_previous_goal ?? null,
            memory: data.memory ?? null,
            next_goal: data.next_goal ?? null,
            current_plan_item: typeof data.current_plan_item === 'number'
                ? data.current_plan_item
                : null,
            plan_update: Array.isArray(data.plan_update)
                ? data.plan_update.filter((item) => typeof item === 'string')
                : null,
            action: actions,
        });
    }
    static type_with_custom_actions(custom_actions) {
        const CustomActionModel = custom_actions;
        return class AgentOutputWithCustomActions extends AgentOutput {
            constructor(init) {
                super(init);
                this.action = (init?.action ?? []).map((entry) => entry instanceof CustomActionModel
                    ? entry
                    : new CustomActionModel(entry?.model_dump?.() ?? entry));
            }
        };
    }
    static type_with_custom_actions_no_thinking(custom_actions) {
        const BaseModel = AgentOutput.type_with_custom_actions(custom_actions);
        return class AgentOutputWithoutThinking extends BaseModel {
            constructor(init) {
                super(init);
                this.thinking = null;
            }
        };
    }
    static type_with_custom_actions_flash_mode(custom_actions) {
        const BaseModel = AgentOutput.type_with_custom_actions(custom_actions);
        return class AgentOutputFlashMode extends BaseModel {
            constructor(init) {
                super(init);
                this.thinking = null;
                this.evaluation_previous_goal = null;
                this.next_goal = null;
                this.current_plan_item = null;
                this.plan_update = null;
            }
        };
    }
}
export class AgentHistory {
    model_output;
    result;
    state;
    metadata;
    state_message;
    constructor(model_output, result, state, metadata = null, state_message = null) {
        this.model_output = model_output;
        this.result = result;
        this.state = state;
        this.metadata = metadata;
        this.state_message = state_message;
    }
    static get_interacted_element(model_output, selector_map) {
        const elements = [];
        for (const action of model_output.action) {
            const index = typeof action.get_index === 'function' ? action.get_index() : null;
            if (index != null && selector_map[index]) {
                const node = selector_map[index];
                elements.push(HistoryTreeProcessor.convert_dom_element_to_history_element(node));
            }
            else {
                elements.push(null);
            }
        }
        return elements;
    }
    static _filterSensitiveDataFromString(value, sensitive_data) {
        if (!sensitive_data) {
            return value;
        }
        const placeholders = {};
        for (const [keyOrDomain, content] of Object.entries(sensitive_data)) {
            if (typeof content === 'string' && content) {
                placeholders[keyOrDomain] = content;
            }
            else if (content && typeof content === 'object') {
                for (const [key, val] of Object.entries(content)) {
                    if (val) {
                        placeholders[key] = val;
                    }
                }
            }
        }
        if (!Object.keys(placeholders).length) {
            return value;
        }
        let filtered = value;
        for (const [key, secret] of Object.entries(placeholders)) {
            filtered = filtered.split(secret).join(`<secret>${key}</secret>`);
        }
        return filtered;
    }
    static _filterSensitiveDataFromDict(data, sensitive_data) {
        if (!sensitive_data) {
            return data;
        }
        const filtered = {};
        for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'string') {
                filtered[key] = this._filterSensitiveDataFromString(value, sensitive_data);
            }
            else if (value && typeof value === 'object' && !Array.isArray(value)) {
                filtered[key] = this._filterSensitiveDataFromDict(value, sensitive_data);
            }
            else if (Array.isArray(value)) {
                filtered[key] = value.map((item) => {
                    if (typeof item === 'string') {
                        return this._filterSensitiveDataFromString(item, sensitive_data);
                    }
                    if (item && typeof item === 'object' && !Array.isArray(item)) {
                        return this._filterSensitiveDataFromDict(item, sensitive_data);
                    }
                    return item;
                });
            }
            else {
                filtered[key] = value;
            }
        }
        return filtered;
    }
    toJSON(sensitive_data = null) {
        let modelOutput = this.model_output?.toJSON() ?? null;
        if (modelOutput &&
            Array.isArray(modelOutput.action) &&
            sensitive_data) {
            modelOutput.action = modelOutput.action.map((action) => Object.prototype.hasOwnProperty.call(action, 'input')
                ? AgentHistory._filterSensitiveDataFromDict(action, sensitive_data)
                : action);
        }
        return {
            model_output: modelOutput,
            result: this.result.map((r) => r.toJSON()),
            state: this.state.to_dict(),
            metadata: this.metadata
                ? {
                    step_start_time: this.metadata.step_start_time,
                    step_end_time: this.metadata.step_end_time,
                    step_number: this.metadata.step_number,
                    step_interval: this.metadata.step_interval,
                }
                : null,
            state_message: this.state_message,
        };
    }
}
export class AgentHistoryList {
    history;
    usage;
    _output_model_schema = null;
    constructor(history = [], usage = null) {
        this.history = history;
        this.usage = usage ?? null;
    }
    total_duration_seconds() {
        return this.history.reduce((sum, item) => sum + (item.metadata?.duration_seconds ?? 0), 0);
    }
    add_item(history_item) {
        this.history.push(history_item);
    }
    last_action() {
        if (!this.history.length) {
            return null;
        }
        const last = this.history[this.history.length - 1];
        if (!last.model_output || !last.model_output.action.length) {
            return null;
        }
        const action = last.model_output.action[last.model_output.action.length - 1];
        if (typeof action?.model_dump === 'function') {
            return action.model_dump();
        }
        return action;
    }
    errors() {
        return this.history.map((historyItem) => {
            const error = historyItem.result.find((result) => result.error);
            return error?.error ?? null;
        });
    }
    final_result() {
        if (!this.history.length) {
            return null;
        }
        const last = this.history[this.history.length - 1];
        const result = last.result[last.result.length - 1];
        return result?.extracted_content ?? null;
    }
    is_done() {
        if (!this.history.length) {
            return false;
        }
        const last = this.history[this.history.length - 1];
        const result = last.result[last.result.length - 1];
        return result?.is_done === true;
    }
    is_successful() {
        if (!this.history.length) {
            return null;
        }
        const last = this.history[this.history.length - 1];
        const result = last.result[last.result.length - 1];
        if (result?.is_done) {
            return result.success ?? null;
        }
        return null;
    }
    judgement() {
        if (!this.history.length) {
            return null;
        }
        const last = this.history[this.history.length - 1];
        const result = last.result[last.result.length - 1];
        if (result?.judgement && typeof result.judgement === 'object') {
            return result.judgement;
        }
        return null;
    }
    is_judged() {
        return this.judgement() != null;
    }
    is_validated() {
        const judgement = this.judgement();
        if (!judgement) {
            return null;
        }
        return judgement.verdict === true;
    }
    has_errors() {
        return this.errors().some((error) => error != null);
    }
    urls() {
        return this.history.map((item) => item.state.url ?? null);
    }
    screenshot_paths(n_last = null, return_none_if_not_screenshot = true) {
        if (n_last === 0) {
            return [];
        }
        const items = n_last == null ? this.history : this.history.slice(-n_last);
        return items
            .map((item) => item.state.screenshot_path ?? null)
            .filter((pathValue) => return_none_if_not_screenshot || pathValue !== null);
    }
    screenshots(n_last = null, return_none_if_not_screenshot = true) {
        if (n_last === 0) {
            return [];
        }
        const items = n_last == null ? this.history : this.history.slice(-n_last);
        const screenshots = [];
        for (const item of items) {
            const screenshot = item.state.get_screenshot();
            if (screenshot) {
                screenshots.push(screenshot);
            }
            else if (return_none_if_not_screenshot) {
                screenshots.push(null);
            }
        }
        return screenshots;
    }
    action_names() {
        const names = [];
        for (const action of this.model_actions()) {
            const [name] = Object.keys(action);
            if (name) {
                names.push(name);
            }
        }
        return names;
    }
    model_thoughts() {
        return this.history
            .filter((item) => item.model_output)
            .map((item) => item.model_output.current_state);
    }
    model_outputs() {
        return (this.history
            .filter((item) => item.model_output)
            .map((item) => item.model_output) ?? []);
    }
    model_actions() {
        const outputs = [];
        for (const item of this.history) {
            if (!item.model_output) {
                continue;
            }
            const interacted = item.state.interacted_element ?? [];
            for (let index = 0; index < item.model_output.action.length; index += 1) {
                const action = item.model_output.action[index];
                const interactedElement = interacted[index] ?? null;
                const payload = typeof action?.model_dump === 'function'
                    ? action.model_dump()
                    : action;
                if (payload && typeof payload === 'object' && interactedElement) {
                    payload.interacted_element =
                        interactedElement;
                }
                else if (payload && typeof payload === 'object') {
                    payload.interacted_element =
                        interactedElement;
                }
                outputs.push(payload);
            }
        }
        return outputs;
    }
    action_history() {
        const history = [];
        for (const item of this.history) {
            const stepActions = [];
            if (item.model_output) {
                const interacted = item.state.interacted_element ?? [];
                for (let index = 0; index < item.model_output.action.length; index += 1) {
                    const action = item.model_output.action[index];
                    const interactedElement = interacted[index] ?? null;
                    const result = item.result[index];
                    const payload = typeof action?.model_dump === 'function'
                        ? action.model_dump()
                        : action;
                    const enriched = payload && typeof payload === 'object'
                        ? { ...payload }
                        : { action: payload };
                    enriched.interacted_element = interactedElement;
                    enriched.result = result?.long_term_memory ?? null;
                    stepActions.push(enriched);
                }
            }
            history.push(stepActions);
        }
        return history;
    }
    action_results() {
        return this.history.flatMap((item) => item.result);
    }
    extracted_content() {
        return this.history.flatMap((item) => item.result.map((result) => result.extracted_content).filter(Boolean));
    }
    model_actions_filtered(include = []) {
        if (!include.length) {
            return this.model_actions();
        }
        return this.model_actions().filter((action) => {
            const [name] = Object.keys(action);
            return include.includes(name);
        });
    }
    number_of_steps() {
        return this.history.length;
    }
    agent_steps() {
        const steps = [];
        for (let stepIndex = 0; stepIndex < this.history.length; stepIndex += 1) {
            const historyItem = this.history[stepIndex];
            let stepText = `Step ${stepIndex + 1}:\n`;
            if (historyItem.model_output?.action?.length) {
                const actions = historyItem.model_output.action.map((action) => typeof action?.model_dump === 'function'
                    ? action.model_dump()
                    : action);
                stepText += `Actions: ${JSON.stringify(actions, null, 1)}\n`;
            }
            if (historyItem.result?.length) {
                for (let resultIndex = 0; resultIndex < historyItem.result.length; resultIndex += 1) {
                    const result = historyItem.result[resultIndex];
                    if (result?.extracted_content) {
                        stepText += `Result ${resultIndex + 1}: ${String(result.extracted_content)}\n`;
                    }
                    if (result?.error) {
                        stepText += `Error ${resultIndex + 1}: ${String(result.error)}\n`;
                    }
                }
            }
            steps.push(stepText);
        }
        return steps;
    }
    get structured_output() {
        const final_result = this.final_result();
        if (!final_result || !this._output_model_schema) {
            return null;
        }
        return parseStructuredOutput(this._output_model_schema, final_result);
    }
    get_structured_output(outputModel) {
        const finalResult = this.final_result();
        if (!finalResult) {
            return null;
        }
        return parseStructuredOutput(outputModel, finalResult);
    }
    save_to_file(filepath, sensitive_data = null) {
        const dir = path.dirname(filepath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filepath, JSON.stringify(this.toJSON(sensitive_data), null, 2), 'utf-8');
    }
    static load_from_file(filepath, outputModel) {
        const content = fs.readFileSync(filepath, 'utf-8');
        const payload = JSON.parse(content);
        return AgentHistoryList.load_from_dict(payload, outputModel);
    }
    static load_from_dict(payload, outputModel) {
        const historyItems = (payload.history ?? []).map((entry) => {
            const modelOutput = entry.model_output
                ? outputModel.fromJSON(entry.model_output)
                : null;
            const result = (entry.result ?? []).map((item) => new ActionResult(item));
            const state = new BrowserStateHistory(entry.state?.url ?? '', entry.state?.title ?? '', entry.state?.tabs ?? [], entry.state?.interacted_element ?? [], entry.state?.screenshot_path ?? null);
            const metadata = entry.metadata
                ? new StepMetadata(entry.metadata.step_start_time, entry.metadata.step_end_time, entry.metadata.step_number, entry.metadata.step_interval ?? null)
                : null;
            return new AgentHistory(modelOutput, result, state, metadata, entry.state_message ?? null);
        });
        return new AgentHistoryList(historyItems);
    }
    toJSON(sensitive_data = null) {
        return {
            history: this.history.map((item) => item.toJSON(sensitive_data)),
        };
    }
    model_dump(sensitive_data = null) {
        return this.toJSON(sensitive_data);
    }
}
export class DetectedVariable {
    name;
    original_value;
    type;
    format;
    constructor(name, original_value, type = 'string', format = null) {
        this.name = name;
        this.original_value = original_value;
        this.type = type;
        this.format = format;
    }
    model_dump() {
        return {
            name: this.name,
            original_value: this.original_value,
            type: this.type,
            format: this.format,
        };
    }
}
export class VariableMetadata {
    detected_variables;
    constructor(detected_variables = {}) {
        this.detected_variables = detected_variables;
    }
}
export class AgentError extends Error {
    static VALIDATION_ERROR = 'Invalid model output format. Please follow the correct schema.';
    static RATE_LIMIT_ERROR = 'Rate limit reached. Waiting before retry.';
    static NO_VALID_ACTION = 'No valid action found';
    static format_error(error, include_trace = false) {
        if (error?.name === 'ValidationError') {
            return `${AgentError.VALIDATION_ERROR}\nDetails: ${error.message}`;
        }
        if (error.name === 'RateLimitError') {
            return AgentError.RATE_LIMIT_ERROR;
        }
        const errorStr = error.message ?? String(error);
        if (errorStr.includes('LLM response missing required fields') ||
            errorStr.includes('Expected format: AgentOutput')) {
            const [mainError] = errorStr.split('\n');
            let helpfulMessage = `${mainError}\n\n` +
                'The previous response had an invalid output structure. ' +
                'Please stick to the required output format. \n\n';
            if (include_trace && error?.stack) {
                helpfulMessage += `\n\nFull stacktrace:\n${error.stack}`;
            }
            return helpfulMessage;
        }
        if (include_trace && error?.stack) {
            return `${error.message}\nStacktrace:\n${error.stack}`;
        }
        return error.message;
    }
}
