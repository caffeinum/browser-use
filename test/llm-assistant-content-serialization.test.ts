import { describe, expect, it } from 'vitest';
import { OpenAIMessageSerializer } from '../src/llm/openai/serializer.js';
import { DeepSeekMessageSerializer } from '../src/llm/deepseek/serializer.js';
import { GroqMessageSerializer } from '../src/llm/groq/serializer.js';
import {
  AssistantMessage,
  ContentPartRefusalParam,
  ContentPartTextParam,
} from '../src/llm/messages.js';

describe('Assistant message content serialization', () => {
  const message = new AssistantMessage({
    content: [
      new ContentPartTextParam('part one'),
      new ContentPartRefusalParam('cannot do that'),
      new ContentPartTextParam('part two'),
    ],
  });

  it('OpenAI keeps text and refusal parts', () => {
    const [serialized] = new OpenAIMessageSerializer().serialize([message]);
    expect(serialized).toMatchObject({
      role: 'assistant',
      content: [
        { type: 'text', text: 'part one' },
        { type: 'refusal', refusal: 'cannot do that' },
        { type: 'text', text: 'part two' },
      ],
    });
  });

  it('DeepSeek converts refusal parts to text', () => {
    const [serialized] = new DeepSeekMessageSerializer().serialize([message]);
    expect(serialized).toMatchObject({
      role: 'assistant',
      content: [
        { type: 'text', text: 'part one' },
        { type: 'text', text: '[Refusal] cannot do that' },
        { type: 'text', text: 'part two' },
      ],
    });
  });

  it('Groq joins text parts into a string', () => {
    const [serialized] = new GroqMessageSerializer().serialize([message]);
    expect(serialized).toMatchObject({
      role: 'assistant',
      content: 'part one\npart two',
    });
  });

  it('keeps plain string content unchanged', () => {
    const plain = new AssistantMessage({ content: 'hello' });
    expect(new OpenAIMessageSerializer().serialize([plain])[0].content).toBe(
      'hello'
    );
    expect(new DeepSeekMessageSerializer().serialize([plain])[0].content).toBe(
      'hello'
    );
    expect(new GroqMessageSerializer().serialize([plain])[0].content).toBe(
      'hello'
    );
  });
});
