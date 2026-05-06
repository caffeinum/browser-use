import { AssistantMessage, ContentPartImageParam, ContentPartRefusalParam, ContentPartTextParam, SystemMessage, UserMessage, } from '../messages.js';
export class GoogleMessageSerializer {
    serialize(messages) {
        return this.serializeWithSystem(messages).contents;
    }
    serializeWithSystem(messages, includeSystemInUser = false) {
        const contents = [];
        const systemParts = [];
        let systemInstruction = null;
        let injectedSystemIntoUser = false;
        for (const message of messages) {
            const role = message?.role;
            if (message instanceof SystemMessage ||
                role === 'system' ||
                role === 'developer') {
                const text = this.extractMessageText(message);
                if (text) {
                    if (includeSystemInUser) {
                        systemParts.push(text);
                    }
                    else {
                        systemInstruction = text;
                    }
                }
                continue;
            }
            if (message instanceof UserMessage) {
                const prependSystem = includeSystemInUser &&
                    !injectedSystemIntoUser &&
                    systemParts.length > 0
                    ? systemParts.join('\n\n')
                    : null;
                contents.push(this.serializeUserMessage(message, prependSystem));
                if (prependSystem) {
                    injectedSystemIntoUser = true;
                }
                continue;
            }
            if (message instanceof AssistantMessage) {
                contents.push(this.serializeAssistantMessage(message));
            }
        }
        if (includeSystemInUser &&
            systemParts.length > 0 &&
            !injectedSystemIntoUser) {
            contents.unshift({
                role: 'user',
                parts: [{ text: systemParts.join('\n\n') }],
            });
        }
        return {
            contents,
            systemInstruction: includeSystemInUser ? null : systemInstruction,
        };
    }
    serializeUserMessage(message, prependSystem = null) {
        const parts = [];
        if (prependSystem) {
            parts.push({ text: prependSystem });
        }
        if (message instanceof UserMessage) {
            if (Array.isArray(message.content)) {
                for (const part of message.content) {
                    if (part instanceof ContentPartTextParam) {
                        parts.push({ text: part.text });
                    }
                    else if (part instanceof ContentPartRefusalParam) {
                        parts.push({ text: `[Refusal] ${part.refusal}` });
                    }
                    else if (part instanceof ContentPartImageParam) {
                        parts.push(this.serializeImagePart(part));
                    }
                }
            }
            else {
                parts.push({ text: message.content });
            }
        }
        return {
            role: 'user',
            parts,
        };
    }
    serializeAssistantMessage(message) {
        const parts = [];
        if (message instanceof AssistantMessage) {
            if (message.content) {
                if (typeof message.content === 'string') {
                    parts.push({ text: message.content });
                }
                else if (Array.isArray(message.content)) {
                    message.content.forEach((part) => {
                        if (part instanceof ContentPartTextParam) {
                            parts.push({ text: part.text });
                        }
                        else if (part instanceof ContentPartRefusalParam) {
                            parts.push({ text: `[Refusal] ${part.refusal}` });
                        }
                        else if (part instanceof ContentPartImageParam) {
                            parts.push(this.serializeImagePart(part));
                        }
                    });
                }
            }
            if (message.tool_calls) {
                message.tool_calls.forEach((toolCall) => {
                    let args;
                    try {
                        const parsed = JSON.parse(toolCall.functionCall.arguments);
                        args =
                            parsed && typeof parsed === 'object' && !Array.isArray(parsed)
                                ? parsed
                                : {};
                    }
                    catch {
                        args = {};
                    }
                    parts.push({
                        functionCall: {
                            name: toolCall.functionCall.name,
                            args,
                        },
                    });
                });
            }
        }
        return {
            role: 'model',
            parts: parts,
        };
    }
    serializeImagePart(part) {
        const imageUrl = part.image_url.url;
        if (!imageUrl.startsWith('data:')) {
            return { text: imageUrl };
        }
        const commaIndex = imageUrl.indexOf(',');
        if (commaIndex === -1) {
            return { text: imageUrl };
        }
        const data = imageUrl.slice(commaIndex + 1);
        return {
            inlineData: {
                mimeType: part.image_url.media_type,
                data,
            },
        };
    }
    extractMessageText(message) {
        const content = message?.content;
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
            else if (part &&
                typeof part === 'object' &&
                part.type === 'text' &&
                typeof part.text === 'string') {
                parts.push(part.text);
            }
        }
        return parts.join('\n');
    }
}
