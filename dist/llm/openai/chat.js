import OpenAI from 'openai';
import { ChatInvokeCompletion } from '../views.js';
import { OpenAIMessageSerializer } from './serializer.js';
import { ModelProviderError, ModelRateLimitError } from '../exceptions.js';
import { SchemaOptimizer, zodSchemaToJsonSchema } from '../schema.js';
// Reasoning models that support reasoning_effort parameter
const DEFAULT_REASONING_MODELS = [
    'o4-mini',
    'o3',
    'o3-mini',
    'o1',
    'o1-pro',
    'o3-pro',
    'gpt-5',
    'gpt-5-mini',
    'gpt-5-nano',
];
export class ChatOpenAI {
    model;
    provider = 'openai';
    client;
    temperature;
    frequencyPenalty;
    reasoningEffort;
    serviceTier;
    maxCompletionTokens;
    seed;
    topP;
    addSchemaToSystemPrompt;
    dontForceStructuredOutput;
    removeMinItemsFromSchema;
    removeDefaultsFromSchema;
    reasoningModels;
    constructor(options = {}) {
        const { model = 'gpt-4o', apiKey, organization, project, baseURL, timeout = null, temperature = 0.2, frequencyPenalty = 0.3, reasoningEffort = 'low', serviceTier = null, maxCompletionTokens = 4096, maxRetries = 5, defaultHeaders = null, defaultQuery = null, fetchImplementation, fetchOptions = null, seed = null, topP = null, addSchemaToSystemPrompt = false, dontForceStructuredOutput = false, removeMinItemsFromSchema = false, removeDefaultsFromSchema = false, reasoningModels = DEFAULT_REASONING_MODELS, } = options;
        this.model = model;
        this.temperature = temperature;
        this.frequencyPenalty = frequencyPenalty;
        this.reasoningEffort = reasoningEffort;
        this.serviceTier = serviceTier;
        this.maxCompletionTokens = maxCompletionTokens;
        this.seed = seed;
        this.topP = topP;
        this.addSchemaToSystemPrompt = addSchemaToSystemPrompt;
        this.dontForceStructuredOutput = dontForceStructuredOutput;
        this.removeMinItemsFromSchema = removeMinItemsFromSchema;
        this.removeDefaultsFromSchema = removeDefaultsFromSchema;
        this.reasoningModels = reasoningModels
            ? [...reasoningModels]
            : reasoningModels;
        this.client = new OpenAI({
            apiKey,
            organization,
            project,
            baseURL,
            timeout: timeout ?? undefined,
            maxRetries,
            defaultHeaders: defaultHeaders ?? undefined,
            defaultQuery: defaultQuery ?? undefined,
            fetch: fetchImplementation,
            fetchOptions: (fetchOptions ?? undefined),
        });
    }
    get name() {
        return this.model;
    }
    get model_name() {
        return this.model;
    }
    isReasoningModel() {
        return (this.reasoningModels ?? []).some((m) => this.model.toLowerCase().includes(m.toLowerCase()));
    }
    getUsage(response) {
        if (!response.usage)
            return null;
        let completionTokens = response.usage.completion_tokens;
        const details = response.usage.completion_tokens_details;
        if (details?.reasoning_tokens) {
            completionTokens += details.reasoning_tokens;
        }
        return {
            prompt_tokens: response.usage.prompt_tokens,
            prompt_cached_tokens: response.usage.prompt_tokens_details?.cached_tokens ?? null,
            prompt_cache_creation_tokens: null,
            prompt_image_tokens: null,
            completion_tokens: completionTokens,
            total_tokens: response.usage.total_tokens,
        };
    }
    async ainvoke(messages, output_format, options = {}) {
        const serializer = new OpenAIMessageSerializer();
        const openaiMessages = serializer.serialize(messages);
        // Build model parameters
        const modelParams = {};
        if (!this.isReasoningModel()) {
            // Regular models support temperature and frequency_penalty
            if (this.temperature !== null) {
                modelParams.temperature = this.temperature;
            }
            if (this.frequencyPenalty !== null) {
                modelParams.frequency_penalty = this.frequencyPenalty;
            }
        }
        else {
            // Reasoning models use reasoning_effort instead
            modelParams.reasoning_effort = this.reasoningEffort;
        }
        if (this.maxCompletionTokens !== null) {
            modelParams.max_completion_tokens = this.maxCompletionTokens;
        }
        if (this.seed !== null) {
            modelParams.seed = this.seed;
        }
        if (this.topP !== null) {
            modelParams.top_p = this.topP;
        }
        if (this.serviceTier !== null) {
            modelParams.service_tier = this.serviceTier;
        }
        const zodSchemaCandidate = (() => {
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
        })();
        let responseFormat = undefined;
        if (zodSchemaCandidate) {
            try {
                const rawJsonSchema = zodSchemaToJsonSchema(zodSchemaCandidate, {
                    name: 'agent_output',
                    target: 'jsonSchema7',
                });
                const optimizedJsonSchema = SchemaOptimizer.createOptimizedJsonSchema(rawJsonSchema, {
                    removeMinItems: this.removeMinItemsFromSchema,
                    removeDefaults: this.removeDefaultsFromSchema,
                });
                const responseJsonSchema = {
                    name: 'agent_output',
                    schema: optimizedJsonSchema,
                    strict: true,
                };
                if (this.addSchemaToSystemPrompt && openaiMessages.length > 0) {
                    const firstMessage = openaiMessages[0];
                    const schemaText = `\n<json_schema>\n` +
                        `${JSON.stringify(responseJsonSchema, null, 2)}\n` +
                        `</json_schema>`;
                    if (firstMessage?.role === 'system') {
                        if (typeof firstMessage.content === 'string') {
                            firstMessage.content =
                                (firstMessage.content ?? '') + schemaText;
                        }
                        else if (Array.isArray(firstMessage.content)) {
                            firstMessage.content = [
                                ...firstMessage.content,
                                { type: 'text', text: schemaText },
                            ];
                        }
                    }
                }
                if (!this.dontForceStructuredOutput) {
                    responseFormat = {
                        type: 'json_schema',
                        json_schema: responseJsonSchema,
                    };
                }
            }
            catch {
                responseFormat = undefined;
            }
        }
        try {
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: openaiMessages,
                response_format: responseFormat,
                ...modelParams,
            }, options.signal ? { signal: options.signal } : undefined);
            const content = response.choices[0].message.content || '';
            const usage = this.getUsage(response);
            const stopReason = response.choices[0].finish_reason ?? null;
            let completion = content;
            if (output_format) {
                if (zodSchemaCandidate) {
                    const parsedJson = JSON.parse(content);
                    const output = output_format;
                    if (output &&
                        typeof output === 'object' &&
                        output.schema &&
                        typeof output.schema.parse === 'function') {
                        completion = output.schema.parse(parsedJson);
                    }
                    else {
                        completion = output_format.parse(parsedJson);
                    }
                }
                else {
                    completion = output_format.parse(content);
                }
            }
            return new ChatInvokeCompletion(completion, usage, null, null, stopReason);
        }
        catch (error) {
            // Handle OpenAI-specific errors
            if (error?.status === 429) {
                throw new ModelRateLimitError(error?.message ?? 'Rate limit exceeded', 429, this.model);
            }
            if (error?.status >= 500) {
                throw new ModelProviderError(error?.message ?? 'Server error', error.status, this.model);
            }
            throw new ModelProviderError(error?.message ?? String(error), error?.status ?? 500, this.model);
        }
    }
}
