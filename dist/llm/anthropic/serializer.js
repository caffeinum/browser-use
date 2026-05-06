/**
 * Anthropic Message Serializer with Prompt Caching Support
 *
 * This serializer converts custom message types to Anthropic's MessageParam format
 * and implements Anthropic's Prompt Caching feature to reduce costs by up to 90%.
 *
 * Caching Strategy:
 * - Only the last message with cache=true will have cache_control enabled
 * - Caching is most effective for system prompts and large conversation histories
 * - Cache writes cost 25% more, but cache reads cost 90% less
 *
 * Example cost savings:
 * - Without caching: 10,000 tokens @ $3/M = $0.030 per request
 * - With caching (90% hit rate):
 *   - First request: 10,000 tokens @ $3.75/M (write) = $0.0375
 *   - Subsequent: 1,000 tokens @ $3/M + 9,000 tokens @ $0.30/M = $0.0057
 *   - Savings: 81% cost reduction
 */
import { AssistantMessage, ContentPartImageParam, ContentPartRefusalParam, ContentPartTextParam, FunctionCall, ImageURL, ToolCall, UserMessage, SystemMessage, } from '../messages.js';
export class AnthropicMessageSerializer {
    /**
     * Serialize a list of messages, extracting any system message
     *
     * @param messages - List of messages to serialize
     * @returns Tuple of [messages, system_message]
     */
    serializeMessages(messages) {
        // Make deep copies to avoid modifying originals
        const messagesCopy = messages.map((message) => this._cloneMessage(message));
        // Separate system messages from normal messages
        const normalMessages = [];
        let systemMessage = null;
        for (const message of messagesCopy) {
            if (message instanceof SystemMessage) {
                systemMessage = message;
            }
            else {
                normalMessages.push(message);
            }
        }
        // Clean cache messages so only the last cache=true message remains cached
        const cleanedMessages = this._cleanCacheMessages(normalMessages);
        // Serialize normal messages
        const serializedMessages = cleanedMessages.map((msg) => this.serializeMessage(msg));
        // Serialize system message
        let serializedSystemMessage = undefined;
        if (systemMessage) {
            serializedSystemMessage = this._serializeContentToStr(systemMessage.content, systemMessage.cache);
        }
        return [serializedMessages, serializedSystemMessage];
    }
    /**
     * Serialize a single message
     */
    serializeMessage(message) {
        if (message instanceof UserMessage) {
            return {
                role: 'user',
                content: Array.isArray(message.content)
                    ? message.content.map((part, idx, arr) => {
                        const isLastPart = idx === arr.length - 1;
                        const useCache = message.cache && isLastPart;
                        if (part instanceof ContentPartTextParam) {
                            return this._serializeContentPartText(part, useCache);
                        }
                        if (part instanceof ContentPartImageParam) {
                            return this._serializeContentPartImage(part);
                        }
                        return { type: 'text', text: '' };
                    })
                    : this._serializeContent(message.content, message.cache),
            };
        }
        if (message instanceof AssistantMessage) {
            const content = [];
            // Add content blocks if present
            if (message.content) {
                if (typeof message.content === 'string') {
                    content.push({
                        type: 'text',
                        text: message.content,
                        ...(message.cache && !message.tool_calls?.length
                            ? { cache_control: this._serializeCacheControl(true) }
                            : {}),
                    });
                }
                else if (Array.isArray(message.content)) {
                    message.content.forEach((part, idx, arr) => {
                        const isLastPart = idx === arr.length - 1;
                        const useCache = message.cache && isLastPart && !message.tool_calls?.length;
                        if (part instanceof ContentPartTextParam) {
                            content.push(this._serializeContentPartText(part, useCache));
                        }
                    });
                }
            }
            // Add tool use blocks if present
            if (message.tool_calls) {
                message.tool_calls.forEach((toolCall, idx, arr) => {
                    const isLastToolCall = idx === arr.length - 1;
                    const useCache = message.cache && isLastToolCall;
                    let toolInput;
                    try {
                        toolInput = JSON.parse(toolCall.functionCall.arguments);
                    }
                    catch {
                        toolInput = { arguments: toolCall.functionCall.arguments };
                    }
                    content.push({
                        type: 'tool_use',
                        id: toolCall.id,
                        name: toolCall.functionCall.name,
                        input: toolInput,
                        ...(useCache
                            ? { cache_control: this._serializeCacheControl(true) }
                            : {}),
                    });
                });
            }
            // If no content or tool calls, add empty text block
            if (!content.length) {
                content.push({
                    type: 'text',
                    text: '',
                    ...(message.cache
                        ? { cache_control: this._serializeCacheControl(true) }
                        : {}),
                });
            }
            const normalizedContent = (() => {
                if (message.cache || content.length > 1) {
                    return content;
                }
                const first = content[0];
                if (first && first.type === 'text' && !first.cache_control) {
                    return first.text;
                }
                return content;
            })();
            return {
                role: 'assistant',
                content: normalizedContent,
            };
        }
        throw new Error(`Unknown message type or unhandled role: ${message.role}`);
    }
    /**
     * Serialize cache control parameter
     */
    _serializeCacheControl(useCache) {
        return useCache ? { type: 'ephemeral' } : undefined;
    }
    /**
     * Serialize text content part with optional caching
     */
    _serializeContentPartText(part, useCache) {
        return {
            type: 'text',
            text: part.text,
            ...(useCache ? { cache_control: this._serializeCacheControl(true) } : {}),
        };
    }
    /**
     * Serialize image content part
     */
    _serializeContentPartImage(part) {
        const url = part.image_url.url;
        if (this._isBase64Image(url)) {
            // Handle base64 encoded images
            const [mediaType, data] = this._parseBase64Url(url);
            return {
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: mediaType,
                    data: data,
                },
            };
        }
        else {
            // Handle URL images
            return {
                type: 'image',
                source: {
                    type: 'url',
                    url: url,
                },
            };
        }
    }
    /**
     * Serialize content (string or array) with optional caching
     */
    _serializeContent(content, useCache) {
        if (typeof content === 'string') {
            if (useCache) {
                return [
                    {
                        type: 'text',
                        text: content,
                        cache_control: this._serializeCacheControl(true),
                    },
                ];
            }
            return content;
        }
        return content.map((part, idx, arr) => {
            const isLastPart = idx === arr.length - 1;
            const partUseCache = useCache && isLastPart;
            if (part instanceof ContentPartTextParam) {
                return this._serializeContentPartText(part, partUseCache);
            }
            else if (part instanceof ContentPartImageParam) {
                return this._serializeContentPartImage(part);
            }
            return { type: 'text', text: '' };
        });
    }
    /**
     * Serialize content to string format (for system messages)
     */
    _serializeContentToStr(content, useCache) {
        if (typeof content === 'string') {
            if (useCache) {
                return [
                    {
                        type: 'text',
                        text: content,
                        cache_control: this._serializeCacheControl(true),
                    },
                ];
            }
            return content;
        }
        return content.map((part, idx, arr) => {
            const isLastPart = idx === arr.length - 1;
            const partUseCache = useCache && isLastPart;
            return this._serializeContentPartText(part, partUseCache);
        });
    }
    /**
     * Check if URL is a base64 encoded image
     */
    _isBase64Image(url) {
        return url.startsWith('data:image/');
    }
    /**
     * Parse base64 data URL to extract media type and data
     */
    _parseBase64Url(url) {
        if (!url.startsWith('data:')) {
            throw new Error(`Invalid base64 URL: ${url}`);
        }
        const [header, data] = url.split(',', 2);
        if (!header || !data) {
            throw new Error(`Invalid base64 URL format: ${url}`);
        }
        let mediaType = header.split(';')[0]?.replace('data:', '') || 'image/jpeg';
        // Ensure it's a supported media type
        const supportedTypes = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
        ];
        if (!supportedTypes.includes(mediaType)) {
            // Default to jpeg if not recognized
            mediaType = 'image/jpeg';
        }
        return [mediaType, data];
    }
    _cloneMessage(message) {
        if (message instanceof UserMessage) {
            const clone = new UserMessage(this._cloneContent(message.content), message.name);
            clone.cache = message.cache;
            return clone;
        }
        if (message instanceof SystemMessage) {
            const clone = new SystemMessage(typeof message.content === 'string'
                ? message.content
                : message.content.map((part) => new ContentPartTextParam(part.text)), message.name);
            clone.cache = message.cache;
            return clone;
        }
        if (message instanceof AssistantMessage) {
            const clone = new AssistantMessage({
                content: message.content === null
                    ? null
                    : typeof message.content === 'string'
                        ? message.content
                        : message.content.map((part) => {
                            if (part instanceof ContentPartTextParam) {
                                return new ContentPartTextParam(part.text);
                            }
                            if (part instanceof ContentPartRefusalParam) {
                                return new ContentPartRefusalParam(part.refusal);
                            }
                            if (part instanceof ContentPartImageParam) {
                                return new ContentPartImageParam(new ImageURL(part.image_url.url, part.image_url.detail, part.image_url.media_type));
                            }
                            return part;
                        }),
                tool_calls: message.tool_calls
                    ? message.tool_calls.map((toolCall) => new ToolCall(toolCall.id, new FunctionCall(toolCall.functionCall.name, toolCall.functionCall.arguments)))
                    : null,
                refusal: message.refusal,
            });
            clone.cache = message.cache;
            return clone;
        }
        return message;
    }
    _cloneContent(content) {
        if (typeof content === 'string') {
            return content;
        }
        return content.map((part) => {
            if (part instanceof ContentPartTextParam) {
                return new ContentPartTextParam(part.text);
            }
            if (part instanceof ContentPartRefusalParam) {
                return new ContentPartRefusalParam(part.refusal);
            }
            return new ContentPartImageParam(new ImageURL(part.image_url.url, part.image_url.detail, part.image_url.media_type));
        });
    }
    /**
     * Clean cache settings so only the last cache=true message remains cached
     *
     * Because of how Claude caching works, only the last cache message matters.
     * This method automatically removes cache=True from all messages except the last one.
     */
    _cleanCacheMessages(messages) {
        if (!messages.length) {
            return messages;
        }
        // Create deep copies to avoid modifying originals
        const cleanedMessages = messages.map((msg) => this._cloneMessage(msg));
        // Find the last message with cache=true
        let lastCacheIndex = -1;
        for (let i = cleanedMessages.length - 1; i >= 0; i--) {
            if (cleanedMessages[i].cache) {
                lastCacheIndex = i;
                break;
            }
        }
        // If we found a cached message, disable cache for all others
        if (lastCacheIndex !== -1) {
            for (let i = 0; i < cleanedMessages.length; i++) {
                if (i !== lastCacheIndex && cleanedMessages[i].cache) {
                    cleanedMessages[i].cache = false;
                }
            }
        }
        return cleanedMessages;
    }
}
