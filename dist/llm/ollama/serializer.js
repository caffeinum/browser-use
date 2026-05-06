import { AssistantMessage, ContentPartImageParam, ContentPartRefusalParam, ContentPartTextParam, SystemMessage, UserMessage, } from '../messages.js';
export class OllamaMessageSerializer {
    serialize(messages) {
        return messages.map((message) => this.serializeMessage(message));
    }
    extractTextContent(content) {
        if (content === null || content === undefined) {
            return '';
        }
        if (typeof content === 'string') {
            return content;
        }
        if (!Array.isArray(content)) {
            return '';
        }
        const parts = [];
        for (const part of content) {
            if (part instanceof ContentPartTextParam) {
                parts.push(part.text);
            }
            else if (part instanceof ContentPartRefusalParam) {
                parts.push(`[Refusal] ${part.refusal}`);
            }
        }
        return parts.join('\n');
    }
    serializeMessage(message) {
        if (message instanceof UserMessage) {
            const images = [];
            const content = this.extractTextContent(message.content);
            if (Array.isArray(message.content)) {
                message.content.forEach((part) => {
                    if (part instanceof ContentPartImageParam) {
                        // Ollama expects base64 string without header
                        const data = part.image_url.url.split(',')[1];
                        if (data)
                            images.push(data);
                    }
                });
            }
            return {
                role: 'user',
                content: content,
                images: images.length > 0 ? images : undefined,
            };
        }
        if (message instanceof SystemMessage) {
            return {
                role: 'system',
                content: this.extractTextContent(message.content),
            };
        }
        if (message instanceof AssistantMessage) {
            const toolCalls = message.tool_calls?.map((toolCall) => ({
                function: {
                    name: toolCall.functionCall.name,
                    arguments: (() => {
                        try {
                            return JSON.parse(toolCall.functionCall.arguments);
                        }
                        catch {
                            return { arguments: toolCall.functionCall.arguments };
                        }
                    })(),
                },
            }));
            return {
                role: 'assistant',
                content: this.extractTextContent(message.content),
                tool_calls: toolCalls,
            };
        }
        throw new Error(`Unknown message type: ${message.constructor.name}`);
    }
}
