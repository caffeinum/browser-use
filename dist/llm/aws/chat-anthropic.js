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
import { BedrockRuntimeClient, ConverseCommand, } from '@aws-sdk/client-bedrock-runtime';
import { ModelProviderError, ModelRateLimitError } from '../exceptions.js';
import { ChatInvokeCompletion } from '../views.js';
import { AnthropicMessageSerializer } from '../anthropic/serializer.js';
import { SchemaOptimizer, zodSchemaToJsonSchema } from '../schema.js';
export class ChatAnthropicBedrock {
    model;
    provider = 'anthropic_bedrock';
    client;
    max_tokens;
    temperature;
    top_p;
    top_k;
    stop_sequences;
    removeMinItemsFromSchema;
    removeDefaultsFromSchema;
    constructor(config = {}) {
        // Anthropic Claude specific defaults
        this.model = config.model || 'anthropic.claude-3-5-sonnet-20241022-v2:0';
        this.max_tokens = config.max_tokens || 8192;
        this.temperature =
            config.temperature === undefined ? null : config.temperature;
        this.top_p = config.top_p === undefined ? null : config.top_p;
        this.top_k = config.top_k === undefined ? null : config.top_k;
        this.stop_sequences =
            config.stop_sequences === undefined ? null : config.stop_sequences;
        this.removeMinItemsFromSchema = config.removeMinItemsFromSchema ?? false;
        this.removeDefaultsFromSchema = config.removeDefaultsFromSchema ?? false;
        const region = config.region || process.env.AWS_REGION || 'us-east-1';
        const awsSessionToken = config.awsSessionToken || process.env.AWS_SESSION_TOKEN;
        const credentials = config.awsAccessKeyId && config.awsSecretAccessKey
            ? {
                accessKeyId: config.awsAccessKeyId,
                secretAccessKey: config.awsSecretAccessKey,
                ...(awsSessionToken ? { sessionToken: awsSessionToken } : {}),
            }
            : undefined;
        this.client = new BedrockRuntimeClient({
            region,
            ...(credentials ? { credentials } : {}),
            ...(config.maxRetries !== undefined
                ? { maxAttempts: config.maxRetries }
                : {}),
        });
    }
    get name() {
        return this.model;
    }
    get model_name() {
        return this.model;
    }
    _getInferenceParams() {
        const params = {
            maxTokens: this.max_tokens,
        };
        if (this.temperature !== null) {
            params.temperature = this.temperature;
        }
        if (this.top_p !== null) {
            params.topP = this.top_p;
        }
        if (this.stop_sequences !== null && this.stop_sequences.length > 0) {
            params.stopSequences = this.stop_sequences;
        }
        return params;
    }
    getZodSchemaCandidate(output_format) {
        const output = output_format;
        if (output &&
            typeof output === 'object' &&
            typeof output.safeParse === 'function' &&
            typeof output.parse === 'function') {
            return output;
        }
        if (output &&
            typeof output === 'object' &&
            output.schema &&
            typeof output.schema.safeParse === 'function' &&
            typeof output.schema.parse === 'function') {
            return output.schema;
        }
        return null;
    }
    parseOutput(output_format, payload) {
        const output = output_format;
        if (output &&
            typeof output === 'object' &&
            output.schema &&
            typeof output.schema.parse === 'function') {
            return output.schema.parse(payload);
        }
        return output.parse(payload);
    }
    getTextCompletion(response) {
        const contentBlocks = response?.output?.message?.content;
        if (!Array.isArray(contentBlocks)) {
            return '';
        }
        return contentBlocks
            .filter((block) => typeof block?.text === 'string')
            .map((block) => block.text)
            .join('\n');
    }
    async ainvoke(messages, output_format, options = {}) {
        // Use Anthropic-specific message serializer
        const serializer = new AnthropicMessageSerializer();
        const [anthropicMessages, systemPrompt] = serializer.serializeMessages(messages);
        // Convert Anthropic messages to Bedrock format
        const bedrockMessages = anthropicMessages.map((msg) => {
            const content = Array.isArray(msg.content)
                ? msg.content.map((block) => {
                    if (block.type === 'text') {
                        return { text: block.text };
                    }
                    else if (block.type === 'tool_use') {
                        return {
                            toolUse: {
                                toolUseId: block.id,
                                name: block.name,
                                input: block.input,
                            },
                        };
                    }
                    else if (block.type === 'image') {
                        if (block.source?.type === 'base64') {
                            return {
                                image: {
                                    format: String(block.source.media_type || 'image/jpeg').split('/')[1] ?? 'jpeg',
                                    source: {
                                        bytes: Buffer.from(block.source.data ?? '', 'base64'),
                                    },
                                },
                            };
                        }
                        return { text: '[Image]' };
                    }
                    return { text: String(block) };
                })
                : [{ text: msg.content }];
            return {
                role: msg.role,
                content,
            };
        });
        // Handle system message
        const system = systemPrompt
            ? [
                {
                    text: typeof systemPrompt === 'string'
                        ? systemPrompt
                        : JSON.stringify(systemPrompt),
                },
            ]
            : undefined;
        let toolConfig = undefined;
        const zodSchemaCandidate = this.getZodSchemaCandidate(output_format);
        if (output_format && zodSchemaCandidate) {
            // Structured output using tools
            try {
                const rawSchema = this._zodToJsonSchema(zodSchemaCandidate);
                const schema = SchemaOptimizer.createOptimizedJsonSchema(rawSchema, {
                    removeMinItems: this.removeMinItemsFromSchema,
                    removeDefaults: this.removeDefaultsFromSchema,
                });
                delete schema.title;
                const tools = [
                    {
                        toolSpec: {
                            name: 'extract_structured_data',
                            description: 'Extract structured data from the response',
                            inputSchema: {
                                json: schema,
                            },
                        },
                    },
                ];
                toolConfig = {
                    tools,
                    toolChoice: { tool: { name: 'extract_structured_data' } },
                };
            }
            catch (e) {
                console.warn('Failed to convert output_format to JSON schema', e);
            }
        }
        const command = new ConverseCommand({
            modelId: this.model,
            messages: bedrockMessages,
            system: system,
            toolConfig: toolConfig,
            inferenceConfig: this._getInferenceParams(),
        });
        try {
            const response = await this.client.send(command, options.signal ? { abortSignal: options.signal } : undefined);
            let completion = this.getTextCompletion(response);
            const contentBlocks = response?.output?.message?.content;
            const toolUseBlock = Array.isArray(contentBlocks)
                ? contentBlocks.find((block) => block?.toolUse)
                : undefined;
            if (toolUseBlock?.toolUse && output_format) {
                const input = toolUseBlock.toolUse.input;
                if (typeof input === 'string') {
                    completion = this.parseOutput(output_format, JSON.parse(input));
                }
                else {
                    completion = this.parseOutput(output_format, input);
                }
            }
            else if (output_format && toolConfig) {
                throw new ModelProviderError('Expected tool use in response but none found', 502, this.model);
            }
            else if (output_format) {
                completion = this.parseOutput(output_format, completion);
            }
            else {
                completion = this.getTextCompletion(response);
            }
            const stopReason = response?.stopReason ?? null;
            return new ChatInvokeCompletion(completion, {
                prompt_tokens: response.usage?.inputTokens ?? 0,
                completion_tokens: response.usage?.outputTokens ?? 0,
                total_tokens: response.usage?.totalTokens ?? 0,
            }, null, null, stopReason);
        }
        catch (error) {
            const errorName = String(error?.name ?? '');
            const statusCode = error?.$metadata?.httpStatusCode ?? 502;
            if (statusCode === 429 ||
                errorName.includes('Throttling') ||
                errorName.includes('TooManyRequests')) {
                throw new ModelRateLimitError(error?.message ?? 'Rate limit exceeded', 429, this.model);
            }
            throw new ModelProviderError(error?.message ?? String(error), statusCode, this.model);
        }
    }
    /**
     * Simple Zod to JSON Schema conversion for structured output
     */
    _zodToJsonSchema(schema) {
        return zodSchemaToJsonSchema(schema, {
            name: 'Response',
            target: 'jsonSchema7',
        });
    }
}
