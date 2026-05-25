import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const responsesCreateMock = vi.fn();
const openaiCtorMock = vi.fn();

vi.mock('openai', () => {
  class OpenAI {
    responses = {
      create: responsesCreateMock,
    };

    constructor(options?: unknown) {
      openaiCtorMock(options);
    }
  }
  return { default: OpenAI };
});

import { ChatCodex } from '../src/llm/codex/chat.js';
import { saveCodexTokens } from '../src/llm/codex/auth.js';
import { SystemMessage, UserMessage } from '../src/llm/messages.js';
import {
  ModelProviderError,
  ModelRateLimitError,
} from '../src/llm/exceptions.js';

const tempDirs: string[] = [];

const makeTempDir = async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'browser-use-codex-'));
  tempDirs.push(dir);
  return dir;
};

const b64url = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

const makeJwt = (
  claims: Record<string, unknown> = {
    exp: Math.floor(Date.now() / 1000) + 3600,
  }
) => `${b64url({ alg: 'RS256' })}.${b64url(claims)}.sig`;

const buildResponse = (text: string) => ({
  output_text: text,
  status: 'completed',
  usage: {
    input_tokens: 10,
    output_tokens: 5,
    total_tokens: 15,
    input_tokens_details: { cached_tokens: 3 },
  },
});

const jsonResponse = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('ChatCodex', () => {
  beforeEach(() => {
    responsesCreateMock.mockReset();
    openaiCtorMock.mockReset();
    responsesCreateMock.mockResolvedValue(buildResponse('ok'));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(
      tempDirs
        .splice(0)
        .map((dir) => fs.rm(dir, { recursive: true, force: true }))
    );
  });

  it('uses Responses API with Codex defaults and Cloudflare headers', async () => {
    const token = makeJwt({
      exp: Math.floor(Date.now() / 1000) + 3600,
      'https://api.openai.com/auth': {
        chatgpt_account_id: 'acct-123',
      },
    });
    const llm = new ChatCodex({
      model: 'gpt-5.1-codex',
      apiKey: token,
      reasoningEffort: 'medium',
      maxCompletionTokens: 2048,
      defaultHeaders: { 'x-extra': '1' },
    });

    const result = await llm.ainvoke([new UserMessage('hello')]);

    expect(result.completion).toBe('ok');
    expect(result.usage).toMatchObject({
      prompt_tokens: 10,
      prompt_cached_tokens: 3,
      completion_tokens: 5,
      total_tokens: 15,
    });
    expect(openaiCtorMock.mock.calls[0]?.[0]).toMatchObject({
      apiKey: token,
      baseURL: 'https://chatgpt.com/backend-api/codex',
      defaultHeaders: {
        originator: 'codex_cli_rs',
        'ChatGPT-Account-ID': 'acct-123',
        'x-extra': '1',
      },
    });
    const request = responsesCreateMock.mock.calls[0]?.[0] ?? {};
    expect(request).toMatchObject({
      model: 'gpt-5.1-codex',
      store: false,
      reasoning: { effort: 'medium' },
      input: [{ role: 'user', content: 'hello' }],
    });
    expect(request).not.toHaveProperty('max_output_tokens');
  });

  it('keeps max output tokens for custom Responses-compatible endpoints', async () => {
    const llm = new ChatCodex({
      apiKey: 'opaque-token',
      baseURL: 'https://responses.example.test/v1',
      maxCompletionTokens: 2048,
    });

    await llm.ainvoke([new UserMessage('hello')]);

    const request = responsesCreateMock.mock.calls[0]?.[0] ?? {};
    expect(request.max_output_tokens).toBe(2048);
  });

  it('uses Responses JSON schema format for zod structured output', async () => {
    responsesCreateMock.mockResolvedValue(
      buildResponse(JSON.stringify({ items: ['alpha'] }))
    );
    const schema = z.object({
      items: z.array(z.string()).min(1).default(['seed']),
    });
    const llm = new ChatCodex({
      apiKey: 'opaque-token',
      addSchemaToSystemPrompt: true,
      removeMinItemsFromSchema: true,
      removeDefaultsFromSchema: true,
    });

    const response = await llm.ainvoke(
      [new SystemMessage('system'), new UserMessage('user')],
      schema as any
    );

    const request = responsesCreateMock.mock.calls[0]?.[0] ?? {};
    expect(request.text?.format?.type).toBe('json_schema');
    expect(JSON.stringify(request.text?.format?.schema)).not.toContain(
      'minItems'
    );
    expect(JSON.stringify(request.text?.format?.schema)).not.toContain(
      '"default"'
    );
    expect(request.input?.[0]?.content).toContain('<json_schema>');
    expect((response.completion as any).items).toEqual(['alpha']);
  });

  it('resolves browser-use Codex auth and retries once after 401 refresh', async () => {
    const configDir = await makeTempDir();
    const oldToken = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
    await saveCodexTokens(
      { access_token: oldToken, refresh_token: 'old-refresh' },
      { configDir }
    );
    responsesCreateMock
      .mockRejectedValueOnce({ status: 401, message: 'expired' })
      .mockResolvedValueOnce(buildResponse('after-refresh'));
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        access_token: 'new-access',
        refresh_token: 'new-refresh',
      })
    );
    const llm = new ChatCodex({
      configDir,
      fetchImplementation: fetchMock as typeof fetch,
    });

    const result = await llm.ainvoke([new UserMessage('hello')]);

    expect(result.completion).toBe('after-refresh');
    expect(responsesCreateMock).toHaveBeenCalledTimes(2);
    expect(openaiCtorMock.mock.calls[0]?.[0]).toMatchObject({
      apiKey: oldToken,
    });
    expect(openaiCtorMock.mock.calls[1]?.[0]).toMatchObject({
      apiKey: 'new-access',
    });
  });

  it('raises ModelRateLimitError for 429 responses', async () => {
    responsesCreateMock.mockRejectedValueOnce({
      status: 429,
      message: 'rate limited',
    });
    const llm = new ChatCodex({ apiKey: 'token' });

    await expect(
      llm.ainvoke([new UserMessage('hello')])
    ).rejects.toBeInstanceOf(ModelRateLimitError);
  });

  it('does not refresh Codex auth after 403 responses', async () => {
    const configDir = await makeTempDir();
    const token = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
    await saveCodexTokens(
      { access_token: token, refresh_token: 'refresh' },
      { configDir }
    );
    responsesCreateMock.mockRejectedValueOnce({
      status: 403,
      message: 'cloudflare challenge',
    });
    const fetchMock = vi.fn();
    const llm = new ChatCodex({
      configDir,
      fetchImplementation: fetchMock as typeof fetch,
    });

    await expect(
      llm.ainvoke([new UserMessage('hello')])
    ).rejects.toBeInstanceOf(ModelProviderError);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(responsesCreateMock).toHaveBeenCalledTimes(1);
  });

  it('extracts output text from response output content fallback', async () => {
    responsesCreateMock.mockResolvedValue({
      output: [
        {
          content: [{ type: 'output_text', text: 'fallback text' }],
        },
      ],
    });
    const llm = new ChatCodex({ apiKey: 'token' });

    const response = await llm.ainvoke([new UserMessage('hello')]);

    expect(response.completion).toBe('fallback text');
  });
});
