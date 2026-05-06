import OpenAI from 'openai';
import { ModelProviderError, ModelRateLimitError } from '../exceptions.js';
import { ChatInvokeCompletion } from '../views.js';
import { zodSchemaToJsonSchema } from '../schema.js';
import { OpenAIMessageSerializer } from '../openai/serializer.js';
import { MistralSchemaOptimizer } from './schema.js';
export class ChatMistral {
    model;
    provider = 'mistral';
    client;
    temperature;
    maxTokens;
    topP;
    seed;
    safePrompt;
    removeMinItemsFromSchema;
    removeDefaultsFromSchema;
    constructor(options = {}) {
        const normalizedOptions = typeof options === 'string' ? { model: options } : options;
        const { model = 'mistral-medium-latest', apiKey = process.env.MISTRAL_API_KEY, baseURL = process.env.MISTRAL_BASE_URL || 'https://api.mistral.ai/v1', timeout = null, defaultHeaders = null, defaultQuery = null, fetchImplementation, fetchOptions = null, clientParams = null, temperature = 0.2, maxTokens = 4096, topP = null, seed = null, safePrompt = false, maxRetries = 5, removeMinItemsFromSchema = false, removeDefaultsFromSchema = false, } = normalizedOptions;
        this.model = model;
        this.temperature = temperature;
        this.maxTokens = maxTokens;
        this.topP = topP;
        this.seed = seed;
        this.safePrompt = safePrompt;
        this.removeMinItemsFromSchema = removeMinItemsFromSchema;
        this.removeDefaultsFromSchema = removeDefaultsFromSchema;
        this.client = new OpenAI({
            apiKey,
            baseURL,
            ...(timeout !== null ? { timeout } : {}),
            maxRetries,
            defaultHeaders: defaultHeaders ?? undefined,
            defaultQuery: defaultQuery ?? undefined,
            fetch: fetchImplementation,
            fetchOptions: (fetchOptions ?? undefined),
            ...(clientParams ?? {}),
        });
    }
    get name() {
        return this.model;
    }
    get model_name() {
        return this.model;
    }
    getUsage(response) {
        if (!response.usage) {
            return null;
        }
        return {
            prompt_tokens: response.usage.prompt_tokens,
            prompt_cached_tokens: response.usage.prompt_tokens_details?.cached_tokens ?? null,
            prompt_cache_creation_tokens: null,
            prompt_image_tokens: null,
            completion_tokens: response.usage.completion_tokens,
            total_tokens: response.usage.total_tokens,
        };
    }
    getSchemaCandidate(output_format) {
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
    async ainvoke(messages, output_format, options = {}) {
        const serializer = new OpenAIMessageSerializer();
        const mistralMessages = serializer.serialize(messages);
        const modelParams = {};
        if (this.temperature !== null) {
            modelParams.temperature = this.temperature;
        }
        if (this.maxTokens !== null) {
            modelParams.max_tokens = this.maxTokens;
        }
        if (this.topP !== null) {
            modelParams.top_p = this.topP;
        }
        if (this.seed !== null) {
            modelParams.seed = this.seed;
        }
        if (this.safePrompt) {
            modelParams.safe_prompt = true;
        }
        const zodSchemaCandidate = this.getSchemaCandidate(output_format);
        let responseFormat = undefined;
        if (zodSchemaCandidate) {
            try {
                const rawJsonSchema = zodSchemaToJsonSchema(zodSchemaCandidate, {
                    name: 'agent_output',
                    target: 'jsonSchema7',
                });
                const optimizedJsonSchema = MistralSchemaOptimizer.createMistralCompatibleSchema(rawJsonSchema, {
                    removeMinItems: this.removeMinItemsFromSchema,
                    removeDefaults: this.removeDefaultsFromSchema,
                });
                responseFormat = {
                    type: 'json_schema',
                    json_schema: {
                        name: 'agent_output',
                        schema: optimizedJsonSchema,
                        strict: true,
                    },
                };
            }
            catch {
                responseFormat = undefined;
            }
        }
        try {
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: mistralMessages,
                response_format: responseFormat,
                ...modelParams,
            }, options.signal ? { signal: options.signal } : undefined);
            const content = response.choices[0].message.content || '';
            const usage = this.getUsage(response);
            const stopReason = response.choices[0].finish_reason ?? null;
            let completion = content;
            if (output_format) {
                const parsedJson = JSON.parse(content);
                const output = output_format;
                if (output &&
                    typeof output === 'object' &&
                    output.schema &&
                    typeof output.schema.parse === 'function') {
                    completion = output.schema.parse(parsedJson);
                }
                else {
                    completion = output.parse(parsedJson);
                }
            }
            return new ChatInvokeCompletion(completion, usage, null, null, stopReason);
        }
        catch (error) {
            if (error?.status === 429) {
                throw new ModelRateLimitError(error?.message ?? 'Rate limit exceeded', 429, this.model);
            }
            throw new ModelProviderError(error?.message ?? String(error), error?.status ?? 500, this.model);
        }
    }
}
