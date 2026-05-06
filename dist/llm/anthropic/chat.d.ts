import { type ClientOptions } from '@anthropic-ai/sdk';
import type { BaseChatModel, ChatInvokeOptions } from '../base.js';
import { ChatInvokeCompletion } from '../views.js';
import { type Message } from '../messages.js';
export interface ChatAnthropicOptions {
    model?: string;
    apiKey?: string;
    authToken?: string;
    baseURL?: string;
    timeout?: number;
    maxTokens?: number;
    temperature?: number | null;
    topP?: number | null;
    seed?: number | null;
    maxRetries?: number;
    defaultHeaders?: Record<string, string>;
    defaultQuery?: Record<string, string | undefined>;
    fetchImplementation?: ClientOptions['fetch'];
    fetchOptions?: ClientOptions['fetchOptions'];
    removeMinItemsFromSchema?: boolean;
    removeDefaultsFromSchema?: boolean;
}
export declare class ChatAnthropic implements BaseChatModel {
    model: string;
    provider: string;
    private client;
    private maxTokens;
    private temperature;
    private topP;
    private seed;
    private removeMinItemsFromSchema;
    private removeDefaultsFromSchema;
    constructor(options?: string | ChatAnthropicOptions);
    get name(): string;
    get model_name(): string;
    private getModelParams;
    private getZodSchemaCandidate;
    private parseOutput;
    private getTextCompletion;
    private getUsage;
    ainvoke(messages: Message[], output_format?: undefined, options?: ChatInvokeOptions): Promise<ChatInvokeCompletion<string>>;
    ainvoke<T>(messages: Message[], output_format: {
        parse: (input: string) => T;
    } | undefined, options?: ChatInvokeOptions): Promise<ChatInvokeCompletion<T>>;
}
