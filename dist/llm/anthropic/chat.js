import Anthropic, { APIConnectionError, APIError, RateLimitError, } from '@anthropic-ai/sdk';
import { ChatInvokeCompletion } from '../views.js';
import { AnthropicMessageSerializer } from './serializer.js';
import { ModelProviderError, ModelRateLimitError } from '../exceptions.js';
import { SchemaOptimizer, zodSchemaToJsonSchema } from '../schema.js';
export class ChatAnthropic {
    model;
    provider = 'anthropic';
    client;
    maxTokens;
    temperature;
    topP;
    seed;
    removeMinItemsFromSchema;
    removeDefaultsFromSchema;
    constructor(options = {}) {
        const normalizedOptions = typeof options === 'string' ? { model: options } : options;
        const { model = 'claude-sonnet-4-20250514', apiKey = process.env.ANTHROPIC_API_KEY, authToken = process.env.ANTHROPIC_AUTH_TOKEN, baseURL, timeout, maxTokens = 8192, temperature = null, topP = null, seed = null, maxRetries = 10, defaultHeaders, defaultQuery, fetchImplementation, fetchOptions, removeMinItemsFromSchema = false, removeDefaultsFromSchema = false, } = normalizedOptions;
        this.model = model;
        this.maxTokens = maxTokens;
        this.temperature = temperature;
        this.topP = topP;
        this.seed = seed;
        this.removeMinItemsFromSchema = removeMinItemsFromSchema;
        this.removeDefaultsFromSchema = removeDefaultsFromSchema;
        this.client = new Anthropic({
            apiKey,
            authToken,
            baseURL,
            timeout,
            maxRetries,
            defaultHeaders,
            defaultQuery,
            ...(fetchImplementation ? { fetch: fetchImplementation } : {}),
            ...(fetchOptions ? { fetchOptions } : {}),
        });
    }
    get name() {
        return this.model;
    }
    get model_name() {
        return this.model;
    }
    getModelParams() {
        const modelParams = {};
        if (this.temperature !== null) {
            modelParams.temperature = this.temperature;
        }
        if (this.topP !== null) {
            modelParams.top_p = this.topP;
        }
        if (this.seed !== null) {
            modelParams.seed = this.seed;
        }
        return modelParams;
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
        const textBlock = response.content.find((block) => block.type === 'text');
        if (textBlock && textBlock.type === 'text') {
            return textBlock.text;
        }
        const firstBlock = response.content[0];
        return firstBlock ? String(firstBlock) : '';
    }
    getUsage(response) {
        const cacheReadTokens = response.usage.cache_read_input_tokens ?? 0;
        const cacheCreationTokens = response.usage.cache_creation_input_tokens ?? 0;
        return {
            prompt_tokens: response.usage.input_tokens + cacheReadTokens,
            completion_tokens: response.usage.output_tokens,
            total_tokens: response.usage.input_tokens + response.usage.output_tokens,
            prompt_cached_tokens: cacheReadTokens || null,
            prompt_cache_creation_tokens: cacheCreationTokens || null,
            prompt_image_tokens: null,
        };
    }
    async ainvoke(messages, output_format, options = {}) {
        const serializer = new AnthropicMessageSerializer();
        const [anthropicMessages, systemPrompt] = serializer.serializeMessages(messages);
        const zodSchemaCandidate = this.getZodSchemaCandidate(output_format);
        let tools = undefined;
        let toolChoice = undefined;
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
                const toolName = output_format?.name || 'response';
                tools = [
                    {
                        name: toolName,
                        description: `Extract information in the format of ${toolName}`,
                        input_schema: optimizedJsonSchema,
                        cache_control: { type: 'ephemeral' },
                    },
                ];
                toolChoice = { type: 'tool', name: toolName };
            }
            catch (e) {
                console.warn('Failed to convert output_format to JSON schema for Anthropic', e);
            }
        }
        const requestPayload = {
            model: this.model,
            max_tokens: this.maxTokens,
            messages: anthropicMessages,
            ...this.getModelParams(),
        };
        if (systemPrompt !== undefined) {
            requestPayload.system = systemPrompt;
        }
        if (tools?.length) {
            requestPayload.tools = tools;
            requestPayload.tool_choice = toolChoice;
        }
        try {
            const response = await this.client.messages.create(requestPayload, options.signal ? { signal: options.signal } : undefined);
            let completion = this.getTextCompletion(response);
            if (output_format) {
                const toolUseBlock = response.content.find((block) => block.type === 'tool_use');
                if (toolUseBlock && toolUseBlock.type === 'tool_use') {
                    try {
                        completion = this.parseOutput(output_format, toolUseBlock.input);
                    }
                    catch (error) {
                        if (typeof toolUseBlock.input === 'string') {
                            completion = this.parseOutput(output_format, JSON.parse(toolUseBlock.input));
                        }
                        else {
                            throw error;
                        }
                    }
                }
                else if (tools?.length) {
                    throw new ModelProviderError('Expected tool use in response but none found', 502, this.model);
                }
                else {
                    completion = this.parseOutput(output_format, completion);
                }
            }
            else {
                completion = this.getTextCompletion(response);
            }
            const usage = this.getUsage(response);
            const stopReason = response.stop_reason ?? null;
            return new ChatInvokeCompletion(completion, usage, null, null, stopReason);
        }
        catch (error) {
            if (error instanceof RateLimitError || error?.status === 429) {
                throw new ModelRateLimitError(error?.message ?? 'Rate limit exceeded', 429, this.model);
            }
            if (error instanceof APIConnectionError) {
                throw new ModelProviderError(error?.message ?? 'Connection error', 502, this.model);
            }
            if (error instanceof APIError) {
                throw new ModelProviderError(error?.message ?? 'Anthropic API error', error?.status ?? 502, this.model);
            }
            throw new ModelProviderError(error?.message ?? String(error), error?.status ?? 502, this.model);
        }
    }
}
