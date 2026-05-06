import type { Content } from '@google/genai';
import { type Message } from '../messages.js';
export interface SerializedGoogleMessages {
    contents: Content[];
    systemInstruction: string | null;
}
export declare class GoogleMessageSerializer {
    serialize(messages: Message[]): Content[];
    serializeWithSystem(messages: Message[], includeSystemInUser?: boolean): SerializedGoogleMessages;
    private serializeUserMessage;
    private serializeAssistantMessage;
    private serializeImagePart;
    private extractMessageText;
}
