import OpenAI from 'openai';
import { ModelProviderError, ModelRateLimitError } from '../exceptions.js';
import { SchemaOptimizer, zodSchemaToJsonSchema } from '../schema.js';
import { ChatInvokeCompletion } from '../views.js';
import { CerebrasMessageSerializer, } from './serializer.js';
export class ChatCerebras {
    model;
    provider = 'cerebras';
    client;
    temperature;
    maxTokens;
    topP;
    seed;
    removeMinItemsFromSchema;
    removeDefaultsFromSchema;
    constructor(options = {}) {
        const normalizedOptions = typeof options === 'string' ? { model: options } : options;
        const { model = 'llama3.1-8b', apiKey = process.env.CEREBRAS_API_KEY, baseURL = process.env.CEREBRAS_BASE_URL || 'https://api.cerebras.ai/v1', timeout = null, clientParams = null, temperature = 0.2, maxTokens = 4096, topP = null, seed = null, maxRetries = 5, removeMinItemsFromSchema = false, removeDefaultsFromSchema = false, } = normalizedOptions;
        this.model = model;
        this.temperature = temperature;
        this.maxTokens = maxTokens;
        this.topP = topP;
        this.seed = seed;
        this.removeMinItemsFromSchema = removeMinItemsFromSchema;
        this.removeDefaultsFromSchema = removeDefaultsFromSchema;
        this.client = new OpenAI({
            apiKey,
            baseURL,
            ...(timeout !== null ? { timeout } : {}),
            maxRetries,
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
    extractJsonFromContent(content) {
        const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
        const normalized = (fenced ? fenced[1] : content).trim();
        const firstBrace = normalized.indexOf('{');
        if (firstBrace < 0) {
            return normalized;
        }
        let depth = 0;
        for (let idx = firstBrace; idx < normalized.length; idx += 1) {
            const char = normalized[idx];
            if (char === '{') {
                depth += 1;
            }
            else if (char === '}') {
                depth -= 1;
                if (depth === 0) {
                    return normalized.slice(firstBrace, idx + 1);
                }
            }
        }
        return normalized.slice(firstBrace);
    }
    appendJsonInstruction(serializedMessages, schemaText) {
        const instruction = `\n\nPlease respond with a JSON object that follows this exact schema:\n` +
            `${schemaText}\n\n` +
            `Your response must be valid JSON only, no other text.`;
        if (serializedMessages.length === 0) {
            return [{ role: 'user', content: instruction }];
        }
        const cloned = [...serializedMessages];
        const last = cloned[cloned.length - 1];
        if (last?.role === 'user') {
            if (typeof last.content === 'string') {
                last.content = `${last.content}${instruction}`;
                return cloned;
            }
            if (Array.isArray(last.content)) {
                last.content = [...last.content, { type: 'text', text: instruction }];
                return cloned;
            }
        }
        cloned.push({ role: 'user', content: instruction });
        return cloned;
    }
    async ainvoke(messages, output_format, options = {}) {
        const serializer = new CerebrasMessageSerializer();
        const cerebrasMessages = serializer.serialize(messages);
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
        const zodSchemaCandidate = this.getSchemaCandidate(output_format);
        let requestMessages = cerebrasMessages;
        if (zodSchemaCandidate) {
            const rawSchema = zodSchemaToJsonSchema(zodSchemaCandidate, {
                name: 'agent_output',
                target: 'jsonSchema7',
            });
            const optimizedSchema = SchemaOptimizer.createOptimizedJsonSchema(rawSchema, {
                removeMinItems: this.removeMinItemsFromSchema,
                removeDefaults: this.removeDefaultsFromSchema,
            });
            requestMessages = this.appendJsonInstruction(cerebrasMessages, JSON.stringify(optimizedSchema, null, 2));
        }
        try {
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: requestMessages,
                ...modelParams,
            }, options.signal ? { signal: options.signal } : undefined);
            const content = response.choices[0].message.content || '';
            const usage = this.getUsage(response);
            const stopReason = response.choices[0].finish_reason ?? null;
            let completion = content;
            if (output_format) {
                const jsonSource = zodSchemaCandidate
                    ? this.extractJsonFromContent(content)
                    : content;
                const parsedJson = JSON.parse(jsonSource);
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
