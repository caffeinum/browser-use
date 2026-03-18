import {
  AssistantMessage,
  ContentPartImageParam,
  ContentPartRefusalParam,
  ContentPartTextParam,
  SystemMessage,
  UserMessage,
  type Message,
} from '../messages.js';

type OciChatContent = Record<string, unknown>;
type OciMessage = {
  role: string;
  name?: string;
  content: OciChatContent[];
};

const textContent = (text: string): OciChatContent => ({
  type: 'TEXT',
  text,
});

const imageContent = (url: string): OciChatContent => ({
  type: 'IMAGE',
  imageUrl: {
    url,
  },
});

const contentPartsToOci = (
  content:
    | string
    | Array<
        ContentPartTextParam | ContentPartImageParam | ContentPartRefusalParam
      >
    | null
    | undefined
): OciChatContent[] => {
  if (typeof content === 'string') {
    return [textContent(content)];
  }
  if (!Array.isArray(content)) {
    return [];
  }

  const parts: OciChatContent[] = [];
  for (const part of content) {
    if (part instanceof ContentPartTextParam) {
      parts.push(textContent(part.text));
      continue;
    }
    if (part instanceof ContentPartImageParam) {
      parts.push(imageContent(part.image_url.url));
      continue;
    }
    if (part instanceof ContentPartRefusalParam) {
      parts.push(textContent(`[Refusal] ${part.refusal}`));
    }
  }
  return parts;
};

const serializeRole = (message: Message): string => {
  if (message instanceof SystemMessage) {
    return 'SYSTEM';
  }
  if (message instanceof AssistantMessage) {
    return 'ASSISTANT';
  }
  return 'USER';
};

const serializeName = (message: Message): string | undefined => {
  if (message instanceof UserMessage || message instanceof SystemMessage) {
    return message.name ?? undefined;
  }
  return undefined;
};

export class OCIRawMessageSerializer {
  static serializeMessages(messages: Message[]): OciMessage[] {
    const serialized: OciMessage[] = [];

    for (const message of messages) {
      const content =
        message instanceof AssistantMessage
          ? contentPartsToOci(message.content)
          : contentPartsToOci((message as UserMessage | SystemMessage).content);

      if (content.length === 0) {
        continue;
      }

      serialized.push({
        role: serializeRole(message),
        name: serializeName(message),
        content,
      });
    }

    return serialized;
  }

  static serializeMessagesForCohere(messages: Message[]): string {
    const conversationParts: string[] = [];

    for (const message of messages) {
      let text = '';

      if (message instanceof UserMessage || message instanceof SystemMessage) {
        const content = message.content;
        if (typeof content === 'string') {
          text = content;
        } else {
          text = content
            .map((part) => {
              if (part instanceof ContentPartTextParam) {
                return part.text;
              }
              if (part instanceof ContentPartImageParam) {
                return part.image_url.url.startsWith('data:image/')
                  ? '[Image: base64_data]'
                  : '[Image: external_url]';
              }
              return '';
            })
            .filter(Boolean)
            .join(' ');
        }
      } else if (message instanceof AssistantMessage) {
        if (typeof message.content === 'string') {
          text = message.content;
        } else if (Array.isArray(message.content)) {
          text = message.content
            .map((part) => {
              if (part instanceof ContentPartTextParam) {
                return part.text;
              }
              if (part instanceof ContentPartRefusalParam) {
                return `[Refusal] ${part.refusal}`;
              }
              return '';
            })
            .filter(Boolean)
            .join(' ');
        } else if (message.refusal) {
          text = `[Refusal] ${message.refusal}`;
        }
      }

      if (!text) {
        continue;
      }

      const prefix =
        message instanceof SystemMessage
          ? 'System'
          : message instanceof AssistantMessage
            ? 'Assistant'
            : 'User';
      conversationParts.push(`${prefix}: ${text}`);
    }

    return conversationParts.join('\n\n');
  }
}
