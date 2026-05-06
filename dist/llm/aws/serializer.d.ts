import { type Message } from '../messages.js';
type BedrockContentBlock = Record<string, unknown>;
type BedrockMessage = {
    role: 'user' | 'assistant';
    content: BedrockContentBlock[];
};
type BedrockSystemMessage = {
    text: string;
}[];
export declare class AWSBedrockMessageSerializer {
    serialize(messages: Message[]): BedrockMessage[];
    serializeMessages(messages: Message[]): [BedrockMessage[], BedrockSystemMessage?];
    private serializeSystemContent;
    private serializeImageContent;
    private serializeMessage;
}
export {};
