import type { BaseChatModel, ChatInvokeOptions } from '../base.js';
import type { Message } from '../messages.js';
import { ChatInvokeCompletion } from '../views.js';
export interface ChatGroqOptions {
    model?: string;
    apiKey?: string;
    baseURL?: string;
    temperature?: number | null;
    serviceTier?: 'auto' | 'on_demand' | 'flex' | null;
    topP?: number | null;
    seed?: number | null;
    maxRetries?: number;
    removeMinItemsFromSchema?: boolean;
    removeDefaultsFromSchema?: boolean;
}
export declare class ChatGroq implements BaseChatModel {
    model: string;
    provider: string;
    private client;
    private temperature;
    private serviceTier;
    private topP;
    private seed;
    private removeMinItemsFromSchema;
    private removeDefaultsFromSchema;
    constructor(options?: string | ChatGroqOptions);
    get name(): string;
    get model_name(): string;
    private getUsage;
    ainvoke(messages: Message[], output_format?: undefined, options?: ChatInvokeOptions): Promise<ChatInvokeCompletion<string>>;
    ainvoke<T>(messages: Message[], output_format: {
        parse: (input: string) => T;
    } | undefined, options?: ChatInvokeOptions): Promise<ChatInvokeCompletion<T>>;
}
