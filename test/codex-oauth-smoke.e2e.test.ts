import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Agent } from '../src/agent/service.js';
import { BrowserProfile } from '../src/browser/profile.js';
import { runAuthCommand } from '../src/cli.js';
import {
  getCodexAuthStatus,
  resolveCodexRuntimeCredentials,
} from '../src/llm/codex/auth.js';
import { ChatCodex } from '../src/llm/codex/chat.js';
import { UserMessage } from '../src/llm/messages.js';

const RUN_CODEX_E2E = process.env.BROWSER_USE_CODEX_E2E === '1';
const RUN_AGENT_E2E = process.env.BROWSER_USE_CODEX_E2E_AGENT === '1';
const CODEX_E2E_TIMEOUT_MS = Number.parseInt(
  process.env.BROWSER_USE_CODEX_E2E_TIMEOUT_MS ?? '90000',
  10
);
const CODEX_MODEL =
  process.env.BROWSER_USE_CODEX_E2E_MODEL ??
  process.env.BROWSER_USE_CODEX_MODEL ??
  'gpt-5.5';

const tempDirs: string[] = [];

const makeTempDir = async () => {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'browser-use-codex-e2e-')
  );
  tempDirs.push(dir);
  return dir;
};

const createCodexLlm = () =>
  new ChatCodex({
    model: CODEX_MODEL,
    timeout: CODEX_E2E_TIMEOUT_MS,
    maxRetries: 0,
    reasoningEffort: 'low',
  });

const requireCodexAuth = async () => {
  const status = await getCodexAuthStatus();
  if (!status.authenticated) {
    throw new Error(
      [
        'Codex OAuth smoke E2E requires local browser-use Codex auth.',
        'Run `pnpm build && node dist/cli.js auth codex login` first.',
        status.error?.message ? `Auth error: ${status.error.message}` : null,
      ]
        .filter(Boolean)
        .join(' ')
    );
  }
  return status;
};

const codexDescribe = RUN_CODEX_E2E ? describe : describe.skip;
const agentIt = RUN_AGENT_E2E ? it : it.skip;

codexDescribe('Codex OAuth local smoke e2e', () => {
  beforeAll(async () => {
    await requireCodexAuth();
  }, 30000);

  afterEach(async () => {
    await Promise.all(
      tempDirs
        .splice(0)
        .map((dir) => fs.rm(dir, { recursive: true, force: true }))
    );
    vi.restoreAllMocks();
  });

  it('reports authenticated state through auth store and CLI JSON path', async () => {
    const status = await requireCodexAuth();
    const credentials = await resolveCodexRuntimeCredentials();
    let output = '';
    let errorOutput = '';

    const exitCode = await runAuthCommand(['codex', 'status', '--json'], {
      stdout: { write: (chunk: string) => (output += chunk) },
      stderr: { write: (chunk: string) => (errorOutput += chunk) },
    });

    expect(exitCode).toBe(0);
    expect(errorOutput).toBe('');
    expect(JSON.parse(output)).toMatchObject({
      authenticated: true,
      provider: 'openai-codex',
    });
    expect(status.auth_store_path).toMatch(/auth\.json$/);
    expect(credentials.provider).toBe('openai-codex');
    expect(credentials.api_key.trim().length).toBeGreaterThan(20);
    expect(credentials.base_url).toContain('/backend-api/codex');
  }, 30000);

  it(
    'invokes Codex Responses API with a plain text completion',
    async () => {
      const llm = createCodexLlm();

      const result = await llm.ainvoke([
        new UserMessage(
          'You are running a browser-use smoke test. Reply with exactly: browser-use-codex-smoke-ok'
        ),
      ]);

      expect(String(result.completion).toLowerCase()).toContain(
        'browser-use-codex-smoke-ok'
      );
      expect(result.stop_reason).toBeTruthy();
    },
    CODEX_E2E_TIMEOUT_MS + 15000
  );

  it(
    'invokes Codex Responses API with structured output',
    async () => {
      const llm = createCodexLlm();
      const schema = z.object({
        status: z.literal('ok'),
        provider: z.literal('codex'),
        checks: z.array(z.enum(['auth', 'responses', 'schema'])).min(3),
      });

      const result = await llm.ainvoke(
        [
          new UserMessage(
            'Return JSON matching the schema with status ok, provider codex, and checks auth, responses, schema.'
          ),
        ],
        schema
      );

      expect(result.completion).toEqual({
        status: 'ok',
        provider: 'codex',
        checks: ['auth', 'responses', 'schema'],
      });
    },
    CODEX_E2E_TIMEOUT_MS + 15000
  );

  agentIt(
    'runs a one-step Agent and emits monitoring events with Codex',
    async () => {
      const tempDir = await makeTempDir();
      const agent = new Agent({
        task: [
          'Do not navigate.',
          'Immediately call the done action with success=true.',
          'The final text must include browser-use-codex-agent-smoke-ok.',
        ].join(' '),
        llm: createCodexLlm(),
        browser_profile: new BrowserProfile({
          headless: true,
          user_data_dir: path.join(tempDir, 'profile'),
          enable_default_extensions: false,
        }),
        file_system_path: path.join(tempDir, 'files'),
        use_vision: false,
        use_judge: false,
        enable_planning: false,
        message_compaction: false,
        max_actions_per_step: 1,
        max_failures: 1,
        generate_gif: false,
        calculate_cost: false,
        source: 'codex-oauth-smoke-e2e',
        llm_timeout: Math.ceil(CODEX_E2E_TIMEOUT_MS / 1000),
        step_timeout: Math.ceil(CODEX_E2E_TIMEOUT_MS / 1000),
      });
      const dispatchSpy = vi.spyOn(agent.eventbus, 'dispatch');

      try {
        const history = await agent.run(1);
        const eventTypes = dispatchSpy.mock.calls.map(
          ([event]) => (event as any)?.event_type
        );

        expect(history.is_done()).toBe(true);
        expect(history.is_successful()).toBe(true);
        expect(history.final_result()).toContain(
          'browser-use-codex-agent-smoke-ok'
        );
        expect(eventTypes).toContain('CreateAgentSessionEvent');
        expect(eventTypes).toContain('CreateAgentTaskEvent');
        expect(eventTypes).toContain('CreateAgentStepEvent');
      } finally {
        await agent.close();
      }
    },
    CODEX_E2E_TIMEOUT_MS + 60000
  );
});
