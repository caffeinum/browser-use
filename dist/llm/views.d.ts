export interface ChatInvokeUsage {
    prompt_tokens: number;
    prompt_cached_tokens?: number | null;
    prompt_cache_creation_tokens?: number | null;
    prompt_image_tokens?: number | null;
    completion_tokens: number;
    total_tokens: number;
}
export declare class ChatInvokeCompletion<T = string> {
    completion: T;
    usage: ChatInvokeUsage | null;
    thinking: string | null;
    redacted_thinking: string | null;
    stop_reason: string | null;
    constructor(completion: T, usage?: ChatInvokeUsage | null, thinking?: string | null, redacted_thinking?: string | null, stop_reason?: string | null);
}
