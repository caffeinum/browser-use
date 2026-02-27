import 'dotenv/config';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { Agent, BrowserSession, Controller } from '../src/index.js';
import type { BaseChatModel } from '../src/llm/base.js';
import { ChatGoogle } from '../src/llm/google/chat.js';
import { ChatAnthropic } from '../src/llm/anthropic/chat.js';
import { ChatOpenAI } from '../src/llm/openai/chat.js';

type Tier = 'P0' | 'P1';
type ProviderName = 'google' | 'anthropic' | 'openai';

interface ProviderFactory {
  name: ProviderName;
  enabled: boolean;
  reasonIfDisabled?: string;
  create: () => BaseChatModel;
}

interface ActionExpectation {
  feature: string;
  anyOfActions: string[];
}

interface ScenarioContext {
  baseUrl: string;
  uploadFilePath: string;
}

interface Scenario {
  id: string;
  tier: Tier;
  startPath: string;
  maxSteps: number;
  allowedActions: string[];
  initialActions?:
    | Array<Record<string, Record<string, unknown>>>
    | ((ctx: ScenarioContext) => Array<Record<string, Record<string, unknown>>>);
  expectedActions: ActionExpectation[];
  task: (ctx: ScenarioContext) => string;
  verifyPage: (page: Page) => Promise<string[]>;
}

interface ScenarioResult {
  scenarioId: string;
  tier: Tier;
  ok: boolean;
  errors: string[];
  actions: string[];
  done: boolean;
  success: boolean | null;
  finalResult: string | null;
}

interface ProviderRunResult {
  provider: ProviderName;
  ok: boolean;
  skipped: boolean;
  reason?: string;
  scenarios: ScenarioResult[];
}

