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
import type { MessageParam, TextBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs';
import { type Message } from '../messages.js';
export declare class AnthropicMessageSerializer {
    /**
     * Serialize a list of messages, extracting any system message
     *
     * @param messages - List of messages to serialize
     * @returns Tuple of [messages, system_message]
     */
    serializeMessages(messages: Message[]): [MessageParam[], (string | TextBlockParam[])?];
    /**
     * Serialize a single message
     */
    serializeMessage(message: Message): MessageParam;
    /**
     * Serialize cache control parameter
     */
    private _serializeCacheControl;
    /**
     * Serialize text content part with optional caching
     */
    private _serializeContentPartText;
    /**
     * Serialize image content part
     */
    private _serializeContentPartImage;
    /**
     * Serialize content (string or array) with optional caching
     */
    private _serializeContent;
    /**
     * Serialize content to string format (for system messages)
     */
    private _serializeContentToStr;
    /**
     * Check if URL is a base64 encoded image
     */
    private _isBase64Image;
    /**
     * Parse base64 data URL to extract media type and data
     */
    private _parseBase64Url;
    private _cloneMessage;
    private _cloneContent;
    /**
     * Clean cache settings so only the last cache=true message remains cached
     *
     * Because of how Claude caching works, only the last cache message matters.
     * This method automatically removes cache=True from all messages except the last one.
     */
    private _cleanCacheMessages;
}
