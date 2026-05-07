import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Agent } from '../src/agent/service.js';
import { ActionResult } from '../src/agent/views.js';
import { Controller } from '../src/controller/service.js';
import type { BaseChatModel } from '../src/llm/base.js';

const createLlm = (): BaseChatModel =>
  ({
    model: 'gpt-test',
    get provider() {
      return 'test';
    },
    get name() {
      return 'test';
    },
    get model_name() {
      return 'gpt-test';
    },
    ainvoke: vi.fn(async () => ({ completion: 'ok', usage: null })),
  }) as unknown as BaseChatModel;

describe('zod validation error feedback to LLM', () => {
  it('throws an error containing prettified zod issues + the bad params on schema mismatch', async () => {
    const controller = new Controller();
    controller.registry.action('Scroll the page', {
      param_model: z.object({
        down: z.boolean().default(true),
        num_pages: z.number().default(1),
      }),
    })(async function scroll() {
      return new ActionResult({});
    });

    const agent = new Agent({
      task: 'reproduce zod schema mismatch',
      llm: createLlm(),
      controller,
    });

    try {
      const badAction = { scroll: { num_pages: true } };
      expect(() =>
        (agent as any)._validateAndNormalizeActions([badAction])
      ).toThrow(/Schema validation failed for action 'scroll'/);

      let captured: Error | null = null;
      try {
        (agent as any)._validateAndNormalizeActions([badAction]);
      } catch (e) {
        captured = e as Error;
      }
      expect(captured).not.toBeNull();
      const msg = captured!.message;
      // Pretty-printed zod path (not raw JSON dump of issues array).
      expect(msg).toContain('num_pages');
      expect(msg).toContain('expected number');
      expect(msg).toContain('received boolean');
      // Echo of what the LLM sent — so it can self-correct.
      expect(msg).toContain('"num_pages":true');
      // Corrective hint.
      expect(msg).toMatch(/retry with parameters/i);
      // Guard: should NOT be the raw zod-issues JSON dump.
      expect(msg).not.toContain('"code":"invalid_type"');
    } finally {
      await agent.close();
    }
  });

  it('error feeds into next prompt via state.last_result (existing pipeline)', async () => {
    const controller = new Controller();
    controller.registry.action('Scroll the page', {
      param_model: z.object({
        num_pages: z.number().default(1),
      }),
    })(async function scroll() {
      return new ActionResult({});
    });

    const agent = new Agent({
      task: 'verify error reaches state.last_result',
      llm: createLlm(),
      controller,
    });

    try {
      const badAction = { scroll: { num_pages: 'three' } };
      let thrown: Error | null = null;
      try {
        (agent as any)._validateAndNormalizeActions([badAction]);
      } catch (e) {
        thrown = e as Error;
      }
      expect(thrown).not.toBeNull();
      // Simulate the agent loop's catch: this is exactly what
      // `_handle_step_error` does with the thrown error.
      (agent as any).state.last_result = [
        new ActionResult({ error: thrown!.message }),
      ];

      const errorOnState = (agent as any).state.last_result[0]
        .error as string;
      expect(errorOnState).toContain('Schema validation failed');
      expect(errorOnState).toContain('num_pages');
    } finally {
      await agent.close();
    }
  });
});
