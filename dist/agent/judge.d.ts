import { type Message } from '../llm/messages.js';
export interface ConstructJudgeMessagesOptions {
    task: string;
    final_result: string;
    agent_steps: string[];
    screenshot_paths: string[];
    max_images?: number;
    ground_truth?: string | null;
    use_vision?: boolean | 'auto';
}
export interface ConstructSimpleJudgeMessagesOptions {
    task: string;
    final_result: string;
    current_date?: string;
}
export declare const construct_judge_messages: (options: ConstructJudgeMessagesOptions) => Message[];
export declare const construct_simple_judge_messages: (options: ConstructSimpleJudgeMessagesOptions) => Message[];