const SITE_INDEX_HTML = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Browser Use Local E2E Playground</title>
    <style>
      body { font-family: sans-serif; margin: 24px; line-height: 1.4; }
      section { margin-bottom: 32px; }
      .spacer { height: 900px; background: linear-gradient(#fff, #f3f4f6); }
      .card { padding: 12px; border: 1px solid #ddd; border-radius: 6px; margin: 8px 0; }
    </style>
  </head>
  <body>
    <h1>Local Feature Validation Page</h1>
    <p id="page-intro">This page is used for browser-use P0/P1 feature validation.</p>

    <section id="p0-form" class="card">
      <h2>P0 Form Area</h2>
      <input id="name-input" placeholder="type here" />
      <button id="apply-btn">Apply Value</button>
      <div id="result">Applied value: (none)</div>
    </section>

    <section id="p1-dropdown" class="card">
      <h2>P1 Dropdown Area</h2>
      <select id="team-select">
        <option value="">Select a team</option>
        <option value="alpha">alpha</option>
        <option value="beta">beta</option>
        <option value="gamma">gamma</option>
      </select>
      <div id="dropdown-result">Selected: (none)</div>
    </section>

    <section id="p1-keyboard-upload" class="card">
      <h2>P1 Keyboard and Upload Area</h2>
      <input id="hotkey-input" placeholder="focus me then send keys" />
      <div id="hotkey-result">Last key: (none)</div>
      <input id="file-upload" type="file" />
      <div id="file-result">Uploaded file: (none)</div>
    </section>

    <section id="tab-link" class="card">
      <h2>Tab Area</h2>
      <a id="open-tab-link" href="/tab.html" target="_blank">Open tab page in new tab</a>
    </section>

    <div class="spacer"></div>

    <section id="p0-scroll-extract" class="card">
      <h2 id="refactor-heading">Refactor as needed while ensuring all tests continue to pass</h2>
      <p id="refactor-text">
        In test-driven development, refactoring should continuously improve code structure
        while preserving behavior validated by the test suite. Keep changes incremental,
        run tests frequently, and avoid broad rewrites without feedback loops.
      </p>
      <p id="extra-text">
        This paragraph exists to make extraction slightly more realistic and ensure
        structured extraction has enough context to work with.
      </p>
    </section>

    <script>
      const nameInput = document.getElementById('name-input');
      const applyBtn = document.getElementById('apply-btn');
      const result = document.getElementById('result');
      applyBtn.addEventListener('click', () => {
        result.textContent = 'Applied value: ' + (nameInput.value || '(empty)');
      });

      const select = document.getElementById('team-select');
      const dropdownResult = document.getElementById('dropdown-result');
      select.addEventListener('change', () => {
        dropdownResult.textContent = 'Selected: ' + (select.value || '(none)');
      });

      const hotkeyInput = document.getElementById('hotkey-input');
      const hotkeyResult = document.getElementById('hotkey-result');
      hotkeyInput.addEventListener('keydown', (event) => {
        hotkeyResult.textContent = 'Last key: ' + event.key;
      });

      const fileUpload = document.getElementById('file-upload');
      const fileResult = document.getElementById('file-result');
      fileUpload.addEventListener('change', () => {
        const fileName = fileUpload.files && fileUpload.files[0] ? fileUpload.files[0].name : '(none)';
        fileResult.textContent = 'Uploaded file: ' + fileName;
      });
    </script>
  </body>
</html>
`;

const SITE_TAB_HTML = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Secondary Tab</title>
  </head>
  <body>
    <h1 id="tab-title">Secondary Tab Ready</h1>
    <p>This tab exists for switch_tab and close_tab validation.</p>
  </body>
</html>
`;

const MIME_BY_EXT: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

const toCanonicalAction = (actionName: string): string => {
  const aliases: Record<string, string> = {
    input: 'input_text',
    click: 'click_element_by_index',
    navigate: 'go_to_url',
    switch: 'switch_tab',
    close: 'close_tab',
    extract: 'extract_structured_data',
    find_text: 'scroll_to_text',
    dropdown_options: 'get_dropdown_options',
    select_dropdown: 'select_dropdown_option',
  };
  return aliases[actionName] ?? actionName;
};

const unique = <T>(values: T[]): T[] => Array.from(new Set(values));

const createTempSite = async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'browser-use-e2e-site-'));
  const uploadFilePath = path.join(dir, 'upload-sample.txt');
  await fs.writeFile(path.join(dir, 'index.html'), SITE_INDEX_HTML, 'utf8');
  await fs.writeFile(path.join(dir, 'tab.html'), SITE_TAB_HTML, 'utf8');
  await fs.writeFile(uploadFilePath, 'sample-upload-content', 'utf8');
  return { dir, uploadFilePath };
};

const startStaticServer = async (rootDir: string) => {
  const server = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url ?? '/', 'http://localhost');
      let pathname = decodeURIComponent(requestUrl.pathname);
      if (pathname === '/') {
        pathname = '/index.html';
      }
      const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
      const filePath = path.join(rootDir, safePath);
      const content = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mimeType = MIME_BY_EXT[ext] ?? 'application/octet-stream';
      res.statusCode = 200;
      res.setHeader('Content-Type', mimeType);
      res.end(content);
    } catch {
      res.statusCode = 404;
      res.end('Not Found');
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to start static server');
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    baseUrl,
    close: async () =>
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      }),
  };
};

const getAllActionNames = (): string[] => {
  const controller = new Controller();
  return [...controller.registry.get_all_actions().keys()];
};

const createControllerForScenario = (
  allActions: string[],
  allowedActions: string[]
) => {
  const allowed = new Set(allowedActions);
  const exclude = allActions.filter((actionName) => !allowed.has(actionName));
  return new Controller({ exclude_actions: exclude });
};

