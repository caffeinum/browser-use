import { ChatOpenAILike } from '../openai/like.js';
export class ChatLiteLLM extends ChatOpenAILike {
    provider = 'litellm';
    constructor(options = {}) {
        const normalizedOptions = typeof options === 'string' ? { model: options } : options;
        super({
            ...normalizedOptions,
            model: normalizedOptions.model ?? 'gpt-4o-mini',
            apiKey: normalizedOptions.apiKey ?? process.env.LITELLM_API_KEY,
            baseURL: normalizedOptions.baseURL ??
                process.env.LITELLM_API_BASE ??
                process.env.LITELLM_BASE_URL ??
                'http://localhost:4000',
        });
    }
}
