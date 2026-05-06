import type { BaseChatModel, ChatInvokeOptions } from '../base.js';
import type { Message } from '../messages.js';
import { ChatInvokeCompletion } from '../views.js';
export interface ChatDeepSeekOptions {
    model?: string;
    apiKey?: string;
    baseURL?: string;
    timeout?: number | null;
    clientParams?: Record<string, unknown> | null;
    temperature?: number | null;
    maxTokens?: number | null;
    topP?: number | null;
    seed?: number | null;
    maxRetries?: number;
}
export declare class ChatDeepSeek implements BaseChatModel {
    model: string;
    provider: string;
    private client;
    private temperature;
    private maxTokens;
    private topP;
    private seed;
    constructor(options?: string | ChatDeepSeekOptions);
    get name(): string;
    get model_name(): string;
    private getUsage;
    ainvoke(messages: Message[], output_format?: undefined, options?: ChatInvokeOptions): Promise<ChatInvokeCompletion<string>>;
    ainvoke<T>(messages: Message[], output_format: {
        parse: (input: string) => T;
    } | undefined, options?: ChatInvokeOptions): Promise<ChatInvokeCompletion<T>>;
}
