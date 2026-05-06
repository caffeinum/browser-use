import { ChatOpenAILike } from '../openai/like.js';
import type { ChatOpenAIOptions } from '../openai/chat.js';
export interface ChatLiteLLMOptions extends ChatOpenAIOptions {
    model?: string;
    apiKey?: string;
    baseURL?: string;
}
export declare class ChatLiteLLM extends ChatOpenAILike {
    provider: string;
    constructor(options?: string | ChatLiteLLMOptions);
}