const scenarios: Scenario[] = [
  {
    id: 'p0-form-search-find',
    tier: 'P0',
    startPath: '/index.html',
    maxSteps: 8,
    allowedActions: [
      'input_text',
      'click_element_by_index',
      'search_page',
      'find_elements',
      'done',
    ],
    expectedActions: [
      { feature: 'input text', anyOfActions: ['input_text'] },
      {
        feature: 'click element',
        anyOfActions: ['click_element_by_index'],
      },
      { feature: 'search page text', anyOfActions: ['search_page'] },
      { feature: 'find elements by selector', anyOfActions: ['find_elements'] },
      { feature: 'finish task', anyOfActions: ['done'] },
    ],
    task: () => `
You are already on a local test page.

Goal: complete this exact flow and then finish.
1) Use input_text to type "P0-HELLO" into the text input in the P0 Form Area.
2) Use click_element_by_index to click the "Apply Value" button.
3) Use search_page to find the phrase "Applied value: P0-HELLO".
4) Use find_elements with selector "#result".
5) Call done with success=true and include "P0_FORM_PASS" in text.

Do not use any action not listed above.
`,
    verifyPage: async (page: Page) => {
      const errors: string[] = [];
      const resultText = (await page.textContent('#result')) ?? '';
      if (!resultText.includes('Applied value: P0-HELLO')) {
        errors.push(`Expected #result to include P0-HELLO, got: ${resultText}`);
      }
      return errors;
    },
  },
  {
    id: 'p0-scroll-extract',
    tier: 'P0',
    startPath: '/index.html',
    maxSteps: 8,
    allowedActions: ['scroll_to_text', 'extract_structured_data', 'done'],
    expectedActions: [
      { feature: 'scroll to target text', anyOfActions: ['scroll_to_text'] },
      {
        feature: 'structured extraction',
        anyOfActions: ['extract_structured_data'],
      },
      { feature: 'finish task', anyOfActions: ['done'] },
    ],
    task: () => `
You are on a local test page.

Goal:
1) Use scroll_to_text to find "Refactor as needed while ensuring all tests continue to pass".
2) Use extract_structured_data with this query:
   "Extract one sentence summarizing the refactoring guidance from this section."
3) Call done with success=true and include "P0_EXTRACT_PASS" in text.

Do not use any action not listed above.
`,
    verifyPage: async () => [],
  },
  {
    id: 'p1-tab-management',
    tier: 'P1',
    startPath: '/index.html',
    maxSteps: 6,
    allowedActions: [
      'go_to_url',
      'switch_tab',
      'close_tab',
      'done',
    ],
    expectedActions: [
      { feature: 'open tab', anyOfActions: ['go_to_url'] },
      { feature: 'switch tab', anyOfActions: ['switch_tab'] },
      { feature: 'close tab', anyOfActions: ['close_tab'] },
      { feature: 'finish task', anyOfActions: ['done'] },
    ],
    task: (ctx: ScenarioContext) => `
You are on a local test page.

Goal: validate tab actions in this exact order.
1) Use go_to_url to open "${ctx.baseUrl}/tab.html" in a NEW tab.
2) Use switch_tab to switch to tab_id "0001".
3) Use close_tab to close tab_id "0001".
4) Call done with success=true and include "P1_TAB_PASS" in text.

Do not use any action not listed above.
`,
    verifyPage: async () => [],
  },
  {
    id: 'p1-dropdown-selection',
    tier: 'P1',
    startPath: '/index.html',
    maxSteps: 6,
    allowedActions: ['get_dropdown_options', 'select_dropdown_option', 'done'],
    expectedActions: [
      {
        feature: 'read dropdown options',
        anyOfActions: ['get_dropdown_options'],
      },
      {
        feature: 'select dropdown option',
        anyOfActions: ['select_dropdown_option'],
      },
      { feature: 'finish task', anyOfActions: ['done'] },
    ],
    task: () => `
You are on a local test page.

Goal:
1) Use get_dropdown_options on the team select element.
2) Use select_dropdown_option to select "beta" in the team select element.
3) Call done with success=true and include "P1_DROPDOWN_PASS" in text.

Do not use any action not listed above.
`,
    verifyPage: async (page: Page) => {
      const errors: string[] = [];
      const dropdownText = (await page.textContent('#dropdown-result')) ?? '';
      if (!dropdownText.includes('Selected: beta')) {
        errors.push(
          `Expected #dropdown-result to include "Selected: beta", got: ${dropdownText}`
        );
      }
      return errors;
    },
  },
  {
    id: 'p1-keyboard-upload-evaluate',
    tier: 'P1',
    startPath: '/index.html',
    maxSteps: 8,
    allowedActions: [
      'click_element_by_index',
      'send_keys',
      'upload_file',
      'evaluate',
      'done',
    ],
    expectedActions: [
      {
        feature: 'focus element by click',
        anyOfActions: ['click_element_by_index'],
      },
      { feature: 'send keyboard keys', anyOfActions: ['send_keys'] },
      { feature: 'upload file', anyOfActions: ['upload_file'] },
      { feature: 'evaluate javascript', anyOfActions: ['evaluate'] },
      { feature: 'finish task', anyOfActions: ['done'] },
    ],
    task: (ctx: ScenarioContext) => `
You are on a local test page.

Goal:
1) Click the keyboard input in "P1 Keyboard and Upload Area".
2) Use send_keys to type "k".
3) Use upload_file to upload exactly this local file path: "${ctx.uploadFilePath}".
4) Use evaluate with this exact code:
   "(() => document['title'])()"
5) Call done with success=true and include "P1_KEY_UPLOAD_EVAL_PASS" in text.

Do not use any action not listed above.
`,
    verifyPage: async (page: Page) => {
      const errors: string[] = [];
      const keyText = (await page.textContent('#hotkey-result')) ?? '';
      const fileText = (await page.textContent('#file-result')) ?? '';

      if (!keyText.toLowerCase().includes('k')) {
        errors.push(`Expected #hotkey-result to reflect key 'k', got: ${keyText}`);
      }
      if (!fileText.includes('upload-sample.txt')) {
        errors.push(
          `Expected #file-result to include upload file name, got: ${fileText}`
        );
      }
      return errors;
    },
  },
  {
    id: 'p1-screenshot-and-wait',
    tier: 'P1',
    startPath: '/index.html',
    maxSteps: 6,
    allowedActions: ['screenshot', 'wait', 'done'],
    initialActions: [
      { screenshot: { file_name: 'p1-proof.png' } },
      { wait: { seconds: 1 } },
    ],
    expectedActions: [
      { feature: 'capture screenshot', anyOfActions: ['screenshot'] },
      { feature: 'wait action', anyOfActions: ['wait'] },
      { feature: 'finish task', anyOfActions: ['done'] },
    ],
    task: () => `
You are on a local test page.

Initial actions already executed screenshot + wait.
Now call done with success=true and include "P1_SCREENSHOT_WAIT_PASS" in text.

Do not use any action not listed above.
`,
    verifyPage: async () => [],
  },
];

