import type { ChatCompletionMessageParam } from 'openai/resources/index.mjs';
import {
  AssistantMessage,
  ContentPartImageParam,
  ContentPartRefusalParam,
  ContentPartTextParam,
  SystemMessage,
  UserMessage,
  type Message,
} from '../messages.js';

export class DeepSeekMessageSerializer {
  serialize(messages: Message[]): ChatCompletionMessageParam[] {
    return messages.map((message) => this.serializeMessage(message));
  }

  private serializeMessage(message: Message): ChatCompletionMessageParam {
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
      let content: string | null | Array<{ type: 'text'; text: string }> = null;
      if (typeof message.content === 'string') {
        content = message.content;
      } else if (Array.isArray(message.content)) {
        content = message.content.flatMap((part) => {
          if (part instanceof ContentPartTextParam) {
            return [{ type: 'text' as const, text: part.text }];
          }
          if (part instanceof ContentPartRefusalParam) {
            return [
              { type: 'text' as const, text: `[Refusal] ${part.refusal}` },
            ];
          }
          return [];
        });
      }

      return {
        role: 'assistant',
        content,
        // DeepSeek supports tool calls in newer models
        tool_calls: message.tool_calls?.map((toolCall) => ({
          id: toolCall.id,
          type: 'function' as const,
          function: {
            name: toolCall.functionCall.name,
            arguments: toolCall.functionCall.arguments,
          },
        })),
      };
    }

    throw new Error(
      `Unknown message type: ${(message as any).constructor.name}`
    );
  }
}
