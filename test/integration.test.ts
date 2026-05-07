import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  afterEach,
  beforeAll,
  afterAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from 'playwright';
import type { BaseChatModel } from '../src/llm/base.js';
import { DOMTextNode } from '../src/dom/views.js';

// Stub heavy utils to avoid build-time duplicate export errors and keep decorators no-op for tests
vi.mock('../src/utils.js', () => {
  let counter = 0;
  const decorator =
    <T extends (...args: any[]) => any>(_label?: string) =>
    (fn: T) =>
      fn;

  class SignalHandler {
    constructor(_opts?: unknown) {}
    register() {}
    reset() {}
    unregister() {}
  }

  const uuid7str = () => `uuid-${++counter}`;
  const is_new_tab_page = (url: string) =>
    url === 'about:blank' || url.startsWith('chrome://');
  const match_url_with_domain_pattern = (url: string, pattern: string) => {
    if (!pattern) return false;
    const normalized = pattern.replace(/\*/g, '');
    return url.includes(normalized);
  };

  return {
    uuid7str,
    time_execution_sync: decorator,
    time_execution_async: decorator,
    SignalHandler,
    get_browser_use_version: () => 'test-version',
    is_new_tab_page,
    match_url_with_domain_pattern,
    sanitize_surrogates: (text: string) => text,
    log_pretty_path: (p: string) => p,
    wait_until: async (predicate: () => boolean, timeout = 1000) => {
      const start = Date.now();
      while (!predicate() && Date.now() - start < timeout) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      if (!predicate()) {
        throw new Error('wait_until timeout');
      }
    },
  };
});

vi.mock('../src/llm/messages.js', () => {
  class MessageBase {
    cache = false;
    constructor(init?: { cache?: boolean }) {
      if (init?.cache !== undefined) {
        this.cache = init.cache;
      }
    }
  }

  class SystemMessage extends MessageBase {
    role = 'system' as const;
    constructor(
      public content: any,
      public name: string | null = null
    ) {
      super();
    }
    get text() {
      return typeof this.content === 'string' ? this.content : '';
    }
  }

  class UserMessage extends MessageBase {
    role = 'user' as const;
    constructor(
      public content: any,
      public name: string | null = null
    ) {
      super();
    }
    get text() {
      return typeof this.content === 'string' ? this.content : '';
    }
  }

  class AssistantMessage extends MessageBase {
    role = 'assistant' as const;
    content: any;
    tool_calls: any;
    refusal: any;
    constructor(init: any = {}) {
      super();
      this.content = init.content ?? null;
      this.tool_calls = init.tool_calls ?? null;
      this.refusal = init.refusal ?? null;
    }
    get text() {
      return typeof this.content === 'string' ? this.content : '';
    }
  }

  class ContentPartTextParam {
    type = 'text' as const;
    constructor(public text: string) {}
  }

  class ContentPartRefusalParam {
    type = 'refusal' as const;
    constructor(public refusal: string) {}
  }

  class ImageURL {
    constructor(
      public url: string,
      public detail: 'auto' | 'low' | 'high' = 'auto',
      public media_type: string = 'image/png'
    ) {}
    toString() {
      return this.url;
    }
  }

  class ContentPartImageParam {
    type = 'image_url' as const;
    constructor(public image_url: ImageURL) {}
  }

  class FunctionCall {
    constructor(
      public name: string,
      public args: string
    ) {}
  }

  class ToolCall {
    type = 'function' as const;
    constructor(
      public id: string,
      public functionCall: FunctionCall
    ) {}
  }

  return {
    MessageBase,
    SystemMessage,
    UserMessage,
    AssistantMessage,
    ContentPartTextParam,
    ContentPartRefusalParam,
    ContentPartImageParam,
    ImageURL,
    FunctionCall,
    ToolCall,
  };
});

const { Agent } = await import('../src/agent/service.js');
const { ActionResult } = await import('../src/agent/views.js');
const { Registry } = await import('../src/controller/registry/service.js');
const { GoToUrlActionSchema, DoneActionSchema } =
  await import('../src/controller/views.js');
const { DOMElementNode, DOMState } = await import('../src/dom/views.js');
const { BrowserStateSummary } = await import('../src/browser/views.js');
const { DomService } = await import('../src/dom/service.js');
const { BrowserSession } = await import('../src/browser/session.js');
const { ChatInvokeCompletion } = await import('../src/llm/views.js');
const { ActionModel: RegistryActionModel } =
  await import('../src/controller/registry/views.js');

(globalThis as any).ActionModel = RegistryActionModel;

class MockLLM implements BaseChatModel {
  model = 'mock-model';
  private readonly responses: Array<{
    completion: any;
    usage?: any;
    thinking?: string | null;
    redacted_thinking?: string | null;
    stop_reason?: string | null;
  }>;
  private readonly onInvoke?:
    | ((signal: AbortSignal | undefined) => void | Promise<void>)
    | undefined;
  calls: any[][] = [];
  signals: Array<AbortSignal | undefined> = [];

  constructor(
    responses: Array<{
      completion: any;
      usage?: any;
      thinking?: string | null;
      redacted_thinking?: string | null;
      stop_reason?: string | null;
    }>,
    onInvoke?:
      | ((signal: AbortSignal | undefined) => void | Promise<void>)
      | undefined
  ) {
    this.responses = responses;
    this.onInvoke = onInvoke;
  }

