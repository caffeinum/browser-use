import { Ollama, } from 'ollama';
import { ModelProviderError } from '../exceptions.js';
import { ChatInvokeCompletion } from '../views.js';
import { zodSchemaToJsonSchema } from '../schema.js';
import { OllamaMessageSerializer } from './serializer.js';
export class ChatOllama {
    model;
    provider = 'ollama';
    client;
    ollamaOptions;
    constructor(modelOrOptions = 'qwen2.5:latest', host = 'http://localhost:11434') {
        const normalizedOptions = typeof modelOrOptions === 'string'
            ? { model: modelOrOptions, host }
            : modelOrOptions;
        const { model = 'qwen2.5:latest', host: ollamaHost = 'http://localhost:11434', timeout = null, clientParams = null, ollamaOptions = null, } = normalizedOptions;
        this.model = model;
        this.ollamaOptions = ollamaOptions;
        const baseFetch = clientParams?.fetch;
        let fetchWithTimeout = baseFetch;
        if (timeout !== null && timeout !== undefined) {
            const timeoutMs = Number(timeout);
            if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
                fetchWithTimeout = this.createTimeoutFetch(baseFetch, timeoutMs);
            }
        }
        this.client = new Ollama({
            host: ollamaHost,
            ...(clientParams ?? {}),
            ...(fetchWithTimeout ? { fetch: fetchWithTimeout } : {}),
        });
    }
    get name() {
        return this.model;
    }
    get model_name() {
        return this.model;
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
    createTimeoutFetch(baseFetch, timeoutMs) {
        return async (input, init) => {
            const fetchImpl = baseFetch ?? fetch;
            const timeoutController = new AbortController();
            const timeoutHandle = setTimeout(() => timeoutController.abort(), timeoutMs);
            const externalSignal = init?.signal;
            const onAbort = () => timeoutController.abort();
            try {
                if (externalSignal) {
                    if (externalSignal.aborted) {
                        timeoutController.abort();
                    }
                    else {
                        externalSignal.addEventListener('abort', onAbort, { once: true });
                    }
                }
                return await fetchImpl(input, {
                    ...init,
                    signal: timeoutController.signal,
                });
            }
            finally {
                clearTimeout(timeoutHandle);
                externalSignal?.removeEventListener('abort', onAbort);
            }
        };
    }
    async ainvoke(messages, output_format, options = {}) {
        const serializer = new OllamaMessageSerializer();
        const ollamaMessages = serializer.serialize(messages);
        const zodSchemaCandidate = this.getZodSchemaCandidate(output_format);
        let format = undefined;
        if (zodSchemaCandidate) {
            format = zodSchemaToJsonSchema(zodSchemaCandidate, {
                name: 'Response',
                target: 'jsonSchema7',
            });
        }
        else if (output_format) {
            format = 'json';
        }
        const requestPromise = this.client.chat({
            model: this.model,
            messages: ollamaMessages,
            format: format,
            options: this.ollamaOptions ?? undefined,
            stream: false,
        });
        const abortSignal = options.signal;
        const response = abortSignal
            ? await new Promise((resolve, reject) => {
                const onAbort = () => {
                    cleanup();
                    const error = new Error('Operation aborted');
                    error.name = 'AbortError';
                    reject(error);
                };
                const cleanup = () => {
                    abortSignal.removeEventListener('abort', onAbort);
                };
                if (abortSignal.aborted) {
                    onAbort();
                    return;
                }
                abortSignal.addEventListener('abort', onAbort, { once: true });
                requestPromise
                    .then((result) => {
                    cleanup();
                    resolve(result);
                })
                    .catch((error) => {
                    cleanup();
                    reject(error);
                });
            })
            : await requestPromise;
        try {
            const content = response.message.content;
            let completion = content;
            if (output_format) {
                if (zodSchemaCandidate) {
                    completion = this.parseOutput(output_format, JSON.parse(content));
                }
                else {
                    try {
                        completion = this.parseOutput(output_format, JSON.parse(content));
                    }
                    catch {
                        completion = this.parseOutput(output_format, content);
                    }
                }
            }
            const stopReason = response.done_reason ?? null;
            return new ChatInvokeCompletion(completion, {
                prompt_tokens: response.prompt_eval_count ?? 0,
                completion_tokens: response.eval_count ?? 0,
                total_tokens: (response.prompt_eval_count ?? 0) + (response.eval_count ?? 0),
            }, null, null, stopReason);
        }
        catch (error) {
            throw new ModelProviderError(error?.message ?? String(error), error?.status ?? 502, this.model);
        }
    }
}
