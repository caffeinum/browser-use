import { GoogleGenAI } from '@google/genai';
import { ModelProviderError } from '../exceptions.js';
import { ChatInvokeCompletion } from '../views.js';
import { SchemaOptimizer, zodSchemaToJsonSchema } from '../schema.js';
import { GoogleMessageSerializer } from './serializer.js';
export class ChatGoogle {
    model;
    provider = 'google';
    client;
    temperature;
    topP;
    seed;
    thinkingBudget;
    thinkingLevel;
    maxOutputTokens;
    config;
    includeSystemInUser;
    supportsStructuredOutput;
    maxRetries;
    retryableStatusCodes;
    retryBaseDelay;
    retryMaxDelay;
    constructor(options = {}) {
        const normalizedOptions = typeof options === 'string' ? { model: options } : options;
        const { model = 'gemini-2.5-flash', apiKey = process.env.GOOGLE_API_KEY, apiVersion = process.env.GOOGLE_API_VERSION, baseUrl = process.env.GOOGLE_API_BASE_URL, vertexai, vertexAi, project, location, httpOptions, googleAuthOptions, credentials, temperature = 0.5, topP = null, seed = null, thinkingBudget = null, thinkingLevel = null, maxOutputTokens = 8096, config = null, includeSystemInUser = false, supportsStructuredOutput = true, maxRetries = 5, retryableStatusCodes = [429, 500, 502, 503, 504], retryBaseDelay = 1.0, retryMaxDelay = 60.0, } = normalizedOptions;
        this.model = model;
        this.temperature = temperature;
        this.topP = topP;
        this.seed = seed;
        this.thinkingBudget = thinkingBudget;
        this.thinkingLevel = thinkingLevel;
        this.maxOutputTokens = maxOutputTokens;
        this.config = config ? { ...config } : null;
        this.includeSystemInUser = includeSystemInUser;
        this.supportsStructuredOutput = supportsStructuredOutput;
        this.maxRetries = Math.max(1, maxRetries);
        this.retryableStatusCodes = [...retryableStatusCodes];
        this.retryBaseDelay = retryBaseDelay;
        this.retryMaxDelay = retryMaxDelay;
        const resolvedGoogleAuthOptions = credentials == null
            ? googleAuthOptions
            : {
                ...(googleAuthOptions ?? {}),
                credentials,
            };
        const resolvedVertexAi = vertexai ?? vertexAi;
        const clientOptions = {
            ...(apiKey != null ? { apiKey } : {}),
            ...(baseUrl ? { baseUrl } : {}),
            ...(apiVersion ? { apiVersion } : {}),
            ...(resolvedVertexAi != null ? { vertexai: resolvedVertexAi } : {}),
            ...(project ? { project } : {}),
            ...(location ? { location } : {}),
            ...(httpOptions ? { httpOptions } : {}),
            ...(resolvedGoogleAuthOptions
                ? { googleAuthOptions: resolvedGoogleAuthOptions }
                : {}),
        };
        this.client = new GoogleGenAI(clientOptions);
    }
    get name() {
        return this.model;
    }
    get model_name() {
        return this.model;
    }
    getUsage(result) {
        const usage = result?.usageMetadata;
        if (!usage) {
            return null;
        }
        let imageTokens = 0;
        const promptTokenDetails = Array.isArray(usage.promptTokensDetails)
            ? usage.promptTokensDetails
            : [];
        for (const detail of promptTokenDetails) {
            if (String(detail?.modality ?? '').toUpperCase() === 'IMAGE') {
                imageTokens += Number(detail?.tokenCount ?? 0) || 0;
            }
        }
        const completionTokens = (Number(usage.candidatesTokenCount ?? 0) || 0) +
            (Number(usage.thoughtsTokenCount ?? 0) || 0);
        return {
            prompt_tokens: Number(usage.promptTokenCount ?? 0) || 0,
            prompt_cached_tokens: usage.cachedContentTokenCount == null
                ? null
                : Number(usage.cachedContentTokenCount),
            prompt_cache_creation_tokens: null,
            prompt_image_tokens: imageTokens,
            completion_tokens: completionTokens,
            total_tokens: Number(usage.totalTokenCount ?? 0) || 0,
        };
    }
    /**
     * Clean up JSON schema for Google's format
     * Google API has specific requirements for responseSchema
     */
    _cleanSchemaForGoogle(schema) {
        if (!schema || typeof schema !== 'object') {
            return schema;
        }
        const cleaned = {};
        for (const [key, value] of Object.entries(schema)) {
            // Skip unsupported keys
            if (key === '$schema' ||
                key === 'additionalProperties' ||
                key === '$ref' ||
                key === 'definitions') {
                continue;
            }
            if (key === 'properties' && typeof value === 'object') {
                cleaned.properties = {};
                for (const [propKey, propValue] of Object.entries(value)) {
                    // Align python: hide programmatic extraction schema field from LLM JSON schema.
                    if (propKey === 'output_schema') {
                        continue;
                    }
                    cleaned.properties[propKey] = this._cleanSchemaForGoogle(propValue);
                }
            }
            else if (key === 'items' && typeof value === 'object') {
                cleaned.items = this._cleanSchemaForGoogle(value);
            }
            else if (typeof value === 'object' && !Array.isArray(value)) {
                cleaned[key] = this._cleanSchemaForGoogle(value);
            }
            else {
                cleaned[key] = value;
            }
        }
        const schemaType = String(cleaned.type ?? '').toUpperCase();
        if (schemaType === 'OBJECT' &&
            cleaned.properties &&
            typeof cleaned.properties === 'object' &&
            !Array.isArray(cleaned.properties) &&
            Object.keys(cleaned.properties).length === 0) {
            cleaned.properties = {
                _placeholder: { type: 'string' },
            };
        }
        if (Array.isArray(cleaned.required) &&
            cleaned.properties &&
            typeof cleaned.properties === 'object' &&
            !Array.isArray(cleaned.properties)) {
            const validKeys = new Set(Object.keys(cleaned.properties));
            cleaned.required = cleaned.required.filter((name) => typeof name === 'string' && validKeys.has(name));
        }
        return cleaned;
    }
    _parseStructuredJson(text) {
        let jsonText = String(text ?? '').trim();
        const fencedMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fencedMatch && fencedMatch[1]) {
            jsonText = fencedMatch[1].trim();
        }
        const firstBrace = jsonText.indexOf('{');
        const lastBrace = jsonText.lastIndexOf('}');
        if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
            throw new Error(`Expected JSON response but got plain text: "${jsonText.slice(0, 50)}..."`);
        }
        return JSON.parse(jsonText.slice(firstBrace, lastBrace + 1));
    }
    _extractStatusCode(error) {
        const directStatus = Number(error?.status ??
            error?.statusCode ??
            error?.response?.status ??
            error?.response?.statusCode);
        if (Number.isFinite(directStatus)) {
            return directStatus;
        }
        const message = String(error?.message ?? error ?? '').toLowerCase();
        if (/(rate limit|resource exhausted|quota exceeded|too many requests|429)/.test(message)) {
            return 429;
        }
        if (/(service unavailable|internal server error|bad gateway|503|502|500)/.test(message)) {
            return 503;
        }
        if (/(forbidden|403)/.test(message)) {
            return 403;
        }
        if (/(timeout|timed out|cancelled|canceled)/.test(message)) {
            return 504;
        }
        return null;
    }
    _toModelProviderError(error) {
        if (error instanceof ModelProviderError) {
            return error;
        }
        return new ModelProviderError(error?.message ?? String(error), this._extractStatusCode(error) ?? 502, this.model);
    }
    async _sleep(ms) {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }
    async ainvoke(messages, output_format, options = {}) {
        const serializer = new GoogleMessageSerializer();
        const { contents, systemInstruction } = serializer.serializeWithSystem(messages, this.includeSystemInUser);
        const generationConfig = this.config ? { ...this.config } : {};
        if (this.temperature !== null) {
            generationConfig.temperature = this.temperature;
        }
        if (this.topP !== null) {
            generationConfig.topP = this.topP;
        }
        if (this.seed !== null) {
            generationConfig.seed = this.seed;
        }
        const isGemini3Pro = this.model.includes('gemini-3-pro');
        const isGemini3Flash = this.model.includes('gemini-3-flash');
        if (isGemini3Pro) {
            let level = this.thinkingLevel ?? 'low';
            if (level === 'minimal' || level === 'medium') {
                level = 'low';
            }
            generationConfig.thinkingConfig = {
                thinkingLevel: level.toUpperCase(),
            };
        }
        else if (isGemini3Flash) {
            if (this.thinkingLevel !== null) {
                generationConfig.thinkingConfig = {
                    thinkingLevel: this.thinkingLevel.toUpperCase(),
                };
            }
            else {
                generationConfig.thinkingConfig = {
                    thinkingBudget: this.thinkingBudget === null ? -1 : this.thinkingBudget,
                };
            }
        }
        else {
            let budget = this.thinkingBudget;
            if (budget === null &&
                (this.model.includes('gemini-2.5') ||
                    this.model.includes('gemini-flash'))) {
                budget = -1;
            }
            if (budget !== null) {
                generationConfig.thinkingConfig = { thinkingBudget: budget };
            }
        }
        if (this.maxOutputTokens !== null) {
            generationConfig.maxOutputTokens = this.maxOutputTokens;
        }
        // Try to get schema from output_format
        const schemaForJson = (() => {
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
        let cleanSchemaForJson = null;
        if (schemaForJson) {
            try {
                const jsonSchema = zodSchemaToJsonSchema(schemaForJson);
                const optimizedSchema = SchemaOptimizer.createGeminiOptimizedSchema(jsonSchema);
                cleanSchemaForJson = this._cleanSchemaForGoogle(optimizedSchema);
            }
            catch {
                cleanSchemaForJson = null;
            }
        }
        if (cleanSchemaForJson && this.supportsStructuredOutput) {
            generationConfig.responseMimeType = 'application/json';
            generationConfig.responseSchema = cleanSchemaForJson;
        }
        const requestContents = contents.map((entry) => ({
            ...entry,
            parts: Array.isArray(entry?.parts)
                ? entry.parts.map((part) => ({ ...part }))
                : entry?.parts,
        }));
        if (output_format && cleanSchemaForJson && !this.supportsStructuredOutput) {
            const jsonInstruction = '\n\nPlease respond with a valid JSON object that matches this schema: ' +
                JSON.stringify(cleanSchemaForJson);
            for (let i = requestContents.length - 1; i >= 0; i -= 1) {
                const content = requestContents[i];
                if (content?.role === 'user' && Array.isArray(content?.parts)) {
                    content.parts = [...content.parts, { text: jsonInstruction }];
                    break;
                }
            }
        }
        const request = {
            model: this.model,
            contents: requestContents,
        };
        if (systemInstruction && !this.includeSystemInUser) {
            request.systemInstruction = {
                role: 'system',
                parts: [{ text: systemInstruction }],
            };
        }
        if (Object.keys(generationConfig).length > 0) {
            request.generationConfig = generationConfig;
        }
        for (let attempt = 0; attempt < this.maxRetries; attempt += 1) {
            try {
                const result = await this.client.models.generateContent(request, options.signal ? { signal: options.signal } : undefined);
                const candidate = result.candidates?.[0];
                const textParts = candidate?.content?.parts?.filter((p) => p.text) || [];
                const text = textParts.map((p) => p.text).join('');
                let completion = text;
                const stopReason = result?.candidates?.[0]?.finishReason ?? null;
                let parsed = text;
                if (output_format && schemaForJson) {
                    parsed = this._parseStructuredJson(text);
                }
                if (output_format) {
                    const output = output_format;
                    if (schemaForJson &&
                        output &&
                        typeof output === 'object' &&
                        output.schema &&
                        typeof output.schema.parse === 'function') {
                        completion = output.schema.parse(parsed);
                    }
                    else {
                        completion = output.parse(parsed);
                    }
                }
                return new ChatInvokeCompletion(completion, this.getUsage(result), null, null, stopReason);
            }
            catch (error) {
                const providerError = this._toModelProviderError(error);
                const shouldRetry = this.retryableStatusCodes.includes(providerError.statusCode) &&
                    attempt < this.maxRetries - 1;
                if (!shouldRetry) {
                    throw providerError;
                }
                const delaySeconds = Math.min(this.retryBaseDelay * 2 ** attempt, this.retryMaxDelay);
                const jitter = Math.random() * delaySeconds * 0.1;
                await this._sleep((delaySeconds + jitter) * 1000);
            }
        }
        throw new ModelProviderError('Retry loop completed without response', 500, this.model);
    }
}