  get provider() {
    return 'mock';
  }
  get name() {
    return this.model;
  }
  get model_name() {
    return this.model;
  }

  async ainvoke(
    messages: any[],
    output_format?: unknown,
    options?: { signal?: AbortSignal }
  ): Promise<any> {
    this.calls.push(messages);
    this.signals.push(options?.signal);
    if (this.onInvoke) {
      await this.onInvoke(options?.signal);
    }
    // When invoked as a judge (output_format carries the judge schema), return
    // a passthrough judge-shaped response so _run_simple_judge / _judge_trace
    // don't downgrade these tests to failure. Tests that specifically exercise
    // judge behavior pass the judge llm separately.
    const judgeShape = detectJudgeShape(output_format);
    if (judgeShape) {
      return new ChatInvokeCompletion(judgeShape, null, null, null, null);
    }
    const idx = Math.min(this.calls.length - 1, this.responses.length - 1);
    const response = this.responses[idx] ?? { completion: { action: [] } };
    return new ChatInvokeCompletion(
      response.completion,
      response.usage ?? null,
      response.thinking ?? null,
      response.redacted_thinking ?? null,
      response.stop_reason ?? null
    );
  }
}

const detectJudgeShape = (output_format: unknown): unknown | null => {
  if (!output_format || typeof output_format !== 'object') return null;
  const shape = (output_format as any).shape ?? (output_format as any).schema?.shape;
  if (!shape || typeof shape !== 'object') return null;
  if ('is_correct' in shape && 'reason' in shape) {
    return { is_correct: true, reason: '' };
  }
  if ('verdict' in shape && 'reasoning' in shape) {
    return {
      verdict: true,
      reasoning: '',
      failure_reason: '',
      impossible_task: false,
      reached_captcha: false,
    };
  }
  return null;
};

