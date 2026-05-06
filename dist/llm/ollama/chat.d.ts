import { type Config as OllamaClientConfig, type Options as OllamaOptions } from 'ollama';
import type { BaseChatModel, ChatInvokeOptions } from '../base.js';
import { ChatInvokeCompletion } from '../views.js';
import type { Message } from '../messages.js';
export interface ChatOllamaOptions {
    model?: string;
    host?: string;
    timeout?: number | null;
    clientParams?: Partial<OllamaClientConfig> | null;
    ollamaOptions?: Partial<OllamaOptions> | null;
}
export declare class ChatOllama implements BaseChatModel {
    model: string;
    provider: string;
    private client;
    private ollamaOptions;
    constructor(modelOrOptions?: string | ChatOllamaOptions, host?: string);
    get name(): string;
    get model_name(): string;
    private getZodSchemaCandidate;
    private parseOutput;
    private createTimeoutFetch;
    ainvoke(messages: Message[], output_format?: undefined, options?: ChatInvokeOptions): Promise<ChatInvokeCompletion<string>>;
    ainvoke<T>(messages: Message[], output_format: {
        parse: (input: string) => T;
    } | undefined, options?: ChatInvokeOptions): Promise<ChatInvokeCompletion<T>>;
}
