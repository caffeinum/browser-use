import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const anthropicMock = vi.hoisted(() => {
  class APIError extends Error {
    status?: number;

    constructor(message = 'API error', status = 500) {
      super(message);
      this.status = status;
    }
  }

  class APIConnectionError extends Error {}

  class RateLimitError extends APIError {
    constructor(message = 'Rate limit exceeded') {
      super(message, 429);
    }
  }

  return {
    anthropicCtorMock: vi.fn(),
    anthropicCreateMock: vi.fn(),
    anthropicBetaCreateMock: vi.fn(),
    APIError,
    APIConnectionError,
    RateLimitError,
  };
});

vi.mock('@anthropic-ai/sdk', () => {
  class Anthropic {
    messages = {
      create: anthropicMock.anthropicCreateMock,
    };

    beta = {
      messages: {
        create: anthropicMock.anthropicBetaCreateMock,
      },
    };

    constructor(options?: unknown) {
      anthropicMock.anthropicCtorMock(options);
    }
  }

  return {
    default: Anthropic,
    APIError: anthropicMock.APIError,
    APIConnectionError: anthropicMock.APIConnectionError,
    RateLimitError: anthropicMock.RateLimitError,
  };
});

import { ChatAnthropic } from '../src/llm/anthropic/chat.js';
import {
  ModelOutputTruncatedError,
  ModelProviderError,
  ModelRateLimitError,
} from '../src/llm/exceptions.js';
import { SystemMessage, UserMessage } from '../src/llm/messages.js';

const TOOL_PATH = { structured_output_mode: 'tool' } as const;

const buildResponse = (content: any[], stopReason = 'end_turn') => ({
  content,
  stop_reason: stopReason,
  usage: {
    input_tokens: 10,
    output_tokens: 5,
    cache_read_input_tokens: 2,
    cache_creation_input_tokens: 1,
  },
});

