import { type Message } from '../messages.js';
export type CerebrasMessage = Record<string, unknown>;
export declare class CerebrasMessageSerializer {
    private serializeContent;
    private serializeToolCalls;
    serialize(messages: Message[]): CerebrasMessage[];
}
