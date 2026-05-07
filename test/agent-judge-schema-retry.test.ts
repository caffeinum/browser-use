import { describe, expect, it, vi } from 'vitest';
import type { BaseChatModel } from '../src/llm/base.js';
import { Agent } from '../src/agent/service.js';
import { BrowserStateHistory } from '../src/browser/views.js';
import { ActionResult, AgentHistory } from '../src/agent/views.js';

// Builds an LLM whose ainvoke yields each completion in `completions` once,
// and repeats the last completion thereafter. Captures every call for
// assertion: `ainvoke.mock.calls[i][0]` is the message array sent on call i.
const createSequencedLlm = (completions: string[]) => {
  let callIdx = 0;
  const ainvoke = vi.fn(async () => {
    const completion = completions[Math.min(callIdx, completions.length - 1)];
    callIdx += 1;
    return { completion, usage: null };
  });
  const llm = {
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
    ainvoke,
  } as unknown as BaseChatModel;
  return { llm, ainvoke };
};

const seedDoneSuccess = (agent: Agent) => {
  agent.history.add_item(
    new AgentHistory(
      null,
      [
        new ActionResult({
          is_done: true,
          success: true,
          extracted_content: 'Result body',
        }),
      ],
      new BrowserStateHistory('https://example.com', 'Example', [], [], null),
      null
    )
  );
};

describe('Agent simple judge schema-retry behavior (bu-2-0 parity)', () => {
  it('retries with prettified zod feedback when is_correct is missing, then succeeds', async () => {
    // First response simulates bu-2-0: omits `is_correct` entirely.
    // Second response is a valid simple-judge payload.
    const { llm, ainvoke } = createSequencedLlm([
      '{"reason": "I think it looks fine"}',
      '{"is_correct": false, "reason": "Actually missing required fields"}',
    ]);
    const agent = new Agent({ task: 'Extract 5 rows', llm });
    try {
      seedDoneSuccess(agent);

      await (agent as any)._run_simple_judge();

      expect(ainvoke).toHaveBeenCalledTimes(2);

      // Second call must include feedback turns appended after the original
      // system+user pair: an assistant echo + a user feedback message
      // referencing the schema validation failure.
      const secondCallMessages = ainvoke.mock.calls[1]?.[0] as any[];
      expect(secondCallMessages.length).toBeGreaterThanOrEqual(4);
      const feedbackUser = secondCallMessages[secondCallMessages.length - 1];
      const feedbackText: string =
        typeof feedbackUser.content === 'string'
          ? feedbackUser.content
          : (feedbackUser.text ?? '');
      expect(feedbackText).toContain('schema validation');
      expect(feedbackText).toContain('is_correct');

      // Override applied based on the second (valid) response.
      const finalResult = agent.history.history[0].result[0];
      expect(finalResult.success).toBe(false);
      expect(finalResult.extracted_content).toContain(
        '[Simple judge: Actually missing required fields]'
      );
    } finally {
      await agent.close();
    }
  });

  it('marks run as failed with schema-error note when retries exhaust', async () => {
    // Every response is invalid (missing is_correct) → all 3 attempts fail.
    const { llm, ainvoke } = createSequencedLlm([
      '{"reason": "first invalid"}',
      '{"reason": "second invalid"}',
      '{"reason": "third invalid"}',
    ]);
    const agent = new Agent({ task: 'Extract 5 rows', llm });
    try {
      seedDoneSuccess(agent);

      // Should not throw — schema-invalid surfaces via lastResult instead so
      // harbor reads it from failure_reason without crashing the run.
      await (agent as any)._run_simple_judge();

      expect(ainvoke).toHaveBeenCalledTimes(3); // 1 initial + 2 retries

      const finalResult = agent.history.history[0].result[0];
      expect(finalResult.success).toBe(false);
      expect(finalResult.extracted_content).toContain('Judge schema invalid');
      expect(finalResult.extracted_content).toContain('simple_judge');
      expect(finalResult.extracted_content).toContain('is_correct');
    } finally {
      await agent.close();
    }
  });

  it('swallows non-schema errors (e.g. network) per prior behavior', async () => {
    const ainvoke = vi.fn(async () => {
      throw new Error('ECONNRESET: socket hang up');
    });
    const llm = {
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
      ainvoke,
    } as unknown as BaseChatModel;
    const agent = new Agent({ task: 'Extract 5 rows', llm });
    try {
      seedDoneSuccess(agent);

      // Should not throw — transient errors stay swallowed so a flaky judge
      // call doesn't tank an otherwise-successful run.
      await (agent as any)._run_simple_judge();

      const finalResult = agent.history.history[0].result[0];
      expect(finalResult.success).toBe(true);
      expect(ainvoke).toHaveBeenCalledTimes(1);
    } finally {
      await agent.close();
    }
  });
});

describe('Agent full judge (_judge_trace) schema-retry behavior', () => {
  it('synthesizes verdict=false judgement when retries exhaust', async () => {
    // bu-2-0 omits `verdict` — invalid for full JudgeSchema, all attempts fail.
    const { llm: judgeLlm, ainvoke: judgeInvoke } = createSequencedLlm([
      '{"reasoning": "ok", "failure_reason": ""}',
      '{"reasoning": "still ok", "failure_reason": ""}',
      '{"reasoning": "really ok", "failure_reason": ""}',
    ]);
    const { llm: mainLlm } = createSequencedLlm(['{"is_correct": true}']);
    const agent = new Agent({
      task: 'Verify',
      llm: mainLlm,
      judge_llm: judgeLlm,
      use_judge: true,
    });
    try {
      seedDoneSuccess(agent);

      const judgement = await (agent as any)._judge_trace();
      expect(judgeInvoke).toHaveBeenCalledTimes(3);
      expect(judgement).not.toBeNull();
      expect(judgement.verdict).toBe(false);
      expect(judgement.failure_reason).toContain('Judge schema invalid');
      expect(judgement.failure_reason).toContain('verdict');
    } finally {
      await agent.close();
    }
  });

  it('returns valid judgement when retry self-corrects', async () => {
    const { llm: judgeLlm, ainvoke: judgeInvoke } = createSequencedLlm([
      '{"reasoning": "missing verdict", "failure_reason": ""}',
      JSON.stringify({
        reasoning: 'recovered',
        verdict: false,
        failure_reason: 'Missing required field',
        impossible_task: false,
        reached_captcha: false,
      }),
    ]);
    const { llm: mainLlm } = createSequencedLlm(['{"is_correct": true}']);
    const agent = new Agent({
      task: 'Verify',
      llm: mainLlm,
      judge_llm: judgeLlm,
      use_judge: true,
    });
    try {
      seedDoneSuccess(agent);

      const judgement = await (agent as any)._judge_trace();
      expect(judgement).toMatchObject({
        verdict: false,
        failure_reason: 'Missing required field',
      });
      expect(judgeInvoke).toHaveBeenCalledTimes(2);
    } finally {
      await agent.close();
    }
  });
});
