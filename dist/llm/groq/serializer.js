import { AssistantMessage, ContentPartImageParam, ContentPartTextParam, SystemMessage, UserMessage, } from '../messages.js';
export class GroqMessageSerializer {
    serialize(messages) {
        return messages.map((message) => this.serializeMessage(message));
    }
    serializeMessage(message) {
        if (message instanceof UserMessage) {
            return {
                role: 'user',
                content: Array.isArray(message.content)
                    ? message.content.map((part) => {
                        if (part instanceof ContentPartTextParam) {
                            return { type: 'text', text: part.text };
                        }
                        if (part instanceof ContentPartImageParam) {
                            return {
                                type: 'image_url',
                                image_url: {
                                    url: part.image_url.url,
                                    detail: part.image_url.detail,
                                },
                            };
                        }
                        return { type: 'text', text: '' };
                    })
                    : message.content,
                name: message.name || undefined,
            };
        }
        if (message instanceof SystemMessage) {
            return {
                role: 'system',
                content: Array.isArray(message.content)
                    ? message.content.map((part) => part.text).join('\n')
                    : message.content,
                name: message.name || undefined,
            };
        }
        if (message instanceof AssistantMessage) {
            const toolCalls = message.tool_calls?.map((toolCall) => ({
                id: toolCall.id,
                type: 'function',
                function: {
                    name: toolCall.functionCall.name,
                    arguments: toolCall.functionCall.arguments,
                },
            }));
            return {
                role: 'assistant',
                content: typeof message.content === 'string' ? message.content : null,
                tool_calls: toolCalls,
            };
        }
        throw new Error(`Unknown message type: ${message.constructor.name}`);
    }
}