const buildProviderFactories = (): ProviderFactory[] => [
  {
    name: 'google',
    enabled: Boolean(process.env.GOOGLE_API_KEY),
    reasonIfDisabled: 'GOOGLE_API_KEY is missing',
    create: () => new ChatGoogle('gemini-2.5-flash'),
  },
  {
    name: 'anthropic',
    enabled: Boolean(process.env.ANTHROPIC_API_KEY),
    reasonIfDisabled: 'ANTHROPIC_API_KEY is missing',
    create: () => new ChatAnthropic('claude-sonnet-4-20250514'),
  },
  {
    name: 'openai',
    enabled: Boolean(process.env.OPENAI_API_KEY),
    reasonIfDisabled: 'OPENAI_API_KEY is missing',
    create: () => new ChatOpenAI('gpt-4o-mini'),
  },
];

const getRequestedProviders = (): Set<ProviderName> | null => {
  const raw =
    process.env.E2E_PROVIDERS ??
    process.argv
      .find((arg) => arg.startsWith('--providers='))
      ?.split('=')
      .slice(1)
      .join('=');

  if (!raw || !raw.trim()) {
    return null;
  }

  const parsed = raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(
      (value): value is ProviderName =>
        value === 'google' || value === 'anthropic' || value === 'openai'
    );

  if (parsed.length === 0) {
    return null;
  }

  return new Set(parsed);
};