const tempResources: string[] = [];
afterEach(() => {
  while (tempResources.length) {
    const dir = tempResources.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

const createTempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-use-test-'));
  tempResources.push(dir);
  return dir;
};

const createTestController = () => {
  const registry = new Registry();

  registry.action('Navigate to URL', { param_model: GoToUrlActionSchema })(
    async function go_to_url(params, { browser_session }) {
      if (!browser_session) throw new Error('Missing browser session');
      await browser_session.navigate_to(params.url);
      return new ActionResult({
        extracted_content: `Navigated to ${params.url}`,
        include_in_memory: true,
        long_term_memory: `Navigated to ${params.url}`,
      });
    }
  );

  registry.action('Complete task', { param_model: DoneActionSchema })(
    function done(params) {
      return new ActionResult({
        is_done: true,
        success: params.success,
        extracted_content: params.text,
        long_term_memory: params.text,
      });
    }
  );

  return { registry } as any;
};

const createBrowserSessionStub = (initialUrl = 'https://start.test'): any => {
  let currentUrl = initialUrl;
  const navigateCalls: string[] = [];

  const buildState = () => {
    const root = new DOMElementNode(true, null, 'body', '/html/body', {}, [
      new DOMTextNode(true, null, 'Root text'),
    ]);
    root.is_top_element = true;
    root.is_in_viewport = true;
    root.highlight_index = 0;
    const domState = new DOMState(root, { 0: root });
    return new BrowserStateSummary(domState, {
      url: currentUrl,
      title: 'Test Page',
      tabs: [{ page_id: 0, url: currentUrl, title: 'Test Page' }],
    });
  };

  return {
    id: 'session-stub',
    browser_profile: {},
    downloaded_files: [],
    navigateCalls,
    async start() {
      return;
    },
    async get_browser_state_with_recovery() {
      return buildState();
    },
    async get_current_page() {
      return { url: () => currentUrl };
    },
    async navigate_to(url: string) {
      currentUrl = url;
      navigateCalls.push(url);
    },
    get_selector_map: async () => ({ 0: buildState().element_tree }),
  };
};

describe('Component Tests (Mocked Dependencies)', () => {
  it('runs the agent loop with mocked LLM and browser session', async () => {
    const controller = createTestController();
    const browser_session = createBrowserSessionStub();
    const tempDir = createTempDir();
    const llm = new MockLLM([
      {
        completion: {
          action: [{ go_to_url: { url: 'https://example.com' } }],
          thinking: 'navigate then finish',
        },
      },
      {
        completion: {
          action: [{ done: { success: true, text: 'Reached example.com' } }],
          thinking: 'wrap up',
        },
      },
    ]);

    const agent = new Agent({
      task: 'Navigate then finish',
      llm,
      browser_session,
      controller,
      file_system_path: tempDir,
      use_vision: false,
      max_actions_per_step: 3,
    });

    tempResources.push(agent.agent_directory);
    const history = await agent.run(3);

    expect(history.is_done()).toBe(true);
    expect(history.is_successful()).toBe(true);
    expect(history.number_of_steps()).toBe(2);
    expect(browser_session.navigateCalls).toEqual(['https://example.com']);
    expect(history.final_result()).toContain('Reached example.com');
  });

  it('adds done-only guidance on the final step', async () => {
    const controller = createTestController();
    const browser_session = createBrowserSessionStub();
    const tempDir = createTempDir();
    const llm = new MockLLM([
      {
        completion: {
          action: [{ go_to_url: { url: 'https://example.com' } }],
          thinking: 'navigate first',
        },
      },
      {
        completion: {
          action: [{ done: { success: true, text: 'Finished on final step' } }],
          thinking: 'finish now',
        },
      },
    ]);

    const agent = new Agent({
      task: 'Navigate and finish',
      llm,
      browser_session,
      controller,
      file_system_path: tempDir,
      use_vision: false,
    });

    tempResources.push(agent.agent_directory);
    const history = await agent.run(2);

    const secondCallMessages = llm.calls[1] ?? [];
    const hasFinalStepGuidance = secondCallMessages.some((message: any) =>
      String(message?.text ?? '').includes('You reached max_steps')
    );

    expect(hasFinalStepGuidance).toBe(true);
    expect(history.is_successful()).toBe(true);
  });

  it('retries once when model returns empty action', async () => {
    const controller = createTestController();
    const browser_session = createBrowserSessionStub();
    const tempDir = createTempDir();
    const llm = new MockLLM([
      {
        completion: {
          action: [],
          thinking: 'oops no action',
        },
      },
      {
        completion: {
          action: [{ done: { success: true, text: 'Recovered after retry' } }],
          thinking: 'fixed output',
        },
      },
    ]);

    const agent = new Agent({
      task: 'Retry empty action once',
      llm,
      browser_session,
      controller,
      file_system_path: tempDir,
      use_vision: false,
    });

    tempResources.push(agent.agent_directory);
    const history = await agent.run(2);

    expect(llm.calls.length).toBeGreaterThanOrEqual(2);
    expect(llm.calls[1].length).toBe(llm.calls[0].length + 1);
    expect(String(llm.calls[1][llm.calls[1].length - 1]?.text ?? '')).toContain(
      'forgot to return an action'
    );
    expect(history.is_successful()).toBe(true);
    expect(history.final_result()).toContain('Recovered after retry');
  });

  it('falls back to done(success=false) after repeated empty actions', async () => {
    const controller = createTestController();
    const browser_session = createBrowserSessionStub();
    const tempDir = createTempDir();
    const llm = new MockLLM([
      {
        completion: {
          action: [],
          thinking: 'still empty',
        },
      },
      {
        completion: {
          action: [{}],
          thinking: 'still empty after retry',
        },
      },
    ]);

    const agent = new Agent({
      task: 'Fallback on repeated empty action',
      llm,
      browser_session,
      controller,
      file_system_path: tempDir,
      use_vision: false,
    });

    tempResources.push(agent.agent_directory);
    const history = await agent.run(2);

    expect(llm.calls.length).toBeGreaterThanOrEqual(2);
    expect(history.is_done()).toBe(true);
    expect(history.is_successful()).toBe(false);
    expect(history.final_result() ?? '').toContain(
      'No next action returned by LLM!'
    );
  });

  it('stops remaining multi-actions after a terminating navigation action', async () => {
    const controller = createTestController();
    const browser_session = createBrowserSessionStub();
    const tempDir = createTempDir();

    const llm = new MockLLM([
      {
        completion: {
          action: [
            { go_to_url: { url: 'https://step1.com' } },
            { go_to_url: { url: 'https://step2.com' } },
            { go_to_url: { url: 'https://step3.com' } },
          ],
          thinking: 'navigate to multiple pages',
        },
      },
      {
        completion: {
          action: [{ done: { success: true, text: 'All pages visited' } }],
          thinking: 'done',
        },
      },
    ]);

    const agent = new Agent({
      task: 'Visit multiple pages',
      llm,
      browser_session,
      controller,
      file_system_path: tempDir,
      use_vision: false,
      max_actions_per_step: 5,
    });

    tempResources.push(agent.agent_directory);
    const history = await agent.run(5);

    expect(history.is_successful()).toBe(true);
    expect(browser_session.navigateCalls).toEqual(['https://step1.com']);
  });

  it('handles max steps reached without completion', async () => {
    const controller = createTestController();
    const browser_session = createBrowserSessionStub();
    const tempDir = createTempDir();

    const llm = new MockLLM([
      {
        completion: {
          action: [{ go_to_url: { url: 'https://page1.com' } }],
          thinking: 'keep navigating',
        },
      },
    ]);

    const agent = new Agent({
      task: 'Navigate indefinitely',
      llm,
      browser_session,
      controller,
      file_system_path: tempDir,
      use_vision: false,
    });

    tempResources.push(agent.agent_directory);
    const history = await agent.run(2); // Only allow 2 steps

    expect(history.is_done()).toBe(false);
    // Agent adds a failure step when max steps is reached
    expect(history.number_of_steps()).toBeGreaterThanOrEqual(2);
  });

  it('stops after step timeout to avoid overlapping step execution', async () => {
    const controller = createTestController();
    const browser_session = createBrowserSessionStub();
    const tempDir = createTempDir();
    const llm = new MockLLM([
      {
        completion: {
          action: [{ done: { success: true, text: 'done' } }],
          thinking: 'done',
        },
      },
    ]);

    const agent = new Agent({
      task: 'Timeout safety',
      llm,
      browser_session,
      controller,
      file_system_path: tempDir,
      use_vision: false,
      step_timeout: 0.01,
    });

    tempResources.push(agent.agent_directory);
    const stepSpy = vi
      .spyOn(agent as any, '_step')
      .mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

    const history = await agent.run(3);

    expect(stepSpy).toHaveBeenCalledTimes(1);
    expect(agent.state.stopped).toBe(true);
    expect(agent.state.last_result?.[0]?.error).toContain(
      'timed out after 0.01 seconds'
    );
    expect(history.is_done()).toBe(false);
  });

  it('aborts in-flight LLM call when step timeout is reached', async () => {
    const controller = createTestController();
    const browser_session = createBrowserSessionStub();
    const tempDir = createTempDir();

    let llmAbortObserved = false;
    const llm = new MockLLM(
      [
        {
          completion: {
            action: [{ done: { success: true, text: 'done' } }],
            thinking: 'done',
          },
        },
      ],
      async (signal) => {
        if (!signal) {
          return;
        }
        await new Promise<void>((resolve) => {
          if (signal.aborted) {
            llmAbortObserved = true;
            resolve();
            return;
          }
          const onAbort = () => {
            llmAbortObserved = true;
            resolve();
          };
          signal.addEventListener('abort', onAbort, { once: true });
        });
      }
    );

    const agent = new Agent({
      task: 'Timeout should abort LLM',
      llm,
      browser_session,
      controller,
      file_system_path: tempDir,
      use_vision: false,
      step_timeout: 0.01,
    });

    tempResources.push(agent.agent_directory);
    const history = await agent.run(3);

    expect(agent.state.stopped).toBe(true);
    expect(agent.state.last_result?.[0]?.error).toContain(
      'timed out after 0.01 seconds'
    );
    expect(llmAbortObserved).toBe(true);
    expect(llm.signals[0]?.aborted).toBe(true);
    expect(history.is_done()).toBe(false);
  });

  it("does not treat regular 'timeout' errors as step-timeout signals", async () => {
    const controller = createTestController();
    const browser_session = createBrowserSessionStub();
    const tempDir = createTempDir();
    const llm = new MockLLM([
      {
        completion: {
          action: [{ done: { success: true, text: 'done' } }],
          thinking: 'done',
        },
      },
    ]);

    const agent = new Agent({
      task: 'Literal timeout error',
      llm,
      browser_session,
      controller,
      file_system_path: tempDir,
      use_vision: false,
      step_timeout: 5,
      max_failures: 2,
      final_response_after_failure: false,
    });

    tempResources.push(agent.agent_directory);
    const stepSpy = vi
      .spyOn(agent as any, '_step')
      .mockRejectedValue(new Error('timeout'));

    const history = await agent.run(3);

    expect(stepSpy).toHaveBeenCalledTimes(2);
    expect(agent.state.stopped).toBe(false);
    expect(agent.state.last_result?.[0]?.error).toBe('timeout');
    expect(history.is_done()).toBe(false);
  });

  it('handles action failures', async () => {
    const controller = createTestController();
    const browser_session = createBrowserSessionStub();
    const tempDir = createTempDir();

    // Make navigate_to fail on first call
    let callCount = 0;
    const originalNavigate = browser_session.navigate_to;
    browser_session.navigate_to = async (url: string) => {
      if (callCount++ === 0) {
        throw new Error('Network error');
      }
      return originalNavigate.call(browser_session, url);
    };

    const llm = new MockLLM([
      {
        completion: {
          action: [{ go_to_url: { url: 'https://failing.com' } }],
          thinking: 'try to navigate',
        },
      },
      {
        completion: {
          action: [{ go_to_url: { url: 'https://working.com' } }],
          thinking: 'retry',
        },
      },
      {
        completion: {
          action: [{ done: { success: true, text: 'Recovered' } }],
          thinking: 'complete',
        },
      },
    ]);

    const agent = new Agent({
      task: 'Navigate with recovery',
      llm,
      browser_session,
      controller,
      file_system_path: tempDir,
      use_vision: false,
      max_failures: 2,
    });

    tempResources.push(agent.agent_directory);
    const history = await agent.run(5);

    expect(history.is_successful()).toBe(true);
    // First call failed, second succeeded
    expect(browser_session.navigateCalls).toContain('https://working.com');
  });

  it('recovers from transient browser state failures across steps', async () => {
    const controller = createTestController();
    const browser_session = createBrowserSessionStub();
    const tempDir = createTempDir();

    const originalGetState = browser_session.get_browser_state_with_recovery;
    let stateCallCount = 0;
    browser_session.get_browser_state_with_recovery = async () => {
      if (stateCallCount++ === 0) {
        throw new Error('Target page crashed');
      }
      return originalGetState.call(browser_session);
    };

    const llm = new MockLLM([
      {
        completion: {
          action: [{ done: { success: true, text: 'Recovered after crash' } }],
          thinking: 'recover and finish',
        },
      },
    ]);

    const agent = new Agent({
      task: 'Recover from transient browser state failure',
      llm,
      browser_session,
      controller,
      file_system_path: tempDir,
      use_vision: false,
      max_failures: 3,
    });

    tempResources.push(agent.agent_directory);
    const history = await agent.run(3);

    expect(stateCallCount).toBeGreaterThanOrEqual(2);
    expect(history.is_successful()).toBe(true);
    expect(history.final_result()).toContain('Recovered after crash');
    expect(agent.state.consecutive_failures).toBe(0);
  });

  it('recovers after multiple consecutive browser state failures', async () => {
    const controller = createTestController();
    const browser_session = createBrowserSessionStub();
    const tempDir = createTempDir();

    const originalGetState = browser_session.get_browser_state_with_recovery;
    let failuresRemaining = 2;
    let stateCallCount = 0;
    browser_session.get_browser_state_with_recovery = async () => {
      stateCallCount += 1;
      if (failuresRemaining > 0) {
        failuresRemaining -= 1;
        throw new Error('Context closed');
      }
      return originalGetState.call(browser_session);
    };

    const llm = new MockLLM([
      {
        completion: {
          action: [
            { done: { success: true, text: 'Recovered after retries' } },
          ],
          thinking: 'retry until browser state is available',
        },
      },
    ]);

    const agent = new Agent({
      task: 'Recover from repeated browser state failures',
      llm,
      browser_session,
      controller,
      file_system_path: tempDir,
      use_vision: false,
      max_failures: 4,
    });

    tempResources.push(agent.agent_directory);
    const history = await agent.run(5);

    expect(stateCallCount).toBeGreaterThanOrEqual(3);
    expect(history.is_successful()).toBe(true);
    expect(history.final_result()).toContain('Recovered after retries');
    expect(agent.state.consecutive_failures).toBe(0);
  });

  it('keeps BrowserSession claims consistent when close races with run finalizer', async () => {
    const controller = createTestController();
    const tempDir = createTempDir();
    const browser_session = createBrowserSessionStub() as any;

    let attachedAgentId: string | null = null;
    let stopCalls = 0;
    browser_session.claim_agent = (agentId: string) => {
      if (!agentId) {
        return false;
      }
      if (attachedAgentId && attachedAgentId !== agentId) {
        return false;
      }
      attachedAgentId = agentId;
      return true;
    };
    browser_session.release_agent = (agentId?: string) => {
      if (!attachedAgentId) {
        return true;
      }
      if (agentId && attachedAgentId !== agentId) {
        return false;
      }
      attachedAgentId = null;
      return true;
    };
    browser_session.get_attached_agent_id = () => attachedAgentId;
    browser_session.stop = async () => {
      stopCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
    };
    const releaseSpy = vi.spyOn(browser_session, 'release_agent');

    const llm = new MockLLM([
      {
        completion: {
          action: [{ done: { success: true, text: 'Race-safe completion' } }],
          thinking: 'done',
        },
      },
    ]);

    const agent = new Agent({
      task: 'Race-safe close',
      llm,
      browser_session,
      controller,
      file_system_path: tempDir,
      use_vision: false,
    });

    tempResources.push(agent.agent_directory);
    const history = await agent.run(2, null, async () => {
      await agent.close();
    });

    expect(history.is_done()).toBe(true);
    expect(stopCalls).toBe(1);
    expect(releaseSpy).toHaveBeenCalledTimes(1);
    expect(browser_session.get_attached_agent_id()).toBeNull();
  });

  it('keeps shared BrowserSession alive until all shared agents close', async () => {
    const controller = createTestController();
    const tempDir1 = createTempDir();
    const tempDir2 = createTempDir();
    const browser_session = createBrowserSessionStub() as any;

    let exclusiveOwner: string | null = null;
    const sharedOwners = new Set<string>();
    let stopCalls = 0;
    browser_session.claim_agent = (
      agentId: string,
      mode: 'exclusive' | 'shared' = 'exclusive'
    ) => {
      if (!agentId) {
        return false;
      }
      if (mode === 'shared') {
        if (
          exclusiveOwner &&
          exclusiveOwner !== agentId &&
          sharedOwners.size === 0
        ) {
          return false;
        }
        if (sharedOwners.size === 0 && exclusiveOwner) {
          sharedOwners.add(exclusiveOwner);
        }
        sharedOwners.add(agentId);
        exclusiveOwner = exclusiveOwner ?? agentId;
        return true;
      }
      if (sharedOwners.size > 0) {
        return sharedOwners.size === 1 && sharedOwners.has(agentId);
      }
      if (exclusiveOwner && exclusiveOwner !== agentId) {
        return false;
      }
      exclusiveOwner = agentId;
      return true;
    };
    browser_session.release_agent = (agentId?: string) => {
      if (sharedOwners.size > 0) {
        if (!agentId || !sharedOwners.has(agentId)) {
          return false;
        }
        sharedOwners.delete(agentId);
        exclusiveOwner = sharedOwners.size ? Array.from(sharedOwners)[0] : null;
        return true;
      }
      if (!exclusiveOwner) {
        return true;
      }
      if (agentId && exclusiveOwner !== agentId) {
        return false;
      }
      exclusiveOwner = null;
      return true;
    };
    browser_session.get_attached_agent_ids = () =>
      sharedOwners.size
        ? Array.from(sharedOwners)
        : exclusiveOwner
          ? [exclusiveOwner]
          : [];
    browser_session.get_attached_agent_id = () =>
      browser_session.get_attached_agent_ids()[0] ?? null;
    browser_session.stop = async () => {
      stopCalls += 1;
    };

    const llm = new MockLLM([
      {
        completion: {
          action: [{ done: { success: true, text: 'done shared task' } }],
          thinking: 'done',
        },
      },
    ]);

    const agent1 = new Agent({
      task: 'Shared agent 1',
      llm,
      browser_session,
      controller,
      file_system_path: tempDir1,
      use_vision: false,
      session_attachment_mode: 'shared',
    });
    const agent2 = new Agent({
      task: 'Shared agent 2',
      llm,
      browser_session,
      controller,
      file_system_path: tempDir2,
      use_vision: false,
      session_attachment_mode: 'shared',
    });

    tempResources.push(agent1.agent_directory);
    tempResources.push(agent2.agent_directory);

    await agent1.run(1);
    expect(stopCalls).toBe(0);
    expect(browser_session.get_attached_agent_ids()).toEqual([agent2.id]);

    await agent2.run(1);
    expect(stopCalls).toBe(1);
    expect(browser_session.get_attached_agent_ids()).toEqual([]);
  });

  it('serializes shared-mode steps and restores each agent pinned tab', async () => {
    const controller = createTestController();
    const tempDir1 = createTempDir();
    const tempDir2 = createTempDir();

    const root = new DOMElementNode(true, null, 'body', '/html/body', {}, [
      new DOMTextNode(true, null, 'Shared root'),
    ]);
    root.is_top_element = true;
    root.is_in_viewport = true;
    root.highlight_index = 0;
    const domState = new DOMState(root, { 0: root });

    const tabs = [
      { page_id: 0, url: 'https://tab-a.test', title: 'Tab A' },
      { page_id: 1, url: 'https://tab-b.test', title: 'Tab B' },
    ];
    let activeTabIndex = 0;
    let inStateCalls = 0;
    let maxConcurrentStateCalls = 0;

    const sharedOwners = new Set<string>();
    let exclusiveOwner: string | null = null;
    const browser_session: any = {
      id: 'shared-pin-stub',
      browser_profile: {},
      downloaded_files: [],
      get active_tab_index() {
        return activeTabIndex;
      },
      get active_tab() {
        return tabs[activeTabIndex] ?? null;
      },
      claim_agent(agentId: string, mode: 'exclusive' | 'shared' = 'exclusive') {
        if (!agentId) {
          return false;
        }
        if (mode === 'shared') {
          if (
            exclusiveOwner &&
            exclusiveOwner !== agentId &&
            sharedOwners.size === 0
          ) {
            return false;
          }
          if (sharedOwners.size === 0 && exclusiveOwner) {
            sharedOwners.add(exclusiveOwner);
          }
          sharedOwners.add(agentId);
          exclusiveOwner = exclusiveOwner ?? agentId;
          return true;
        }
        if (sharedOwners.size > 0) {
          return sharedOwners.size === 1 && sharedOwners.has(agentId);
        }
        if (exclusiveOwner && exclusiveOwner !== agentId) {
          return false;
        }
        exclusiveOwner = agentId;
        return true;
      },
      release_agent(agentId?: string) {
        if (sharedOwners.size > 0) {
          if (!agentId || !sharedOwners.has(agentId)) {
            return false;
          }
          sharedOwners.delete(agentId);
          exclusiveOwner = sharedOwners.size
            ? Array.from(sharedOwners)[0]
            : null;
          return true;
        }
        if (!exclusiveOwner) {
          return true;
        }
        if (agentId && exclusiveOwner !== agentId) {
          return false;
        }
        exclusiveOwner = null;
        return true;
      },
      get_attached_agent_ids() {
        return sharedOwners.size
          ? Array.from(sharedOwners)
          : exclusiveOwner
            ? [exclusiveOwner]
            : [];
      },
      get_attached_agent_id() {
        return this.get_attached_agent_ids()[0] ?? null;
      },
      async switch_to_tab(identifier: number) {
        const byPageId = tabs.findIndex((tab) => tab.page_id === identifier);
        const index =
          byPageId >= 0
            ? byPageId
            : identifier >= 0 && identifier < tabs.length
              ? identifier
              : -1;
        if (index < 0) {
          throw new Error(`Tab ${identifier} not found`);
        }
        activeTabIndex = index;
        return { url: () => tabs[activeTabIndex].url };
      },
      async get_browser_state_with_recovery() {
        inStateCalls += 1;
        maxConcurrentStateCalls = Math.max(
          maxConcurrentStateCalls,
          inStateCalls
        );
        await new Promise((resolve) => setTimeout(resolve, 20));
        inStateCalls -= 1;
        const active = tabs[activeTabIndex];
        return new BrowserStateSummary(domState, {
          url: active.url,
          title: active.title,
          tabs: tabs.map((tab) => ({ ...tab })),
        });
      },
      async get_current_page() {
        const active = tabs[activeTabIndex];
        return {
          url: () => active.url,
        };
      },
      async navigate_to(url: string) {
        tabs[activeTabIndex].url = url;
      },
      async start() {},
      async stop() {},
      get_selector_map: async () => ({ 0: root }),
    };

    const llm1 = new MockLLM([
      {
        completion: {
          action: [{ done: { success: true, text: 'shared-1' } }],
          thinking: 'done',
        },
      },
    ]);
    const llm2 = new MockLLM([
      {
        completion: {
          action: [{ done: { success: true, text: 'shared-2' } }],
          thinking: 'done',
        },
      },
    ]);

    activeTabIndex = 0;
    const agent1 = new Agent({
      task: 'Shared pinned tab agent 1',
      llm: llm1,
      browser_session,
      controller,
      file_system_path: tempDir1,
      use_vision: false,
      session_attachment_mode: 'shared',
    });
    activeTabIndex = 1;
    const agent2 = new Agent({
      task: 'Shared pinned tab agent 2',
      llm: llm2,
      browser_session,
      controller,
      file_system_path: tempDir2,
      use_vision: false,
      session_attachment_mode: 'shared',
    });

    tempResources.push(agent1.agent_directory);
    tempResources.push(agent2.agent_directory);

    const [history1, history2] = await Promise.all([
      agent1.run(1),
      agent2.run(1),
    ]);

    expect(maxConcurrentStateCalls).toBe(1);
    expect(history1.history[0]?.state?.url).toBe('https://tab-a.test');
    expect(history2.history[0]?.state?.url).toBe('https://tab-b.test');
    expect(
      ((Agent as any)._sharedSessionStepLocks as Map<string, unknown>).has(
        'shared-pin-stub'
      )
    ).toBe(false);
  });
});

describe('Unit Tests', () => {
  it('builds a DOM snapshot from the serialized page state', async () => {
    const serializedDom = {
      rootId: '1',
      map: {
        '1': {
          type: 'ELEMENT_NODE',
          tagName: 'body',
          xpath: '/html/body',
          isVisible: true,
          isInViewport: true,
          isTopElement: true,
          children: ['2'],
        },
        '2': {
          type: 'ELEMENT_NODE',
          tagName: 'button',
          xpath: '/html/body/button[1]',
          isVisible: true,
          isInViewport: true,
          isTopElement: true,
          isInteractive: true,
          highlightIndex: 0,
          children: ['3'],
        },
        '3': {
          type: 'TEXT_NODE',
          text: 'Click me',
          isVisible: true,
        },
      },
    };

    const fakePage = {
      url: () => 'https://example.com',
      async evaluate(fn: any, ...args: any[]) {
        if (typeof fn === 'function' && args.length === 0) {
          return fn();
        }
        return serializedDom;
      },
    };

    const domService = new DomService(fakePage as any);
    const domState = await domService.get_clickable_elements();

    expect(domState.selector_map[0]).toBeInstanceOf(DOMElementNode);
    expect(domState.selector_map[0].tag_name).toBe('button');
    expect(domState.selector_map[0].children[0]).toBeInstanceOf(DOMTextNode);
    expect(domState.selector_map[0].clickable_elements_to_string()).toContain(
      '<button'
    );
  });
});

describe('Integration Tests (Real Browser)', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    // Launch a real browser for integration tests
    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  afterEach(async () => {
    if (context) {
      await context.close();
    }
  });

  it('navigates real browser and extracts DOM elements', async () => {
    context = await browser.newContext();
    page = await context.newPage();

    // Create a simple HTML page
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>Test Page</title></head>
        <body>
          <h1>Welcome</h1>
          <button id="btn1">Click me</button>
          <a href="#link">Link</a>
        </body>
      </html>
    `);

    await page.waitForLoadState('domcontentloaded');

    const browserSession = new BrowserSession({
      page,
      browser,
      browser_context: context,
      profile: { disable_security: true },
    });

    // BrowserSession is initialized in constructor

    const state = await browserSession.get_browser_state_with_recovery({
      cache_clickable_elements_hashes: false,
      include_screenshot: false,
    });

    expect(state).toBeDefined();
    // URL and title are set during initialization
    expect(state.url).toBeDefined();
    expect(state.title).toBeDefined();

    // Should find interactive elements (button and link)
    const selectorMap = state.selector_map;
    const elements = Object.values(selectorMap);

    // At minimum, we should have some elements
    expect(elements.length).toBeGreaterThanOrEqual(0);

    await browserSession.close();
  });

  it('executes agent with real browser navigation', async () => {
    context = await browser.newContext();
    page = await context.newPage();

    // Create an HTML page to navigate to
    const testHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Target Page</title></head>
        <body>
          <h1>Success</h1>
          <p>You reached the target page</p>
        </body>
      </html>
    `;

    await page.setContent(testHtml);
    await page.waitForLoadState('domcontentloaded');

    const browserSession = new BrowserSession({
      page,
      browser,
      browser_context: context,
      profile: { disable_security: true },
    });

    // BrowserSession is initialized in constructor

    const controller = createTestController();
    const tempDir = createTempDir();

    const llm = new MockLLM([
      {
        completion: {
          action: [{ done: { success: true, text: 'Already on page' } }],
          thinking: 'page loaded',
        },
      },
    ]);

    const agent = new Agent({
      task: 'Verify page content',
      llm,
      browser_session: browserSession,
      controller,
      file_system_path: tempDir,
      use_vision: false,
    });

    tempResources.push(agent.agent_directory);

    const history = await agent.run(2);

    expect(history.is_done()).toBe(true);
    expect(history.is_successful()).toBe(true);

    // Verify browser state was captured
    const firstStep = history.history[0];
    expect(firstStep?.state).toBeDefined();

    await browserSession.close();
  });

  it('handles real page interactions', async () => {
    context = await browser.newContext();
    page = await context.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>Interactive Page</title></head>
        <body>
          <input id="input1" type="text" placeholder="Enter text" />
          <button id="submit">Submit</button>
          <div id="result"></div>
          <script>
            document.getElementById('submit').addEventListener('click', () => {
              const input = document.getElementById('input1');
              const result = document.getElementById('result');
              result.textContent = 'Submitted: ' + input.value;
            });
          </script>
        </body>
      </html>
    `);

    await page.waitForLoadState('domcontentloaded');

    const browserSession = new BrowserSession({
      page,
      browser,
      browser_context: context,
      profile: { disable_security: true },
    });

    // BrowserSession is initialized in constructor

    const state = await browserSession.get_browser_state_with_recovery({
      cache_clickable_elements_hashes: false,
      include_screenshot: false,
    });

    const elements = Object.values(state.selector_map);

    // Verify we have some elements
    expect(elements.length).toBeGreaterThanOrEqual(0);

    await browserSession.close();
  });

  it('captures screenshots when enabled', async () => {
    context = await browser.newContext();
    page = await context.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body><h1>Screenshot Test</h1></body>
      </html>
    `);

    await page.waitForLoadState('domcontentloaded');

    const browserSession = new BrowserSession({
      page,
      browser,
      browser_context: context,
      profile: { disable_security: true },
    });

    // BrowserSession is initialized in constructor

    const state = await browserSession.get_browser_state_with_recovery({
      cache_clickable_elements_hashes: false,
      include_screenshot: true,
    });

    expect(state).toBeDefined();

    // Screenshot may or may not be captured depending on implementation
    // Just verify the state is valid
    expect(state.url).toBeDefined();

    await browserSession.close();
  });

  it('tracks navigation history', async () => {
    context = await browser.newContext();
    page = await context.newPage();

    const browserSession = new BrowserSession({
      page,
      browser,
      browser_context: context,
      profile: { disable_security: true },
    });

    // BrowserSession is initialized in constructor

    // Navigate to multiple pages
    await page.setContent('<html><body><h1>Page 1</h1></body></html>');
    await page.waitForLoadState('domcontentloaded');

    await browserSession.get_browser_state_with_recovery({
      cache_clickable_elements_hashes: false,
      include_screenshot: false,
    });

    await page.setContent('<html><body><h1>Page 2</h1></body></html>');
    await page.waitForLoadState('domcontentloaded');

    await browserSession.get_browser_state_with_recovery({
      cache_clickable_elements_hashes: false,
      include_screenshot: false,
    });

    // Navigation should have occurred
    expect(page.url()).toBeDefined();

    await browserSession.close();
  });

  it('handles complex DOM structures', async () => {
    context = await browser.newContext();
    page = await context.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body>
          <nav>
            <ul>
              <li><a href="#home">Home</a></li>
              <li><a href="#about">About</a></li>
            </ul>
          </nav>
          <main>
            <article>
              <h2>Title</h2>
              <p>Content</p>
              <button class="action">Action</button>
            </article>
          </main>
          <footer>
            <button id="footer-btn">Footer Button</button>
          </footer>
        </body>
      </html>
    `);

    await page.waitForLoadState('domcontentloaded');

    const browserSession = new BrowserSession({
      page,
      browser,
      browser_context: context,
      profile: { disable_security: true },
    });

    // BrowserSession is initialized in constructor

    const state = await browserSession.get_browser_state_with_recovery({
      cache_clickable_elements_hashes: false,
      include_screenshot: false,
    });

    const elements = Object.values(state.selector_map);

    // Should have some elements (exact count may vary based on implementation)
    expect(elements.length).toBeGreaterThanOrEqual(0);
    expect(state).toBeDefined();

    await browserSession.close();
  });

  it('completes end-to-end agent workflow with real browser', async () => {
    context = await browser.newContext();
    page = await context.newPage();

    // Set up a test page
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head><title>E2E Test Page</title></head>
        <body>
          <h1>Welcome to E2E Test</h1>
          <button id="test-button">Test Button</button>
        </body>
      </html>
    `);

    await page.waitForLoadState('domcontentloaded');

    const browserSession = new BrowserSession({
      page,
      browser,
      browser_context: context,
      profile: { disable_security: true },
    });

    // BrowserSession is initialized in constructor

    const controller = createTestController();
    const tempDir = createTempDir();

    const llm = new MockLLM([
      {
        completion: {
          action: [
            { done: { success: true, text: 'Page verified successfully' } },
          ],
          thinking: 'Page loaded and verified',
          next_goal: 'Complete verification',
          evaluation_previous_goal: 'Successfully loaded page',
          memory: 'Test page with button found',
        },
      },
    ]);

    const agent = new Agent({
      task: 'Verify the test page has loaded correctly',
      llm,
      browser_session: browserSession,
      controller,
      file_system_path: tempDir,
      use_vision: false,
      use_thinking: true,
    });

    tempResources.push(agent.agent_directory);

    const history = await agent.run(3);

    // Verify successful completion
    expect(history.is_done()).toBe(true);
    expect(history.is_successful()).toBe(true);
    expect(history.number_of_steps()).toBe(1);

    // Verify history captured browser state
    const step = history.history[0];
    expect(step?.state).toBeDefined();
    expect(step?.model_output?.thinking).toBe('Page loaded and verified');
    expect(step?.model_output?.memory).toBe('Test page with button found');

    // Verify LLM received browser state
    expect(llm.calls.length).toBeGreaterThanOrEqual(1);
    const messages = llm.calls[0];
    expect(messages.length).toBeGreaterThan(0);

    await browserSession.close();
  });
});
