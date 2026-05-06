import { AssistantMessage, ContentPartImageParam, ContentPartRefusalParam, ContentPartTextParam, SystemMessage, UserMessage, } from '../messages.js';
export class ResponsesAPIMessageSerializer {
    serialize(messages) {
        return messages.map((message) => this.serializeMessage(message));
    }
    serializeMessage(message) {
        if (message instanceof UserMessage) {
            if (typeof message.content === 'string') {
                return { role: 'user', content: message.content };
            }
            const content = message.content
                .map((part) => {
                if (part instanceof ContentPartTextParam) {
                    return { type: 'input_text', text: part.text };
                }
                if (part instanceof ContentPartImageParam) {
                    return {
                        type: 'input_image',
                        image_url: part.image_url.url,
                        detail: part.image_url.detail,
                    };
                }
                return null;
            })
                .filter((part) => part !== null);
            return { role: 'user', content };
        }
        if (message instanceof SystemMessage) {
            if (typeof message.content === 'string') {
                return { role: 'system', content: message.content };
            }
            return {
                role: 'system',
                content: message.content.map((part) => ({
                    type: 'input_text',
                    text: part.text,
                })),
            };
        }
        if (message instanceof AssistantMessage) {
            if (message.content == null) {
                if (Array.isArray(message.tool_calls) &&
                    message.tool_calls.length > 0) {
                    const toolCallText = message.tool_calls
                        .map((toolCall) => `[Tool call: ${toolCall.functionCall.name}(${toolCall.functionCall.arguments})]`)
                        .join('\n');
                    return { role: 'assistant', content: toolCallText };
                }
                return { role: 'assistant', content: '' };
            }
            if (typeof message.content === 'string') {
                return { role: 'assistant', content: message.content };
            }
            const content = message.content
                .map((part) => {
                if (part instanceof ContentPartTextParam) {
                    return { type: 'input_text', text: part.text };
                }
                if (part instanceof ContentPartRefusalParam) {
                    return {
                        type: 'input_text',
                        text: `[Refusal: ${part.refusal}]`,
                    };
                }
                return null;
            })
                .filter((part) => part !== null);
            return { role: 'assistant', content };
        }
        throw new Error(`Unknown message type: ${message?.constructor?.name ?? typeof message}`);
    }
}
