import { BedrockRuntimeClient, ConverseCommand, } from '@aws-sdk/client-bedrock-runtime';
import { ModelProviderError, ModelRateLimitError } from '../exceptions.js';
import { ChatInvokeCompletion } from '../views.js';
import { SchemaOptimizer, zodSchemaToJsonSchema } from '../schema.js';
import { AWSBedrockMessageSerializer } from './serializer.js';
export class ChatBedrockConverse {
    model;
    provider = 'aws';
    client;
    maxTokens;
    temperature;
    topP;
    seed;
    stopSequences;
    removeMinItemsFromSchema;
    removeDefaultsFromSchema;
    constructor(modelOrOptions = {}, region) {
        const normalizedOptions = typeof modelOrOptions === 'string'
            ? { model: modelOrOptions, region }
            : modelOrOptions;
        const { model = 'anthropic.claude-3-5-sonnet-20240620-v1:0', region: bedrockRegion = process.env.AWS_REGION || 'us-east-1', awsAccessKeyId, awsSecretAccessKey, awsSessionToken = process.env.AWS_SESSION_TOKEN, maxTokens = 4096, temperature = null, topP = null, seed = null, stopSequences = null, maxRetries, removeMinItemsFromSchema = false, removeDefaultsFromSchema = false, } = normalizedOptions;
        this.model = model;
        this.maxTokens = maxTokens;
        this.temperature = temperature;
        this.topP = topP;
        this.seed = seed;
        this.stopSequences = stopSequences;
        this.removeMinItemsFromSchema = removeMinItemsFromSchema;
        this.removeDefaultsFromSchema = removeDefaultsFromSchema;
        const credentials = awsAccessKeyId && awsSecretAccessKey
            ? {
                accessKeyId: awsAccessKeyId,
                secretAccessKey: awsSecretAccessKey,
                ...(awsSessionToken ? { sessionToken: awsSessionToken } : {}),
            }
            : undefined;
        this.client = new BedrockRuntimeClient({
            region: bedrockRegion,
            ...(credentials ? { credentials } : {}),
            ...(maxRetries !== undefined ? { maxAttempts: maxRetries } : {}),
        });
    }
    get name() {
        return this.model;
    }
    get model_name() {
        return this.model;
    }
    getInferenceConfig() {
        const config = {};
        if (this.maxTokens !== null) {
            config.maxTokens = this.maxTokens;
        }
        if (this.temperature !== null) {
            config.temperature = this.temperature;
        }
        if (this.topP !== null) {
            config.topP = this.topP;
        }
        if (this.seed !== null) {
            config.seed = this.seed;
        }
        if (this.stopSequences !== null) {
            config.stopSequences = this.stopSequences;
        }
        return config;
    }
    getUsage(response) {
        const usage = response?.usage ?? {};
        return {
            prompt_tokens: usage.inputTokens ?? 0,
            completion_tokens: usage.outputTokens ?? 0,
            total_tokens: usage.totalTokens ?? 0,
            prompt_cached_tokens: null,
            prompt_cache_creation_tokens: null,
            prompt_image_tokens: null,
        };
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
        const serializer = new AWSBedrockMessageSerializer();
        const [bedrockMessages, systemMessage] = serializer.serializeMessages(messages);
        const zodSchemaCandidate = this.getZodSchemaCandidate(output_format);
        let toolConfig = undefined;
        if (output_format && zodSchemaCandidate) {
            try {
                const rawJsonSchema = zodSchemaToJsonSchema(zodSchemaCandidate, {
                    name: 'Response',
                    target: 'jsonSchema7',
                });
                const optimizedJsonSchema = SchemaOptimizer.createOptimizedJsonSchema(rawJsonSchema, {
                    removeMinItems: this.removeMinItemsFromSchema,
                    removeDefaults: this.removeDefaultsFromSchema,
                });
                delete optimizedJsonSchema.title;
                const tools = [
                    {
                        toolSpec: {
                            name: 'response',
                            description: 'Extract information in the format of response',
                            inputSchema: {
                                json: optimizedJsonSchema,
                            },
                        },
                    },
                ];
                toolConfig = {
                    tools,
                    toolChoice: { tool: { name: 'response' } },
                };
            }
            catch (e) {
                console.warn('Failed to convert output_format to JSON schema for AWS Bedrock', e);
            }
        }
        const requestPayload = {
            modelId: this.model,
            messages: bedrockMessages,
        };
        if (systemMessage) {
            requestPayload.system = systemMessage;
        }
        const inferenceConfig = this.getInferenceConfig();
        if (Object.keys(inferenceConfig).length) {
            requestPayload.inferenceConfig = inferenceConfig;
        }
        if (toolConfig) {
            requestPayload.toolConfig = toolConfig;
        }
        try {
            const response = await this.client.send(new ConverseCommand(requestPayload), options.signal ? { abortSignal: options.signal } : undefined);
            let completion = this.getTextCompletion(response);
            if (output_format) {
                const contentBlocks = response?.output?.message?.content;
                const toolUseBlock = Array.isArray(contentBlocks)
                    ? contentBlocks.find((block) => block?.toolUse)
                    : undefined;
                if (toolUseBlock?.toolUse) {
                    const input = toolUseBlock.toolUse.input;
                    if (typeof input === 'string') {
                        completion = this.parseOutput(output_format, JSON.parse(input));
                    }
                    else {
                        completion = this.parseOutput(output_format, input);
                    }
                }
                else if (toolConfig) {
                    throw new ModelProviderError('Expected tool use in response but none found', 502, this.model);
                }
                else {
                    completion = this.parseOutput(output_format, completion);
                }
            }
            else {
                completion = this.getTextCompletion(response);
            }
            const stopReason = response?.stopReason ?? null;
            return new ChatInvokeCompletion(completion, this.getUsage(response), null, null, stopReason);
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
}
