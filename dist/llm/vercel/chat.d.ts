import type { BaseChatModel, ChatInvokeOptions } from '../base.js';
import type { Message } from '../messages.js';
import { ChatInvokeCompletion } from '../views.js';
export interface ChatVercelOptions {
    model?: string;
    apiKey?: string;
    baseURL?: string;
    timeout?: number | null;
    temperature?: number | null;
    maxTokens?: number | null;
    topP?: number | null;
    seed?: number | null;
    maxRetries?: number;
    defaultHeaders?: Record<string, string> | null;
    defaultQuery?: Record<string, string | undefined> | null;
    fetchImplementation?: typeof fetch;
    fetchOptions?: RequestInit | null;
    reasoningModels?: string[] | null;
    providerOptions?: Record<string, unknown> | null;
    extraBody?: Record<string, unknown> | null;
    removeMinItemsFromSchema?: boolean;
    removeDefaultsFromSchema?: boolean;
}
export declare class ChatVercel implements BaseChatModel {
    model: string;
    provider: string;
    private client;
    private temperature;
    private maxTokens;
    private topP;
    private seed;
    private reasoningModels;
    private providerOptions;
    private extraBody;
    private removeMinItemsFromSchema;
    private removeDefaultsFromSchema;
    constructor(options?: string | ChatVercelOptions);
    get name(): string;
    get model_name(): string;
    private getUsage;
    private getExtraBodyPayload;
    private cloneMessages;
    private appendJsonInstructionToMessages;
    private parseStructuredJson;
    private parseOutput;
    ainvoke(messages: Message[], output_format?: undefined, options?: ChatInvokeOptions): Promise<ChatInvokeCompletion<string>>;
    ainvoke<T>(messages: Message[], output_format: {
        parse: (input: string) => T;
    } | undefined, options?: ChatInvokeOptions): Promise<ChatInvokeCompletion<T>>;
}
