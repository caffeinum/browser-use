import { ConfigFileAuthenticationDetailsProvider, InstancePrincipalsAuthenticationDetailsProviderBuilder, ResourcePrincipalAuthenticationDetailsProvider, SimpleAuthenticationDetailsProvider, } from 'oci-common';
import { GenerativeAiInferenceClient } from 'oci-generativeaiinference';
import { ModelProviderError, ModelRateLimitError } from '../exceptions.js';
import { SchemaOptimizer, zodSchemaToJsonSchema } from '../schema.js';
import { ChatInvokeCompletion } from '../views.js';
import { OCIRawMessageSerializer } from './serializer.js';
const parseStructuredJson = (text) => {
    let jsonText = String(text ?? '').trim();
    if (jsonText.startsWith('```json') && jsonText.endsWith('```')) {
        jsonText = jsonText.slice(7, -3).trim();
    }
    else if (jsonText.startsWith('```') && jsonText.endsWith('```')) {
        jsonText = jsonText.slice(3, -3).trim();
    }
    return JSON.parse(jsonText);
};
const extractZodSchema = (outputFormat) => {
    const direct = outputFormat;
    if (direct &&
        typeof direct === 'object' &&
        typeof direct.safeParse === 'function' &&
        typeof direct.parse === 'function') {
        return direct;
    }
    const nested = outputFormat?.schema;
    if (nested &&
        typeof nested === 'object' &&
        typeof nested.safeParse === 'function' &&
        typeof nested.parse === 'function') {
        return nested;
    }
    return null;
};
const parseOutput = (outputFormat, payload) => {
    const maybeWrapped = outputFormat;
    if (maybeWrapped &&
        typeof maybeWrapped === 'object' &&
        maybeWrapped.schema &&
        typeof maybeWrapped.schema.parse === 'function') {
        return maybeWrapped.schema.parse(payload);
    }
    return outputFormat.parse(payload);
};
const appendJsonInstruction = (messages, schema) => {
    const instruction = '\n\nIMPORTANT: You must respond with ONLY a valid JSON object ' +
        '(no markdown, no code blocks, no explanations)' +
        (schema
            ? ` that exactly matches this schema:\n${JSON.stringify(schema, null, 2)}`
            : '.');
    const target = [...messages]
        .reverse()
        .find((message) => message.role === 'USER' || message.role === 'SYSTEM') ?? null;
    if (target) {
        const content = Array.isArray(target.content)
            ? [...target.content]
            : [];
        content.push({
            type: 'TEXT',
            text: instruction,
        });
        target.content = content;
        return messages;
    }
    return [
        {
            role: 'SYSTEM',
            content: [
                {
                    type: 'TEXT',
                    text: instruction,
                },
            ],
        },
        ...messages,
    ];
};
export class ChatOCIRaw {
    model;
    provider = 'oci-raw';
    serviceEndpoint;
    compartmentId;
    ociProvider;
    temperature;
    maxTokens;
    frequencyPenalty;
    presencePenalty;
    topP;
    topK;
    authType;
    authProfile;
    configFilePath;
    tenancyId;
    userId;
    fingerprint;
    privateKey;
    passphrase;
    responseSchemaName;
    clientPromise = null;
    constructor(options = {}) {
        this.model =
            options.model ??
                options.modelId ??
                process.env.OCI_MODEL_ID ??
                (() => {
                    throw new Error('ChatOCIRaw requires model or OCI_MODEL_ID');
                })();
        this.serviceEndpoint =
            options.serviceEndpoint ??
                process.env.OCI_SERVICE_ENDPOINT ??
                (() => {
                    throw new Error('ChatOCIRaw requires serviceEndpoint or OCI_SERVICE_ENDPOINT');
                })();
        this.compartmentId =
            options.compartmentId ??
                process.env.OCI_COMPARTMENT_ID ??
                (() => {
                    throw new Error('ChatOCIRaw requires compartmentId or OCI_COMPARTMENT_ID');
                })();
        this.ociProvider = options.provider ?? process.env.OCI_PROVIDER ?? 'meta';
        this.temperature = options.temperature ?? 1.0;
        this.maxTokens = options.maxTokens ?? 600;
        this.frequencyPenalty = options.frequencyPenalty ?? 0.0;
        this.presencePenalty = options.presencePenalty ?? 0.0;
        this.topP = options.topP ?? 0.75;
        this.topK = options.topK ?? 0;
        this.authType = options.authType ?? process.env.OCI_AUTH_TYPE ?? 'API_KEY';
        this.authProfile =
            options.authProfile ??
                process.env.OCI_AUTH_PROFILE ??
                process.env.OCI_CONFIG_PROFILE ??
                'DEFAULT';
        this.configFilePath = options.configFilePath ?? process.env.OCI_CONFIG_FILE;
        this.tenancyId = options.tenancyId ?? process.env.OCI_TENANCY_ID;
        this.userId = options.userId ?? process.env.OCI_USER_ID;
        this.fingerprint = options.fingerprint ?? process.env.OCI_FINGERPRINT;
        this.privateKey = options.privateKey ?? process.env.OCI_PRIVATE_KEY;
        this.passphrase =
            options.passphrase ?? process.env.OCI_PRIVATE_KEY_PASSPHRASE ?? null;
        this.responseSchemaName =
            options.responseSchemaName ?? 'browser_use_response';
    }
    get name() {
        if (this.model.length <= 90) {
            return this.model;
        }
        const parts = this.model.split('.');
        if (parts.length >= 4) {
            return `oci-${this.ociProvider}-${parts[3]}`;
        }
        return `oci-${this.ociProvider}-model`;
    }
    get model_name() {
        return this.name;
    }
    usesCohereFormat() {
        return this.ociProvider.toLowerCase() === 'cohere';
    }
    async createAuthProvider() {
        const authType = this.authType.toUpperCase();
        if (authType === 'INSTANCE_PRINCIPAL') {
            return new InstancePrincipalsAuthenticationDetailsProviderBuilder().build();
        }
        if (authType === 'RESOURCE_PRINCIPAL') {
            return ResourcePrincipalAuthenticationDetailsProvider.builder();
        }
        if (this.tenancyId && this.userId && this.fingerprint && this.privateKey) {
            return new SimpleAuthenticationDetailsProvider(this.tenancyId, this.userId, this.fingerprint, this.privateKey, this.passphrase);
        }
        return new ConfigFileAuthenticationDetailsProvider(this.configFilePath, this.authProfile);
    }
    async getClient() {
        if (!this.clientPromise) {
            this.clientPromise = (async () => {
                const authenticationDetailsProvider = await this.createAuthProvider();
                const client = new GenerativeAiInferenceClient({
                    authenticationDetailsProvider,
                });
                client.endpoint = this.serviceEndpoint;
                return client;
            })();
        }
        return this.clientPromise;
    }
    getUsage(payload) {
        const usage = payload?.usage;
        if (!usage) {
            return null;
        }
        const reasoningTokens = usage.completionTokensDetails?.reasoningTokens ?? 0;
        const completionTokens = (usage.completionTokens ?? 0) + reasoningTokens;
        return {
            prompt_tokens: usage.promptTokens ?? 0,
            prompt_cached_tokens: usage.promptTokensDetails?.cachedTokens ?? null,
            prompt_cache_creation_tokens: null,
            prompt_image_tokens: null,
            completion_tokens: completionTokens,
            total_tokens: usage.totalTokens ?? (usage.promptTokens ?? 0) + completionTokens,
        };
    }
    buildGenericRequest(messages, outputFormat) {
        const zodSchema = extractZodSchema(outputFormat);
        const serializedMessages = OCIRawMessageSerializer.serializeMessages(messages);
        const optimizedSchema = zodSchema
            ? SchemaOptimizer.createOptimizedJsonSchema(zodSchemaToJsonSchema(zodSchema))
            : null;
        const requestMessages = outputFormat && !zodSchema
            ? appendJsonInstruction(serializedMessages, null)
            : serializedMessages;
        const request = {
            apiFormat: 'GENERIC',
            messages: requestMessages,
        };
        if (this.temperature !== null) {
            request.temperature = this.temperature;
        }
        if (this.maxTokens !== null) {
            request.maxTokens = this.maxTokens;
        }
        if (this.frequencyPenalty !== null) {
            request.frequencyPenalty = this.frequencyPenalty;
        }
        if (this.presencePenalty !== null) {
            request.presencePenalty = this.presencePenalty;
        }
        if (this.topP !== null) {
            request.topP = this.topP;
        }
        if (this.topK !== null) {
            request.topK = this.topK;
        }
        if (optimizedSchema) {
            request.responseFormat = {
                type: 'JSON_SCHEMA',
                jsonSchema: {
                    name: this.responseSchemaName,
                    schema: optimizedSchema,
                    isStrict: true,
                },
            };
        }
        return request;
    }
    buildCohereRequest(messages, outputFormat) {
        const zodSchema = extractZodSchema(outputFormat);
        const optimizedSchema = zodSchema
            ? SchemaOptimizer.createOptimizedJsonSchema(zodSchemaToJsonSchema(zodSchema))
            : null;
        let conversation = OCIRawMessageSerializer.serializeMessagesForCohere(messages);
        if (outputFormat) {
            conversation +=
                '\n\nIMPORTANT: You must respond with ONLY a valid JSON object (no markdown, no code blocks, no explanations)' +
                    (optimizedSchema
                        ? ` that exactly matches this schema:\n${JSON.stringify(optimizedSchema, null, 2)}`
                        : '.');
        }
        const request = {
            apiFormat: 'COHERE',
            message: conversation,
        };
        if (this.temperature !== null) {
            request.temperature = this.temperature;
        }
        if (this.maxTokens !== null) {
            request.maxTokens = this.maxTokens;
        }
        if (this.frequencyPenalty !== null) {
            request.frequencyPenalty = this.frequencyPenalty;
        }
        if (this.presencePenalty !== null) {
            request.presencePenalty = this.presencePenalty;
        }
        if (this.topP !== null) {
            request.topP = this.topP;
        }
        if (this.topK !== null) {
            request.topK = this.topK;
        }
        return request;
    }
    buildChatRequest(messages, outputFormat) {
        const chatRequest = this.usesCohereFormat()
            ? this.buildCohereRequest(messages, outputFormat)
            : this.buildGenericRequest(messages, outputFormat);
        return {
            chatDetails: {
                compartmentId: this.compartmentId,
                servingMode: {
                    servingType: 'ON_DEMAND',
                    modelId: this.model,
                },
                chatRequest,
            },
        };
    }
    extractText(payload) {
        if (!payload) {
            throw new ModelProviderError('OCI response did not include chatResponse payload', 502, this.name);
        }
        if (payload.apiFormat === 'COHERE') {
            const coherePayload = payload;
            return {
                text: coherePayload.text ?? '',
                thinking: null,
                stopReason: coherePayload.finishReason ?? null,
            };
        }
        const genericPayload = payload;
        const choice = genericPayload.choices?.[0];
        const text = choice?.message?.content
            ?.filter((part) => part.type === 'TEXT')
            .map((part) => part.text ?? '')
            .join('\n')
            .trim();
        return {
            text: text ?? '',
            thinking: choice?.message?.reasoningContent ?? null,
            stopReason: choice?.finishReason ?? null,
        };
    }
    mapError(error) {
        const statusCode = typeof error?.statusCode === 'number'
            ? error.statusCode
            : 502;
        const message = String(error?.message ?? error ?? 'OCI request failed');
        if (statusCode === 429) {
            throw new ModelRateLimitError(message, statusCode, this.name);
        }
        throw new ModelProviderError(message, statusCode, this.name);
    }
    async ainvoke(messages, outputFormat, _options = {}) {
        try {
            const client = await this.getClient();
            const response = (await client.chat(this.buildChatRequest(messages, outputFormat)));
            if (!response || typeof response !== 'object') {
                throw new ModelProviderError('OCI chat request returned an empty response', 502, this.name);
            }
            const payload = response.chatResult?.chatResponse;
            const usage = this.getUsage(payload);
            const { text, thinking, stopReason } = this.extractText(payload);
            if (!outputFormat) {
                return new ChatInvokeCompletion(text, usage, thinking, null, stopReason);
            }
            const parsed = parseOutput(outputFormat, parseStructuredJson(text));
            return new ChatInvokeCompletion(parsed, usage, thinking, null, stopReason);
        }
        catch (error) {
            this.mapError(error);
        }
    }
}
