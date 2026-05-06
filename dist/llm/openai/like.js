import { ChatOpenAI } from './chat.js';
/**
 * A class to interact with any provider using the OpenAI API schema.
 *
 * This allows using any OpenAI-compatible API provider by specifying a custom model name.
 *
 * @example
 * ```typescript
 * const llm = new ChatOpenAILike('custom-model-name');
 * ```
 */
export class ChatOpenAILike extends ChatOpenAI {
    /**
     * @param options - A model name or ChatOpenAI-compatible options
     */
    constructor(options) {
        if (typeof options === 'string') {
            super({ model: options });
            return;
        }
        super(options);
    }
}
