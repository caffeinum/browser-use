/**
 * AWS Bedrock Anthropic Claude chat model.
 *
 * This is a convenience class that provides Claude-specific defaults
 * for the AWS Bedrock service. It inherits all functionality from
 * ChatBedrockConverse but sets Anthropic Claude as the default model
 * and uses the Anthropic message serializer for better compatibility.
 *
 * Usage:
 * ```typescript
 * import { ChatAnthropicBedrock } from './llm/aws/chat-anthropic.js';
 *
 * const llm = new ChatAnthropicBedrock({
 *   model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
 *   region: 'us-east-1'
 * });
 *
 * const response = await llm.ainvoke(messages);
 * ```
 */
import type { BaseChatModel, ChatInvokeOptions } from '../base.js';
import { ChatInvokeCompletion } from '../views.js';
import { type Message } from '../messages.js';
export interface ChatAnthropicBedrockConfig {
    /** Model ID, defaults to Claude 3.5 Sonnet */
    model?: string;
    /** AWS region, defaults to us-east-1 */
    region?: string;
    /** AWS access key ID */
    awsAccessKeyId?: string;
    /** AWS secret access key */
    awsSecretAccessKey?: string;
    /** AWS session token */
    awsSessionToken?: string;
    /** Retry attempts */
    maxRetries?: number;
    /** Maximum tokens to generate */
    max_tokens?: number;
    /** Temperature for sampling (0-1) */
    temperature?: number | null;
    /** Top-p sampling parameter */
    top_p?: number | null;
    /** Top-k sampling parameter */
    top_k?: number | null;
    /** Stop sequences */
    stop_sequences?: string[] | null;
    /** Remove minItems from schema for provider compatibility */
    removeMinItemsFromSchema?: boolean;
    /** Remove default from schema for provider compatibility */
    removeDefaultsFromSchema?: boolean;
}
export declare class ChatAnthropicBedrock implements BaseChatModel {
    model: string;
    provider: string;
    private client;
    private max_tokens;
    private temperature;
    private top_p;
    private top_k;
    private stop_sequences;
    private removeMinItemsFromSchema;
    private removeDefaultsFromSchema;
    constructor(config?: ChatAnthropicBedrockConfig);
    get name(): string;
    get model_name(): string;
    private _getInferenceParams;
    private getZodSchemaCandidate;
    private parseOutput;
    private getTextCompletion;
    ainvoke(messages: Message[], output_format?: undefined, options?: ChatInvokeOptions): Promise<ChatInvokeCompletion<string>>;
    ainvoke<T>(messages: Message[], output_format: {
        parse: (input: string) => T;
    }, options?: ChatInvokeOptions): Promise<ChatInvokeCompletion<T>>;
    /**
     * Simple Zod to JSON Schema conversion for structured output
     */
    private _zodToJsonSchema;
}
