import { AssistantMessage, ContentPartImageParam, ContentPartRefusalParam, ContentPartTextParam, SystemMessage, UserMessage, } from '../messages.js';
export class AWSBedrockMessageSerializer {
    serialize(messages) {
        return this.serializeMessages(messages)[0];
    }
    serializeMessages(messages) {
        const bedrockMessages = [];
        let systemMessage = undefined;
        for (const message of messages) {
            if (message instanceof SystemMessage) {
                systemMessage = this.serializeSystemContent(message.content);
            }
            else {
                bedrockMessages.push(this.serializeMessage(message));
            }
        }
        return [bedrockMessages, systemMessage];
    }
    serializeSystemContent(content) {
        if (typeof content === 'string') {
            return [{ text: content }];
        }
        return content
            .filter((part) => part instanceof ContentPartTextParam)
            .map((part) => ({ text: part.text }));
    }
    serializeImageContent(part) {
        const url = part.image_url.url;
        if (!url.startsWith('data:')) {
            throw new Error(`Unsupported image URL format: ${url}`);
        }
        const [, payload = ''] = url.split(',', 2);
        const format = part.image_url.media_type.split('/')[1] ?? 'jpeg';
        return {
            image: {
                format,
                source: {
                    bytes: Buffer.from(payload, 'base64'),
                },
            },
        };
    }
    serializeMessage(message) {
        if (message instanceof UserMessage) {
            return {
                role: 'user',
                content: Array.isArray(message.content)
                    ? message.content.map((part) => {
                        if (part instanceof ContentPartTextParam) {
                            return { text: part.text };
                        }
                        if (part instanceof ContentPartImageParam) {
                            return this.serializeImageContent(part);
                        }
                        return { text: '' };
                    })
                    : [{ text: message.content }],
            };
        }
        if (message instanceof AssistantMessage) {
            const content = [];
            if (message.content) {
                if (typeof message.content === 'string') {
                    content.push({ text: message.content });
                }
                else if (Array.isArray(message.content)) {
                    message.content.forEach((part) => {
                        if (part instanceof ContentPartTextParam) {
                            content.push({ text: part.text });
                        }
                        else if (part instanceof ContentPartRefusalParam) {
                            content.push({ text: `[Refusal] ${part.refusal}` });
                        }
                    });
                }
            }
            if (message.tool_calls) {
                message.tool_calls.forEach((toolCall) => {
                    let parsedArguments;
                    try {
                        parsedArguments = JSON.parse(toolCall.functionCall.arguments);
                    }
                    catch {
                        parsedArguments = {
                            arguments: toolCall.functionCall.arguments,
                        };
                    }
                    content.push({
                        toolUse: {
                            toolUseId: toolCall.id,
                            name: toolCall.functionCall.name,
                            input: parsedArguments,
                        },
                    });
                });
            }
            if (!content.length) {
                content.push({ text: '' });
            }
            return {
                role: 'assistant',
                content: content,
            };
        }
        throw new Error(`Unknown message type: ${message.constructor.name}`);
    }
}
