import { ChatOpenAILike } from '../openai/like.js';
import type { ChatOpenAIOptions } from '../openai/chat.js';

export interface ChatLiteLLMOptions extends ChatOpenAIOptions {
  model?: string;
  apiKey?: string;
  baseURL?: string;
}

export class ChatLiteLLM extends ChatOpenAILike {
  public override provider = 'litellm';

  constructor(options: string | ChatLiteLLMOptions = {}) {
    const normalizedOptions =
      typeof options === 'string' ? { model: options } : options;

    super({
      ...normalizedOptions,
      model: normalizedOptions.model ?? 'gpt-4o-mini',
      apiKey: normalizedOptions.apiKey ?? process.env.LITELLM_API_KEY,
      baseURL:
        normalizedOptions.baseURL ??
        process.env.LITELLM_API_BASE ??
        process.env.LITELLM_BASE_URL ??
        'http://localhost:4000',
    });
  }
}
