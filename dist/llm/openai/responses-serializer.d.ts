import { type Message } from '../messages.js';
type ResponsesInputPart = {
    type: 'input_text';
    text: string;
} | {
    type: 'input_image';
    image_url: string;
    detail?: 'auto' | 'low' | 'high';
};
export type ResponsesInputMessage = {
    role: 'user' | 'system' | 'assistant';
    content: string | ResponsesInputPart[];
};
export declare class ResponsesAPIMessageSerializer {
    serialize(messages: Message[]): ResponsesInputMessage[];
    private serializeMessage;
}
export {};
