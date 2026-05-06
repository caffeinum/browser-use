import { Message } from '../../llm/messages.js';
export declare const saveConversation: (inputMessages: Message[], response: unknown, target: string, encoding?: BufferEncoding) => Promise<void>;
