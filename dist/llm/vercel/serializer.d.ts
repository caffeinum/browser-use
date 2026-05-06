import type { ChatCompletionMessageParam } from 'openai/resources/index.mjs';
import type { Message } from '../messages.js';
export declare class VercelMessageSerializer {
    serialize(messages: Message[]): ChatCompletionMessageParam[];
}
