import type { ChatCompletionMessageParam } from 'openai/resources/index.mjs';
import { type Message } from '../messages.js';
export declare class DeepSeekMessageSerializer {
    serialize(messages: Message[]): ChatCompletionMessageParam[];
    private serializeMessage;
}