describe('ChatAnthropic alignment', () => {
  beforeEach(() => {
    anthropicMock.anthropicCtorMock.mockReset();
    anthropicMock.anthropicCreateMock.mockReset();
    anthropicMock.anthropicBetaCreateMock.mockReset();
    anthropicMock.anthropicCreateMock.mockResolvedValue(
      buildResponse([{ type: 'text', text: 'plain response' }])
    );
    anthropicMock.anthropicBetaCreateMock.mockResolvedValue(
      buildResponse([{ type: 'text', text: 'beta response' }])
    );
  });

  it.each([Number.POSITIVE_INFINITY, -1, 1.5, 101])(
    'rejects unsafe maxRetries value %s',
    (maxRetries) => {
      expect(() => new ChatAnthropic({ maxRetries })).toThrow(
        'maxRetries must be an integer between 0 and 100.'
      );
    }
  );

  it('passes python-aligned client options and invoke params', async () => {
    const fetchMock = vi.fn(
      async () => new Response()
    ) as unknown as typeof fetch;

    const llm = new ChatAnthropic({
      model: 'claude-sonnet-4-20250514',
      apiKey: 'test-key',
      authToken: 'auth-token',
      baseURL: 'https://example.anthropic.local',
      timeout: 1234,
      maxTokens: 2048,
      temperature: 0.3,
      topP: 0.8,
      seed: 7,
      maxRetries: 6,
      defaultHeaders: { 'x-trace-id': 'trace-1' },
      defaultQuery: { purpose: 'alignment' },
      fetchImplementation: fetchMock,
      fetchOptions: { cache: 'no-store' },
    });

    await llm.ainvoke([new SystemMessage('sys'), new UserMessage('hello')]);

    expect(anthropicMock.anthropicCtorMock.mock.calls[0]?.[0]).toMatchObject({
      apiKey: 'test-key',
      authToken: 'auth-token',
      baseURL: 'https://example.anthropic.local',
      timeout: 1234,
      maxRetries: 6,
      defaultHeaders: { 'x-trace-id': 'trace-1' },
      defaultQuery: { purpose: 'alignment' },
      fetch: fetchMock,
      fetchOptions: { cache: 'no-store' },
    });

    const request = anthropicMock.anthropicCreateMock.mock.calls[0]?.[0] ?? {};
    expect(request.model).toBe('claude-sonnet-4-20250514');
    expect(request.max_tokens).toBe(2048);
    expect(request.system).toBe('sys');
    expect(request.temperature).toBe(0.3);
    expect(request.top_p).toBe(0.8);
    expect(request.seed).toBe(7);
  });

  it('uses tool-calling structured output with schema optimization', async () => {
    anthropicMock.anthropicCreateMock.mockResolvedValue(
      buildResponse([
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'response',
          input: { items: ['alpha'] },
        },
      ])
    );

    const schema = z.object({
      items: z.array(z.string()).min(1).default(['seed']),
    });
    const llm = new ChatAnthropic({
      removeMinItemsFromSchema: true,
      removeDefaultsFromSchema: true,
    });

    const result = await llm.ainvoke(
      [new UserMessage('extract')],
      schema as any,
      TOOL_PATH
    );
    const request = anthropicMock.anthropicCreateMock.mock.calls[0]?.[0] ?? {};

    expect(request.tools).toHaveLength(1);
    expect(request.tool_choice).toEqual({ type: 'tool', name: 'response' });
    expect(request.tools[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(JSON.stringify(request.tools[0].input_schema)).not.toContain(
      'title'
    );
    expect(JSON.stringify(request.tools[0].input_schema)).not.toContain(
      'minItems'
    );
    expect(JSON.stringify(request.tools[0].input_schema)).not.toContain(
      'min_items'
    );
    expect(JSON.stringify(request.tools[0].input_schema)).not.toContain(
      '"default"'
    );
    expect((result.completion as any).items).toEqual(['alpha']);
    expect(result.usage?.prompt_cached_tokens).toBe(2);
    expect(result.usage?.prompt_cache_creation_tokens).toBe(1);
  });

  it('fails structured output when tool response is missing', async () => {
    anthropicMock.anthropicCreateMock.mockResolvedValue(
      buildResponse([{ type: 'text', text: '{"value":"ok"}' }])
    );

    const schema = z.object({ value: z.string() });
    const llm = new ChatAnthropic();

    await expect(
      llm.ainvoke([new UserMessage('extract')], schema as any, TOOL_PATH)
    ).rejects.toMatchObject({
      name: 'ModelProviderError',
      message: 'Expected tool use in response but none found',
    });
  });

  it('maps provider errors to model errors', async () => {
    anthropicMock.anthropicCreateMock.mockRejectedValueOnce(
      new anthropicMock.RateLimitError('too many requests')
    );
    const llm = new ChatAnthropic();
    await expect(
      llm.ainvoke([new UserMessage('hello')])
    ).rejects.toBeInstanceOf(ModelRateLimitError);

    anthropicMock.anthropicCreateMock.mockRejectedValueOnce(
      new anthropicMock.APIConnectionError('network down')
    );
    await expect(llm.ainvoke([new UserMessage('hello')])).rejects.toMatchObject(
      {
        name: 'ModelProviderError',
        statusCode: 502,
      }
    );

    anthropicMock.anthropicCreateMock.mockRejectedValueOnce(
      new anthropicMock.APIError('server bad', 503)
    );
    await expect(llm.ainvoke([new UserMessage('hello')])).rejects.toMatchObject(
      {
        name: 'ModelProviderError',
        statusCode: 503,
      }
    );

    anthropicMock.anthropicCreateMock.mockRejectedValueOnce(
      new Error('unknown')
    );
    await expect(
      llm.ainvoke([new UserMessage('hello')])
    ).rejects.toBeInstanceOf(ModelProviderError);
  });

  it('reports max_tokens before checking structured tool output', async () => {
    anthropicMock.anthropicCreateMock.mockResolvedValue(
      buildResponse([{ type: 'text', text: '{"value":"partial' }], 'max_tokens')
    );

    const llm = new ChatAnthropic({ maxTokens: 128 });
    await expect(
      llm.ainvoke(
        [new UserMessage('extract')],
        z.object({ value: z.string() }) as any,
        TOOL_PATH
      )
    ).rejects.toMatchObject({
      name: 'ModelOutputTruncatedError',
      statusCode: 400,
      model: 'claude-sonnet-4-20250514',
      message: expect.stringContaining('max_tokens=128'),
    } satisfies Partial<ModelOutputTruncatedError>);
  });

  it('uses beta messages and server-side fallback options when configured', async () => {
    const llm = new ChatAnthropic({
      model: 'claude-fable-5',
      outputConfig: { effort: 'high' },
      thinking: { type: 'adaptive', display: 'summarized' },
      betas: ['context-1m-2025-08-07'],
      fallbacks: [{ model: 'claude-sonnet-4-6' }],
      inferenceGeo: 'us',
    });

    const result = await llm.ainvoke([new UserMessage('hello')]);

    expect(result.completion).toBe('beta response');
    expect(anthropicMock.anthropicCreateMock).not.toHaveBeenCalled();
    const request =
      anthropicMock.anthropicBetaCreateMock.mock.calls[0]?.[0] ?? {};
    expect(request).toMatchObject({
      model: 'claude-fable-5',
      output_config: { effort: 'high' },
      thinking: { type: 'adaptive', display: 'summarized' },
      fallbacks: [{ model: 'claude-sonnet-4-6' }],
      inference_geo: 'us',
    });
    expect(request.betas).toEqual([
      'context-1m-2025-08-07',
      'server-side-fallback-2026-06-01',
    ]);
  });

  it.each([
    { type: 'enabled', budget_tokens: 2048 },
    { type: 'disabled' },
    { type: 'adaptive', budget_tokens: 2048 },
  ])('rejects non-adaptive Fable thinking config %j', async (thinking) => {
    const llm = new ChatAnthropic({
      model: 'claude-fable-5',
      thinking,
    });

    await expect(llm.ainvoke([new UserMessage('hello')])).rejects.toMatchObject(
      {
        name: 'ModelProviderError',
        statusCode: 400,
        model: 'claude-fable-5',
        message: expect.stringMatching(/only supports adaptive thinking/),
      }
    );
    expect(anthropicMock.anthropicCreateMock).not.toHaveBeenCalled();
  });

  it('uses auto tool choice and parses structured text with thinking metadata', async () => {
    anthropicMock.anthropicCreateMock.mockResolvedValue({
      content: [
        { type: 'thinking', thinking: 'considered the schema' },
        { type: 'redacted_thinking', data: 'encrypted-thought' },
        { type: 'text', text: '```json\n{"value":"ok"}\n```' },
      ],
      stop_reason: 'end_turn',
      stop_details: {
        type: 'refusal',
        category: 'none',
        explanation: 'completed normally',
      },
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        cache_read_input_tokens: 2,
        cache_creation_input_tokens: 7,
        cache_creation: {
          ephemeral_5m_input_tokens: 3,
          ephemeral_1h_input_tokens: 4,
        },
      },
    });
    const llm = new ChatAnthropic({
      model: 'claude-fable-5',
      thinking: { type: 'adaptive' },
      inferenceGeo: 'us',
    });

    const result = await llm.ainvoke(
      [new UserMessage('extract')],
      z.object({ value: z.string() }) as any,
      TOOL_PATH
    );

    const request = anthropicMock.anthropicCreateMock.mock.calls[0]?.[0] ?? {};
    expect(request.tool_choice).toEqual({ type: 'auto' });
    expect(request.inference_geo).toBe('us');
    expect((result.completion as any).value).toBe('ok');
    expect(result.thinking).toBe('considered the schema');
    expect(result.redacted_thinking).toBe('encrypted-thought');
    expect(result.stop_details).toEqual({
      type: 'refusal',
      category: 'none',
      explanation: 'completed normally',
    });
    expect(result.usage).toMatchObject({
      prompt_cache_creation_5m_tokens: 3,
      prompt_cache_creation_1h_tokens: 4,
      pricing_multiplier: 1.1,
    });
  });

  it('uses auto tool choice with explicit tool instructions for claude-sonnet-5-5', async () => {
    anthropicMock.anthropicCreateMock.mockResolvedValue(
      buildResponse([
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'response',
          input: { value: 'ok' },
        },
      ])
    );
    const llm = new ChatAnthropic({ model: 'claude-sonnet-5-5' });

    const result = await llm.ainvoke(
      [new SystemMessage('agent rules'), new UserMessage('extract')],
      z.object({ value: z.string() }) as any,
      TOOL_PATH
    );

    const request = anthropicMock.anthropicCreateMock.mock.calls[0]?.[0] ?? {};
    expect(request.tool_choice).toEqual({ type: 'auto' });
    expect(request.tools[0].description).toContain(
      'Every reply must be exactly one call to `response`'
    );
    expect(JSON.stringify(request.system)).toContain('agent rules');
    expect(JSON.stringify(request.system)).toContain(
      'Respond only by calling the `response` tool exactly once.'
    );
    expect((result.completion as any).value).toBe('ok');
  });

  it('rejects tool calls to tools other than the structured output tool', async () => {
    anthropicMock.anthropicCreateMock.mockResolvedValue(
      buildResponse([
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'evaluate',
          input: { code: 'document.title' },
        },
      ])
    );
    const llm = new ChatAnthropic({
      model: 'claude-sonnet-5-5',
      thinking: { type: 'adaptive' },
    });

    await expect(
      llm.ainvoke(
        [new UserMessage('extract')],
        z.object({ value: z.string() }) as any,
        TOOL_PATH
      )
    ).rejects.toMatchObject({
      name: 'ModelProviderError',
      message: 'Model called unknown tool(s) "evaluate"; expected "response"',
    });
  });

  it('leaves the system prompt untouched with forced tool choice', async () => {
    anthropicMock.anthropicCreateMock.mockResolvedValue(
      buildResponse([
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'response',
          input: { value: 'ok' },
        },
      ])
    );
    const llm = new ChatAnthropic({ model: 'claude-sonnet-5' });

    await llm.ainvoke(
      [new SystemMessage('agent rules'), new UserMessage('extract')],
      z.object({ value: z.string() }) as any,
      TOOL_PATH
    );

    const request = anthropicMock.anthropicCreateMock.mock.calls[0]?.[0] ?? {};
    expect(request.tool_choice).toEqual({ type: 'tool', name: 'response' });
    expect(JSON.stringify(request.system)).not.toContain('Respond only by');
  });

  it('keeps forced tool choice when thinking is disabled', async () => {
    anthropicMock.anthropicCreateMock.mockResolvedValue(
      buildResponse([
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'response',
          input: { value: 'ok' },
        },
      ])
    );
    const llm = new ChatAnthropic({
      thinking: { type: 'disabled' },
    });

    await llm.ainvoke(
      [new UserMessage('extract')],
      z.object({ value: z.string() }) as any,
      TOOL_PATH
    );

    const request = anthropicMock.anthropicCreateMock.mock.calls[0]?.[0] ?? {};
    expect(request.tool_choice).toEqual({ type: 'tool', name: 'response' });
  });

  it('repairs double-serialized tool fields containing control characters', async () => {
    anthropicMock.anthropicCreateMock.mockResolvedValue(
      buildResponse([
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'response',
          input: { metadata: '{"note":"line 1\nline 2"}' },
        },
      ])
    );
    const llm = new ChatAnthropic();

    const result = await llm.ainvoke(
      [new UserMessage('extract')],
      z.object({ metadata: z.object({ note: z.string() }) }) as any,
      TOOL_PATH
    );

    expect((result.completion as any).metadata.note).toBe('line 1\nline 2');
  });

  it('uses native json_schema output by default and parses the text JSON', async () => {
    anthropicMock.anthropicCreateMock.mockResolvedValue(
      buildResponse([
        { type: 'thinking', thinking: 'thought' },
        { type: 'text', text: '{"value":"ok","count":3}' },
      ])
    );
    const llm = new ChatAnthropic({
      model: 'claude-sonnet-5-5',
      thinking: { type: 'adaptive' },
      outputConfig: { effort: 'high' },
    });

    const result = await llm.ainvoke(
      [new SystemMessage('judge rules'), new UserMessage('judge')],
      z.object({
        value: z.string(),
        count: z.number().int().min(0).max(10),
      }) as any
    );

    const request = anthropicMock.anthropicCreateMock.mock.calls[0]?.[0] ?? {};
    expect(request.tools).toBeUndefined();
    expect(request.tool_choice).toBeUndefined();
    expect(request.system).toBe('judge rules');
    expect(request.output_config.effort).toBe('high');
    expect(request.output_config.format.type).toBe('json_schema');
    const schemaJson = JSON.stringify(request.output_config.format.schema);
    expect(schemaJson).not.toContain('minimum');
    expect(schemaJson).not.toContain('maximum');
    expect(request.output_config.format.schema.additionalProperties).toBe(
      false
    );
    expect(result.completion).toEqual({ value: 'ok', count: 3 });
    expect(result.thinking).toBe('thought');
  });

  it('strips zod format regexes from native schemas but keeps zod validation', async () => {
    anthropicMock.anthropicCreateMock.mockResolvedValue(
      buildResponse([
        {
          type: 'text',
          text: '{"email":"not-an-email","pattern":"p","code":"ABC"}',
        },
      ])
    );
    const llm = new ChatAnthropic({ model: 'claude-sonnet-5-5' });

    await expect(
      llm.ainvoke(
        [new UserMessage('extract')],
        z.object({
          email: z.string().email(),
          pattern: z.string(),
          code: z.string().regex(/^[A-Z]{3}$/),
        }) as any
      )
    ).rejects.toThrow();

    const request = anthropicMock.anthropicCreateMock.mock.calls[0]?.[0] ?? {};
    const schema = request.output_config.format.schema;
    expect(schema.properties.email).toEqual({ type: 'string' });
    expect(schema.properties.code.pattern).toBe('^[A-Z]{3}$');
    expect(Object.keys(schema.properties)).toEqual([
      'email',
      'pattern',
      'code',
    ]);
  });

  it('uses the tool path for record schemas that native json_schema rejects', async () => {
    anthropicMock.anthropicCreateMock.mockResolvedValue(
      buildResponse([
        {
          type: 'tool_use',
          id: 'tool_1',
          name: 'response',
          input: { tags: { a: 1 } },
        },
      ])
    );
    const llm = new ChatAnthropic({ model: 'claude-sonnet-5' });

    const result = await llm.ainvoke(
      [new UserMessage('extract')],
      z.object({ tags: z.record(z.string(), z.number()) }) as any
    );

    const request = anthropicMock.anthropicCreateMock.mock.calls[0]?.[0] ?? {};
    expect(request.output_config).toBeUndefined();
    expect(request.tools[0].name).toBe('response');
    expect(result.completion).toEqual({ tags: { a: 1 } });
  });

  it('fails loudly when native structured output is not JSON', async () => {
    anthropicMock.anthropicCreateMock.mockResolvedValue(
      buildResponse([{ type: 'text', text: 'sorry, no' }])
    );
    const llm = new ChatAnthropic({ model: 'claude-sonnet-5' });

    await expect(
      llm.ainvoke(
        [new UserMessage('judge')],
        z.object({ value: z.string() }) as any
      )
    ).rejects.toMatchObject({
      name: 'ModelProviderError',
      message: expect.stringContaining(
        'Native structured output was not valid JSON'
      ),
    });
  });
});
