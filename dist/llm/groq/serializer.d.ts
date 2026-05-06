import type { ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions.mjs';
import { type Message } from '../messages.js';
export declare class GroqMessageSerializer {
    serialize(messages: Message[]): ChatCompletionMessageParam[];
    private serializeMessage;
}
