import type { BaseChatModel, ChatInvokeOptions } from '../base.js';
import type { Message } from '../messages.js';
import { ChatInvokeCompletion } from '../views.js';
export interface ChatOpenRouterOptions {
    model?: string;
    apiKey?: string;
    baseURL?: string;
    timeout?: number | null;
    temperature?: number | null;
    topP?: number | null;
    seed?: number | null;
    maxRetries?: number;
    defaultHeaders?: Record<string, string> | null;
    defaultQuery?: Record<string, string | undefined> | null;
    fetchImplementation?: typeof fetch;
    fetchOptions?: RequestInit | null;
    httpReferer?: string | null;
    extraBody?: Record<string, unknown> | null;
    removeMinItemsFromSchema?: boolean;
    removeDefaultsFromSchema?: boolean;
}
export declare class ChatOpenRouter implements BaseChatModel {
    model: string;
    provider: string;
    private client;
    private temperature;
    private topP;
    private seed;
    private httpReferer;
    private extraBody;
    private removeMinItemsFromSchema;
    private removeDefaultsFromSchema;
    constructor(options?: string | ChatOpenRouterOptions);
    get name(): string;
    get model_name(): string;
    private getUsage;
    ainvoke(messages: Message[], output_format?: undefined, options?: ChatInvokeOptions): Promise<ChatInvokeCompletion<string>>;
    ainvoke<T>(messages: Message[], output_format: {
        parse: (input: string) => T;
    } | undefined, options?: ChatInvokeOptions): Promise<ChatInvokeCompletion<T>>;
}
