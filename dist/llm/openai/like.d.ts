import { ChatOpenAI, type ChatOpenAIOptions } from './chat.js';
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
export declare class ChatOpenAILike extends ChatOpenAI {
    /**
     * @param options - A model name or ChatOpenAI-compatible options
     */
    constructor(options: string | (ChatOpenAIOptions & {
        model: string;
    }));
}
