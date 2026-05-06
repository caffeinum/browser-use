import { AssistantMessage, ContentPartImageParam, ContentPartTextParam, SystemMessage, UserMessage, } from '../messages.js';
export class DeepSeekMessageSerializer {
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
                        // DeepSeek might not support images in all models, but we'll include it for now
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
            return {
                role: 'assistant',
                content: typeof message.content === 'string' ? message.content : null,
                // DeepSeek supports tool calls in newer models
                tool_calls: message.tool_calls?.map((toolCall) => ({
                    id: toolCall.id,
                    type: 'function',
                    function: {
                        name: toolCall.functionCall.name,
                        arguments: toolCall.functionCall.arguments,
                    },
                })),
            };
        }
        throw new Error(`Unknown message type: ${message.constructor.name}`);
    }
}
