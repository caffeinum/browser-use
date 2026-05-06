import type { BaseChatModel, ChatInvokeOptions } from '../base.js';
import { ChatInvokeCompletion } from '../views.js';
import type { Message } from '../messages.js';
export interface ChatGoogleOptions {
    model?: string;
    apiKey?: string;
    apiVersion?: string;
    baseUrl?: string;
    vertexai?: boolean;
    vertexAi?: boolean;
    project?: string;
    location?: string;
    httpOptions?: Record<string, unknown>;
    googleAuthOptions?: Record<string, unknown>;
    credentials?: Record<string, unknown>;
    temperature?: number | null;
    topP?: number | null;
    seed?: number | null;
    thinkingBudget?: number | null;
    thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high' | null;
    maxOutputTokens?: number | null;
    config?: Record<string, unknown> | null;
    includeSystemInUser?: boolean;
    supportsStructuredOutput?: boolean;
    maxRetries?: number;
    retryableStatusCodes?: number[];
    retryBaseDelay?: number;
    retryMaxDelay?: number;
}
export declare class ChatGoogle implements BaseChatModel {
    model: string;
    provider: string;
    private client;
    private temperature;
    private topP;
    private seed;
    private thinkingBudget;
    private thinkingLevel;
    private maxOutputTokens;
    private config;
    private includeSystemInUser;
    private supportsStructuredOutput;
    private maxRetries;
    private retryableStatusCodes;
    private retryBaseDelay;
    private retryMaxDelay;
    constructor(options?: string | ChatGoogleOptions);
    get name(): string;
    get model_name(): string;
    private getUsage;
    /**
     * Clean up JSON schema for Google's format
     * Google API has specific requirements for responseSchema
     */
    private _cleanSchemaForGoogle;
    private _parseStructuredJson;
    private _extractStatusCode;
    private _toModelProviderError;
    private _sleep;
    ainvoke(messages: Message[], output_format?: undefined, options?: ChatInvokeOptions): Promise<ChatInvokeCompletion<string>>;
    ainvoke<T>(messages: Message[], output_format: {
        parse: (input: string) => T;
    } | undefined, options?: ChatInvokeOptions): Promise<ChatInvokeCompletion<T>>;
}
