import type { Message as OllamaMessage } from 'ollama';
import { type Message } from '../messages.js';
export declare class OllamaMessageSerializer {
    serialize(messages: Message[]): OllamaMessage[];
    private extractTextContent;
    private serializeMessage;
}
