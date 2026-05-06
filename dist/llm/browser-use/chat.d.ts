import type { BaseChatModel, ChatInvokeOptions } from '../base.js';
import type { Message } from '../messages.js';
import { ChatInvokeCompletion } from '../views.js';
export interface ChatBrowserUseOptions {
    model?: string;
    apiKey?: string;
    baseUrl?: string;
    timeout?: number;
    maxRetries?: number;
    retryBaseDelay?: number;
    retryMaxDelay?: number;
    fast?: boolean;
    fetchImplementation?: typeof fetch;
}
export declare class ChatBrowserUse implements BaseChatModel {
    model: string;
    provider: string;
    private readonly apiKey;
    private readonly baseUrl;
    private readonly timeoutMs;
    private readonly maxRetries;
    private readonly retryBaseDelay;
    private readonly retryMaxDelay;
    private readonly fast;
    private readonly fetchImplementation;
    constructor(options?: ChatBrowserUseOptions);
    get name(): string;
    get model_name(): string;
    private getOutputSchema;
    private parseOutput;
    private serializeMessage;
    private getUsage;
    private raiseHttpError;
    private isRetryableNetworkError;
    private makeRequest;
    ainvoke(messages: Message[], output_format?: undefined, options?: ChatInvokeOptions): Promise<ChatInvokeCompletion<string>>;
    ainvoke<T>(messages: Message[], output_format: {
        parse: (input: string) => T;
    } | undefined, options?: ChatInvokeOptions): Promise<ChatInvokeCompletion<T>>;
}
