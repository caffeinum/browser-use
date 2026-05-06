import type { BaseChatModel, ChatInvokeOptions } from '../base.js';
import type { Message } from '../messages.js';
import { ChatInvokeCompletion } from '../views.js';
export interface ChatMistralOptions {
    model?: string;
    apiKey?: string;
    baseURL?: string;
    timeout?: number | null;
    defaultHeaders?: Record<string, string> | null;
    defaultQuery?: Record<string, string | undefined> | null;
    fetchImplementation?: typeof fetch;
    fetchOptions?: RequestInit | null;
    clientParams?: Record<string, unknown> | null;
    temperature?: number | null;
    maxTokens?: number | null;
    topP?: number | null;
    seed?: number | null;
    safePrompt?: boolean;
    maxRetries?: number;
    removeMinItemsFromSchema?: boolean;
    removeDefaultsFromSchema?: boolean;
}
export declare class ChatMistral implements BaseChatModel {
    model: string;
    provider: string;
    private client;
    private temperature;
    private maxTokens;
    private topP;
    private seed;
    private safePrompt;
    private removeMinItemsFromSchema;
    private removeDefaultsFromSchema;
    constructor(options?: string | ChatMistralOptions);
    get name(): string;
    get model_name(): string;
    private getUsage;
    private getSchemaCandidate;
    ainvoke(messages: Message[], output_format?: undefined, options?: ChatInvokeOptions): Promise<ChatInvokeCompletion<string>>;
    ainvoke<T>(messages: Message[], output_format: {
        parse: (input: string) => T;
    } | undefined, options?: ChatInvokeOptions): Promise<ChatInvokeCompletion<T>>;
}
