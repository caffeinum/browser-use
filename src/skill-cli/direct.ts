#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { BrowserSession, systemChrome } from '../browser/session.js';
import { CloudBrowserClient } from '../browser/cloud/cloud.js';

export interface DirectModeState {
  mode?: 'local' | 'remote';
  cdp_url?: string | null;
  session_id?: string | null;
  browser_pid?: number | null;
  user_data_dir?: string | null;
  active_url?: string | null;
}

export const DIRECT_STATE_FILE = path.join(
  os.tmpdir(),
  'browser-use-direct.json'
);

interface StreamLike {
  write(chunk: string): void;
}

interface DirectSessionLike {
  tabs?: Array<{ target_id?: string | null; url?: string | null }>;
  active_tab?: { target_id?: string | null; url?: string | null } | null;
  event_bus?: { stop?: () => Promise<void> | void } | null;
  detach_all_watchdogs?: () => void;
  start: () => Promise<unknown>;
  navigate_to?: (url: string) => Promise<unknown>;
  get_current_page?: () => Promise<any>;
  get_browser_state_with_recovery?: (options?: {
    include_screenshot?: boolean;
  }) => Promise<{
    llm_representation: () => string;
    url?: string;
    title?: string;
    tabs?: unknown[];
  }>;
  get_page_info?: () => Promise<any>;
  get_dom_element_by_index?: (index: number) => Promise<any>;
  _click_element_node?: (node: any) => Promise<unknown>;
  click_coordinates?: (
    x: number,
    y: number,
    options?: { button?: 'left' | 'middle' | 'right' }
  ) => Promise<unknown>;
  send_keys?: (text: string) => Promise<unknown>;
  _input_text_element_node?: (
    node: any,
    text: string,
    options?: { clear?: boolean }
  ) => Promise<unknown>;
  take_screenshot?: (full_page?: boolean) => Promise<string | null>;
  scroll?: (
    direction: 'up' | 'down' | 'left' | 'right',
    amount: number
  ) => Promise<unknown>;
  go_back?: () => Promise<unknown>;
  get_page_html?: () => Promise<string>;
  execute_javascript?: (script: string) => Promise<unknown>;
  switch_to_tab?: (identifier: number | string) => Promise<unknown>;
}

export interface DirectCliEnvironment {
  state_file?: string;
  stdout?: StreamLike;
  stderr?: StreamLike;
  session_factory?: (init: { cdp_url?: string | null }) => DirectSessionLike;
  cloud_client_factory?: () => Pick<CloudBrowserClient, 'create_browser' | 'stop_browser'>;
  local_launcher?: (options: {
    state: DirectModeState;
  }) => Promise<{
    cdp_url: string;
    browser_pid?: number | null;
    user_data_dir?: string | null;
  }>;
  kill_process?: (pid: number) => void | Promise<void>;
}

const DEFAULT_STDOUT: StreamLike = process.stdout;
const DEFAULT_STDERR: StreamLike = process.stderr;

const writeLine = (stream: StreamLike, message: string) => {
  stream.write(`${message}\n`);
};

export const load_direct_state = (state_file: string = DIRECT_STATE_FILE) => {
  if (!fs.existsSync(state_file)) {
    return {} as DirectModeState;
  }

  try {
    return JSON.parse(fs.readFileSync(state_file, 'utf8')) as DirectModeState;
  } catch {
    return {} as DirectModeState;
  }
};

export const save_direct_state = (
  state: DirectModeState,
  state_file: string = DIRECT_STATE_FILE
) => {
  fs.writeFileSync(state_file, JSON.stringify(state, null, 2));
};

export const clear_direct_state = (state_file: string = DIRECT_STATE_FILE) => {
  fs.rmSync(state_file, { force: true });
};

const normalizeDirectUrl = (input: string) => {
  const trimmed = input.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

const formatDirectUsage = () => `Usage: browser-use-direct <command> [args]

Commands:
  open <url>              Navigate to URL
  state                   Get current browser state
  click <index>           Click element by DOM index
  click <x> <y>           Click viewport coordinates
  type <text>             Type into focused element
  input <index> <text>    Click element and type text
  screenshot [path]       Take screenshot
  scroll [up|down]        Scroll page
  back                    Go back in history
  keys <keys>             Send keyboard keys
  html [selector]         Get page HTML or a CSS selector
  eval <js>               Execute JavaScript
  close                   Close the active direct-mode browser

Flags:
  --remote                Launch browser-use cloud browser`;

const getFreePort = async () =>
  await new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to allocate local port')));
        return;
      }
      const port = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });

const waitForLocalCdpEndpoint = async (port: number, timeoutMs = 15000) => {
  const deadline = Date.now() + timeoutMs;
  const endpoint = `http://127.0.0.1:${port}`;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${endpoint}/json/version`);
      if (response.ok) {
        const payload = (await response.json()) as {
          webSocketDebuggerUrl?: string;
        };
        if (typeof payload.webSocketDebuggerUrl === 'string') {
          return endpoint;
        }
      }
    } catch {
      // Keep polling until timeout.
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(
    `Timed out waiting for local Chrome debugging endpoint on port ${port}`
  );
};

const defaultLocalLauncher = async (options: { state: DirectModeState }) => {
  const executablePath = systemChrome.findExecutable();
  if (!executablePath) {
    throw new Error(
      'Chrome not found. Install Chrome or provide an already-running browser via cdp_url.'
    );
  }

  const port = await getFreePort();
  const userDataDir =
    options.state.user_data_dir && options.state.user_data_dir.trim().length > 0
      ? options.state.user_data_dir
      : fs.mkdtempSync(path.join(os.tmpdir(), 'browser-use-direct-'));

  const child = spawn(
    executablePath,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ],
    {
      detached: true,
      stdio: 'ignore',
    }
  );
  child.unref();

  try {
    const cdp_url = await waitForLocalCdpEndpoint(port);
    return {
      cdp_url,
      browser_pid: child.pid ?? null,
      user_data_dir: userDataDir,
    };
  } catch (error) {
    if (typeof child.pid === 'number' && child.pid > 0) {
      try {
        process.kill(child.pid, 'SIGTERM');
      } catch {
        // Ignore cleanup failures for a process that may not have started.
      }
    }
    throw error;
  }
};

const cleanupDirectSession = async (session: DirectSessionLike) => {
  try {
    session.detach_all_watchdogs?.();
  } catch {
    // Ignore cleanup failures.
  }
  try {
    await session.event_bus?.stop?.();
  } catch {
    // Ignore event bus cleanup failures.
  }
};

const restoreActiveTab = async (
  session: DirectSessionLike,
  state: DirectModeState
) => {
  if (
    typeof state.active_url !== 'string' ||
    !state.active_url ||
    !Array.isArray(session.tabs) ||
    typeof session.switch_to_tab !== 'function'
  ) {
    return;
  }

  const matchingTab = session.tabs.find((tab) => tab?.url === state.active_url);
  if (!matchingTab?.target_id) {
    return;
  }

  try {
    await session.switch_to_tab(matchingTab.target_id);
  } catch {
    // Fall back to the default page if the tab cannot be restored.
  }
};

const createDefaultSessionFactory =
  () =>
  (init: { cdp_url?: string | null }): DirectSessionLike =>
    new BrowserSession({
      cdp_url: init.cdp_url ?? null,
      profile: {
        keep_alive: true,
      },
    });

const connectDirectSession = async (
  useRemote: boolean,
  environment: Required<DirectCliEnvironment>
) => {
  let state = load_direct_state(environment.state_file);
  const session_factory =
    environment.session_factory ?? createDefaultSessionFactory();

  const connectWithState = async (currentState: DirectModeState) => {
    const session = session_factory({ cdp_url: currentState.cdp_url ?? null });
    await session.start();
    await restoreActiveTab(session, currentState);
    return session;
  };

  if (state.cdp_url) {
    try {
      const session = await connectWithState(state);
      return { session, state };
    } catch {
      clear_direct_state(environment.state_file);
      state = {};
    }
  }

  if (useRemote) {
    const cloudClient =
      environment.cloud_client_factory?.() ?? new CloudBrowserClient();
    const browser = await cloudClient.create_browser({});
    state = {
      mode: 'remote',
      cdp_url: browser.cdpUrl,
      session_id: browser.id,
      active_url: null,
    };
    save_direct_state(state, environment.state_file);
    return {
      session: await connectWithState(state),
      state,
    };
  }

  const localLaunch = await (
    environment.local_launcher ?? defaultLocalLauncher
  )({
    state,
  });
  state = {
    mode: 'local',
    cdp_url: localLaunch.cdp_url,
    browser_pid: localLaunch.browser_pid ?? null,
    user_data_dir: localLaunch.user_data_dir ?? null,
    active_url: null,
  };
  save_direct_state(state, environment.state_file);
  return {
    session: await connectWithState(state),
    state,
  };
};

const updateDirectStateFromSession = async (
  session: DirectSessionLike,
  state: DirectModeState,
  environment: Required<DirectCliEnvironment>
) => {
  const currentPage = await session.get_current_page?.();
  const active_url =
    typeof currentPage?.url === 'function'
      ? String(currentPage.url() ?? '')
      : session.active_tab?.url ?? null;

  save_direct_state(
    {
      ...state,
      active_url:
        typeof active_url === 'string' && active_url.trim().length > 0
          ? active_url
          : null,
    },
    environment.state_file
  );
};

export const run_direct_command = async (
  argv: string[],
  options: DirectCliEnvironment = {}
) => {
  const environment: Required<DirectCliEnvironment> = {
    state_file: options.state_file ?? DIRECT_STATE_FILE,
    stdout: options.stdout ?? DEFAULT_STDOUT,
    stderr: options.stderr ?? DEFAULT_STDERR,
    session_factory:
      options.session_factory ?? createDefaultSessionFactory(),
    cloud_client_factory:
      options.cloud_client_factory ?? (() => new CloudBrowserClient()),
    local_launcher: options.local_launcher ?? defaultLocalLauncher,
    kill_process:
      options.kill_process ??
      ((pid: number) => {
        process.kill(pid, 'SIGTERM');
      }),
  };

  const useRemote = argv.includes('--remote');
  const args = argv.filter((arg) => arg !== '--remote');
  const command = args[0] ?? '';

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    writeLine(environment.stdout, formatDirectUsage());
    return command ? 0 : 1;
  }

  if (command === 'close') {
    const state = load_direct_state(environment.state_file);
    if (!state.cdp_url) {
      writeLine(environment.stdout, 'No active browser session');
      clear_direct_state(environment.state_file);
      return 0;
    }

    if (state.mode === 'remote' && state.session_id) {
      try {
        await environment.cloud_client_factory().stop_browser(state.session_id);
      } catch {
        // Best-effort remote cleanup.
      }
    } else if (typeof state.browser_pid === 'number' && state.browser_pid > 0) {
      try {
        await environment.kill_process(state.browser_pid);
      } catch {
        // Ignore close errors for an already-exited browser.
      }
    }

    clear_direct_state(environment.state_file);
    writeLine(environment.stdout, 'Browser closed');
    return 0;
  }

  let connected:
    | Awaited<ReturnType<typeof connectDirectSession>>
    | null = null;
  try {
    connected = await connectDirectSession(useRemote, environment);
    const { session, state } = connected;

    if (command === 'open') {
      const url = normalizeDirectUrl(args[1] ?? '');
      if (!url) {
        throw new Error('Missing url');
      }
      await session.navigate_to?.(url);
      writeLine(environment.stdout, `Navigated to: ${url}`);
    } else if (command === 'state') {
      const summary = await session.get_browser_state_with_recovery?.({
        include_screenshot: false,
      });
      if (!summary) {
        throw new Error('No browser state available');
      }
      const pageInfo = await session.get_page_info?.();
      let output = summary.llm_representation();
      if (pageInfo) {
        output =
          `viewport: ${pageInfo.viewport_width}x${pageInfo.viewport_height}\n` +
          `page: ${pageInfo.page_width}x${pageInfo.page_height}\n` +
          `scroll: (${pageInfo.scroll_x}, ${pageInfo.scroll_y})\n` +
          output;
      }
      writeLine(environment.stdout, output);
    } else if (command === 'click') {
      const numericArgs = args.slice(1).map((arg) => Number(arg));
      if (numericArgs.length === 2 && numericArgs.every(Number.isFinite)) {
        const [x, y] = numericArgs;
        await session.click_coordinates?.(x!, y!);
        writeLine(environment.stdout, `Clicked at (${x}, ${y})`);
      } else if (
        numericArgs.length === 1 &&
        Number.isFinite(numericArgs[0] ?? Number.NaN)
      ) {
        const node = await session.get_dom_element_by_index?.(numericArgs[0]!);
        if (!node) {
          throw new Error(
            `Element index ${numericArgs[0]} not found - run "state" first`
          );
        }
        await session._click_element_node?.(node);
        writeLine(environment.stdout, `Clicked element [${numericArgs[0]}]`);
      } else {
        throw new Error('Usage: click <index> or click <x> <y>');
      }
    } else if (command === 'type') {
      const text = args.slice(1).join(' ').trim();
      if (!text) {
        throw new Error('Missing text');
      }
      await session.send_keys?.(text);
      writeLine(environment.stdout, `Typed: ${text}`);
    } else if (command === 'input') {
      const index = Number(args[1] ?? Number.NaN);
      const text = args.slice(2).join(' ').trim();
      if (!Number.isFinite(index) || !text) {
        throw new Error('Usage: input <index> <text>');
      }
      const node = await session.get_dom_element_by_index?.(index);
      if (!node) {
        throw new Error(`Element index ${index} not found - run "state" first`);
      }
      await session._input_text_element_node?.(node, text, { clear: true });
      writeLine(environment.stdout, `Typed "${text}" into element [${index}]`);
    } else if (command === 'screenshot') {
      const outputPath = args[1] ? path.resolve(args[1]) : null;
      const screenshot = await session.take_screenshot?.(false);
      if (!screenshot) {
        throw new Error('Failed to capture screenshot');
      }
      const bytes = Buffer.from(screenshot, 'base64');
      if (outputPath) {
        fs.writeFileSync(outputPath, bytes);
        writeLine(
          environment.stdout,
          `Screenshot saved to ${outputPath} (${bytes.length} bytes)`
        );
      } else {
        writeLine(
          environment.stdout,
          JSON.stringify({
            screenshot,
            size_bytes: bytes.length,
          })
        );
      }
    } else if (command === 'scroll') {
      const direction =
        args[1] === 'up' || args[1] === 'left' || args[1] === 'right'
          ? (args[1] as 'up' | 'left' | 'right')
          : 'down';
      await session.scroll?.(direction, 500);
      writeLine(environment.stdout, `Scrolled ${direction}`);
    } else if (command === 'back') {
      await session.go_back?.();
      writeLine(environment.stdout, 'Navigated back');
    } else if (command === 'keys') {
      const keys = args.slice(1).join(' ').trim();
      if (!keys) {
        throw new Error('Missing keys');
      }
      await session.send_keys?.(keys);
      writeLine(environment.stdout, `Sent keys: ${keys}`);
    } else if (command === 'html') {
      const selector = args.slice(1).join(' ').trim();
      if (!selector) {
        writeLine(environment.stdout, (await session.get_page_html?.()) ?? '');
      } else {
        const page = await session.get_current_page?.();
        if (!page?.evaluate) {
          throw new Error('No active page available for html');
        }
        const html = await page.evaluate((targetSelector: string) => {
          const element = document.querySelector(targetSelector);
          return element ? element.outerHTML : null;
        }, selector);
        if (typeof html !== 'string' || html.length === 0) {
          throw new Error(`No element found for selector: ${selector}`);
        }
        writeLine(environment.stdout, html);
      }
    } else if (command === 'eval') {
      const script = args.slice(1).join(' ').trim();
      if (!script) {
        throw new Error('Missing js');
      }
      const result = await session.execute_javascript?.(script);
      writeLine(
        environment.stdout,
        result === undefined ? 'undefined' : JSON.stringify(result)
      );
    } else {
      throw new Error(`Unknown command: ${command}`);
    }

    await updateDirectStateFromSession(session, state, environment);
    await cleanupDirectSession(session);
    return 0;
  } catch (error) {
    if (connected?.session) {
      await cleanupDirectSession(connected.session);
    }
    writeLine(
      environment.stderr,
      `Error: ${(error as Error)?.message ?? String(error)}`
    );
    return 1;
  }
};

export const main = async (argv: string[] = process.argv.slice(2)) => {
  const exitCode = await run_direct_command(argv);
  if (import.meta.url === `file://${process.argv[1]}`) {
    process.exit(exitCode);
  }
  return exitCode;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
