import type { BaseChatModel, ChatInvokeOptions } from '../base.js';
import { ChatInvokeCompletion } from '../views.js';
import type { Message } from '../messages.js';
export interface ChatOpenAIOptions {
    model?: string;
    apiKey?: string;
    organization?: string;
    project?: string;
    baseURL?: string;
    timeout?: number | null;
    temperature?: number | null;
    frequencyPenalty?: number | null;
    reasoningEffort?: 'low' | 'medium' | 'high';
    serviceTier?: 'auto' | 'default' | 'flex' | 'priority' | 'scale' | null;
    maxCompletionTokens?: number | null;
    maxRetries?: number;
    defaultHeaders?: Record<string, string> | null;
    defaultQuery?: Record<string, string | undefined> | null;
    fetchImplementation?: typeof fetch;
    fetchOptions?: RequestInit | null;
    seed?: number | null;
    topP?: number | null;
    addSchemaToSystemPrompt?: boolean;
    dontForceStructuredOutput?: boolean;
    removeMinItemsFromSchema?: boolean;
    removeDefaultsFromSchema?: boolean;
    reasoningModels?: string[] | null;
}
export declare class ChatOpenAI implements BaseChatModel {
    model: string;
    provider: string;
    private client;
    private temperature;
    private frequencyPenalty;
    private reasoningEffort;
    private serviceTier;
    private maxCompletionTokens;
    private seed;
    private topP;
    private addSchemaToSystemPrompt;
    private dontForceStructuredOutput;
    private removeMinItemsFromSchema;
    private removeDefaultsFromSchema;
    private reasoningModels;
    constructor(options?: ChatOpenAIOptions);
    get name(): string;
    get model_name(): string;
    private isReasoningModel;
    private getUsage;
    ainvoke(messages: Message[], output_format?: undefined, options?: ChatInvokeOptions): Promise<ChatInvokeCompletion<string>>;
    ainvoke<T>(messages: Message[], output_format: {
        parse: (input: string) => T;
    } | undefined, options?: ChatInvokeOptions): Promise<ChatInvokeCompletion<T>>;
}
