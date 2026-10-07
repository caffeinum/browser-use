import { describe, expect, it, vi } from 'vitest';
import type { BaseChatModel } from '../src/llm/base.js';
import { Agent } from '../src/agent/service.js';
import { BrowserStateHistory } from '../src/browser/views.js';
import { ActionResult, AgentHistory } from '../src/agent/views.js';
import { construct_simple_judge_messages } from '../src/agent/judge.js';

const createLlm = (completion: string) => {
  const ainvoke = vi.fn(async () => ({ completion, usage: null }));
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

const addDoneSuccess = (agent: Agent, extracted_content: string) => {
  agent.history.add_item(
    new AgentHistory(
      null,
      [new ActionResult({ is_done: true, success: true, extracted_content })],
      new BrowserStateHistory('https://example.com', 'Example', [], [], null),
      null
    )
  );
};

describe('Agent simple judge alignment', () => {
  it('injects current_date into simple judge prompt with c011 wording', () => {
    const messages = construct_simple_judge_messages({
      task: 'Check latest stock close price',
      final_result: 'AAPL closed at 199.10',
      current_date: '2026-02-10',
    });

    const systemPrompt = (messages[0] as any)?.text ?? '';
    expect(systemPrompt).toContain("Today's date is 2026-02-10.");
    expect(systemPrompt).toContain(
      "dates and times close to today's date (2026-02-10) are NOT fabricated"
    );
  });

  it('falls back to no-task/no-response placeholders in simple judge prompts', () => {
    const messages = construct_simple_judge_messages({
      task: '',
      final_result: '',
      current_date: '2026-02-10',
    });

    const userPrompt = (messages[1] as any)?.text ?? '';
    expect(userPrompt).toContain('No task provided');
    expect(userPrompt).toContain('No response provided');
  });

  it('overrides done success when simple judge rejects final response', async () => {
    const { llm, ainvoke } = createLlm(
      '{"is_correct": false, "reason": "Missing required fields"}'
    );
    const agent = new Agent({
      task: 'Extract 5 rows as JSON',
      llm,
      use_simple_judge: true,
    });
    try {
      agent.history.add_item(
        new AgentHistory(
          null,
          [
            new ActionResult({
              is_done: true,
              success: true,
              extracted_content: 'Only extracted 2 rows',
            }),
          ],
          new BrowserStateHistory(
            'https://example.com',
            'Example',
            [],
            [],
            null
          ),
          null
        )
      );

      await (agent as any)._run_simple_judge();

      const finalResult = agent.history.history[0].result[0];
      expect(finalResult.success).toBe(false);
      expect(finalResult.extracted_content).toContain(
        '[Simple judge: Missing required fields]'
      );
      expect(ainvoke).toHaveBeenCalledTimes(1);
    } finally {
      await agent.close();
    }
  });

  it('skips simple judge when final result is not done success', async () => {
    const { llm, ainvoke } = createLlm(
      '{"is_correct": false, "reason": "Should not be used"}'
    );
    const agent = new Agent({
      task: 'Extract rows',
      llm,
      use_simple_judge: true,
    });
    try {
      agent.history.add_item(
        new AgentHistory(
          null,
          [
            new ActionResult({
              is_done: true,
              success: false,
              extracted_content: 'Task failed',
            }),
          ],
          new BrowserStateHistory(
            'https://example.com',
            'Example',
            [],
            [],
            null
          ),
          null
        )
      );

      await (agent as any)._run_simple_judge();

      expect(ainvoke).not.toHaveBeenCalled();
      expect(agent.history.history[0].result[0].success).toBe(false);
    } finally {
      await agent.close();
    }
  });
  it('does not run simple judge unless use_simple_judge is enabled', async () => {
    const { llm, ainvoke } = createLlm(
      '{"is_correct": false, "reason": "Should not be used"}'
    );
    const agent = new Agent({ task: 'Extract rows', llm });
    try {
      addDoneSuccess(agent, 'Extracted rows');

      await (agent as any)._run_simple_judge();

      expect(ainvoke).not.toHaveBeenCalled();
      const finalResult = agent.history.history[0].result[0];
      expect(finalResult.success).toBe(true);
      expect(finalResult.extracted_content).toBe('Extracted rows');
    } finally {
      await agent.close();
    }
  });

  it('keeps structured output intact when simple judge rejects with output_model_schema', async () => {
    const { llm } = createLlm(
      '{"is_correct": false, "reason": "Missing required fields"}'
    );
    const outputSchema = {
      name: 'ResultSchema',
      parse: (input: string) => JSON.parse(input),
      model_json_schema: () => ({
        type: 'object',
        properties: { answer: { type: 'string' } },
      }),
    };
    const agent = new Agent({
      task: 'Extract the answer',
      llm,
      use_simple_judge: true,
      output_model_schema: outputSchema as any,
    });
    try {
      addDoneSuccess(agent, '{"answer":"42"}');

      await (agent as any)._run_simple_judge();

      const finalResult = agent.history.history[0].result[0];
      expect(finalResult.success).toBe(false);
      expect(finalResult.extracted_content).toBe('{"answer":"42"}');
      expect(JSON.parse(finalResult.extracted_content!)).toEqual({
        answer: '42',
      });
    } finally {
      await agent.close();
    }
  });
});