const getRequestedScenarios = (): Set<string> | null => {
  const raw =
    process.env.E2E_SCENARIOS ??
    process.argv
      .find((arg) => arg.startsWith('--scenarios='))
      ?.split('=')
      .slice(1)
      .join('=');
  if (!raw || !raw.trim()) {
    return null;
  }
  const parsed = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (parsed.length === 0) {
    return null;
  }
  return new Set(parsed);
};

const runScenario = async (
  providerName: ProviderName,
  llm: BaseChatModel,
  scenario: Scenario,
  ctx: ScenarioContext,
  allActions: string[],
  browser: Browser
): Promise<ScenarioResult> => {
  const controller = createControllerForScenario(allActions, scenario.allowedActions);
  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const startUrl = `${ctx.baseUrl}${scenario.startPath}`;
  let browserSession: BrowserSession | null = null;

  try {
    await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

    browserSession = new BrowserSession({
      browser,
      browser_context: context,
      page,
      url: page.url(),
      title: await page.title(),
      profile: {
        headless: true,
        viewport: { width: 1440, height: 900 },
      },
    });

    const agent = new Agent({
      task: scenario.task(ctx),
      llm,
      browser_session: browserSession,
      controller,
      page_extraction_llm: llm,
      available_file_paths: [ctx.uploadFilePath],
      initial_actions:
        typeof scenario.initialActions === 'function'
          ? scenario.initialActions(ctx)
          : scenario.initialActions ?? null,
      use_vision: 'auto',
      flash_mode: true,
      max_actions_per_step: 1,
      max_failures: 5,
      generate_gif: false,
      save_conversation_path: null,
    });

    const history = await agent.run(scenario.maxSteps);
    const actions = unique(history.action_names().map((name) => toCanonicalAction(name)));
    const actionErrors: string[] = [];
    for (const expectation of scenario.expectedActions) {
      const matched = expectation.anyOfActions.some((candidate) =>
        actions.includes(toCanonicalAction(candidate))
      );
      if (!matched) {
        actionErrors.push(
          `Missing feature "${expectation.feature}". Expected one of actions: ${expectation.anyOfActions.join(', ')}`
        );
      }
    }

    const pageErrors = await scenario.verifyPage(page);
    const done = history.is_done();
    const success = history.is_successful();
    const judgement = history.judgement();
    const effectiveSuccess = success === true || judgement?.verdict === true;
    const finalResult = history.final_result();
    const errors: string[] = [...actionErrors, ...pageErrors];

    if (!done) {
      errors.push('Agent did not reach done state');
    }
    if (!effectiveSuccess) {
      errors.push(
        `Agent reported success=${String(success)} and judgement verdict=${String(judgement?.verdict ?? null)}`
      );
    }
    if (!finalResult || !finalResult.includes('_PASS')) {
      errors.push(
        `Final result is missing pass marker. Got: ${String(finalResult ?? '')}`
      );
    }

    return {
      scenarioId: scenario.id,
      tier: scenario.tier,
      ok: errors.length === 0,
      errors,
      actions,
      done,
      success,
      finalResult,
    };
  } catch (error) {
    return {
      scenarioId: scenario.id,
      tier: scenario.tier,
      ok: false,
      errors: [`Unhandled error: ${(error as Error).message}`],
      actions: [],
      done: false,
      success: false,
      finalResult: null,
    };
  } finally {
    await browserSession?.close().catch(() => {});
    await context.close().catch(() => {});
  }
};

