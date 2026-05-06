import type { BaseChatModel, ChatInvokeOptions } from '../base.js';
import { ChatInvokeCompletion } from '../views.js';
import { type Message } from '../messages.js';
export interface ChatBedrockConverseOptions {
    model?: string;
    region?: string;
    awsAccessKeyId?: string;
    awsSecretAccessKey?: string;
    awsSessionToken?: string;
    maxTokens?: number | null;
    temperature?: number | null;
    topP?: number | null;
    seed?: number | null;
    stopSequences?: string[] | null;
    maxRetries?: number;
    removeMinItemsFromSchema?: boolean;
    removeDefaultsFromSchema?: boolean;
}
export declare class ChatBedrockConverse implements BaseChatModel {
    model: string;
    provider: string;
    private client;
    private maxTokens;
    private temperature;
    private topP;
    private seed;
    private stopSequences;
    private removeMinItemsFromSchema;
    private removeDefaultsFromSchema;
    constructor(modelOrOptions?: string | ChatBedrockConverseOptions, region?: string);
    get name(): string;
    get model_name(): string;
    private getInferenceConfig;
    private getUsage;
    private getZodSchemaCandidate;
    private parseOutput;
    private getTextCompletion;
    ainvoke(messages: Message[], output_format?: undefined, options?: ChatInvokeOptions): Promise<ChatInvokeCompletion<string>>;
    ainvoke<T>(messages: Message[], output_format: {
        parse: (input: string) => T;
    } | undefined, options?: ChatInvokeOptions): Promise<ChatInvokeCompletion<T>>;
}
