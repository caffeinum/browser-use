import { type Message } from '../messages.js';
type OciChatContent = Record<string, unknown>;
type OciMessage = {
    role: string;
    name?: string;
    content: OciChatContent[];
};
export declare class OCIRawMessageSerializer {
    static serializeMessages(messages: Message[]): OciMessage[];
    static serializeMessagesForCohere(messages: Message[]): string;
}
export {};