const runProviderMatrix = async (
  providerFactory: ProviderFactory,
  ctx: ScenarioContext,
  allActions: string[],
  scenarioFilter: Set<string> | null
): Promise<ProviderRunResult> => {
  if (!providerFactory.enabled) {
    return {
      provider: providerFactory.name,
      ok: false,
      skipped: true,
      reason: providerFactory.reasonIfDisabled ?? 'disabled',
      scenarios: [],
    };
  }

  const llm = providerFactory.create();
  const browser = await chromium.launch({ headless: true });
  try {
    const scenariosResult: ScenarioResult[] = [];
    const targetScenarios = scenarioFilter
      ? scenarios.filter((scenario) => scenarioFilter.has(scenario.id))
      : scenarios;
    for (const scenario of targetScenarios) {
      console.log(
        `\n▶ Running ${providerFactory.name.toUpperCase()} / ${scenario.tier} / ${scenario.id}`
      );
      const result = await runScenario(
        providerFactory.name,
        llm,
        scenario,
        ctx,
        allActions,
        browser
      );
      scenariosResult.push(result);
      if (result.ok) {
        console.log(`✅ ${scenario.id} passed`);
      } else {
        console.log(`❌ ${scenario.id} failed`);
        for (const err of result.errors) {
          console.log(`   - ${err}`);
        }
      }
    }

    const ok = scenariosResult.every((result) => result.ok);
    return {
      provider: providerFactory.name,
      ok,
      skipped: false,
      scenarios: scenariosResult,
    };
  } finally {
    await browser.close().catch(() => {});
  }
};

const printSummary = (results: ProviderRunResult[]) => {
  console.log('\n================ E2E Matrix Summary ================');
  for (const providerResult of results) {
    if (providerResult.skipped) {
      console.log(
        `- ${providerResult.provider}: SKIPPED (${providerResult.reason ?? 'no reason'})`
      );
      continue;
    }
    console.log(`- ${providerResult.provider}: ${providerResult.ok ? 'PASS' : 'FAIL'}`);
    for (const scenario of providerResult.scenarios) {
      console.log(
        `  - [${scenario.tier}] ${scenario.scenarioId}: ${scenario.ok ? 'PASS' : 'FAIL'}`
      );
    }
  }
  console.log('====================================================\n');
};

const main = async () => {
  const allActions = getAllActionNames().map((name) => toCanonicalAction(name));
  const uniqueActions = unique(allActions);
  const site = await createTempSite();
  const server = await startStaticServer(site.dir);
  const ctx: ScenarioContext = {
    baseUrl: server.baseUrl,
    uploadFilePath: site.uploadFilePath,
  };

  console.log(`Temporary site: ${ctx.baseUrl}`);
  console.log(`Upload sample: ${ctx.uploadFilePath}`);

  const requestedProviders = getRequestedProviders();
  const requestedScenarios = getRequestedScenarios();
  const providers = buildProviderFactories().filter(
    (provider) =>
      !requestedProviders || requestedProviders.has(provider.name as ProviderName)
  );
  if (providers.length === 0) {
    throw new Error(
      'No valid providers selected. Use --providers=google,anthropic,openai or E2E_PROVIDERS.'
    );
  }
  if (requestedProviders) {
    console.log(`Selected providers: ${[...requestedProviders].join(', ')}`);
  }
  if (requestedScenarios) {
    console.log(`Selected scenarios: ${[...requestedScenarios].join(', ')}`);
  }
  const results: ProviderRunResult[] = [];

  try {
    for (const provider of providers) {
      console.log(`\n===== Provider: ${provider.name.toUpperCase()} =====`);
      const result = await runProviderMatrix(
        provider,
        ctx,
        uniqueActions,
        requestedScenarios
      );
      results.push(result);
    }
  } finally {
    await server.close().catch(() => {});
    await fs.rm(site.dir, { recursive: true, force: true }).catch(() => {});
  }

  printSummary(results);

  const failed = results.some((providerResult) => {
    if (providerResult.skipped) {
      return true;
    }
    return !providerResult.ok;
  });
  if (failed) {
    process.exitCode = 1;
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal E2E matrix error:', error);
    process.exit(1);
  });
}
