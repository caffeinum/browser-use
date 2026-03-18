#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { Agent } from './agent/service.js';
import {
  BrowserProfile,
  type BrowserProfileOptions,
} from './browser/profile.js';
import { BrowserSession, systemChrome } from './browser/session.js';
import { CONFIG } from './config.js';
import { ChatOpenAI } from './llm/openai/chat.js';
import { ChatAnthropic } from './llm/anthropic/chat.js';
import { ChatGoogle } from './llm/google/chat.js';
import { ChatDeepSeek } from './llm/deepseek/chat.js';
import { ChatGroq } from './llm/groq/chat.js';
import { ChatOpenRouter } from './llm/openrouter/chat.js';
import { ChatAzure } from './llm/azure/chat.js';
import { ChatOllama } from './llm/ollama/chat.js';
import { ChatMistral } from './llm/mistral/chat.js';
import { ChatCerebras } from './llm/cerebras/chat.js';
import { ChatVercel } from './llm/vercel/chat.js';
import { ChatAnthropicBedrock } from './llm/aws/chat-anthropic.js';
import { ChatBedrockConverse } from './llm/aws/chat-bedrock.js';
import { ChatBrowserUse } from './llm/browser-use/chat.js';
import type { BaseChatModel } from './llm/base.js';
import { MCPServer } from './mcp/server.js';
import { get_browser_use_version } from './utils.js';
import { setupLogging } from './logging-config.js';
import dotenv from 'dotenv';

dotenv.config();

type CliModelProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'deepseek'
  | 'groq'
  | 'openrouter'
  | 'azure'
  | 'mistral'
  | 'cerebras'
  | 'vercel'
  | 'oci'
  | 'aws-anthropic'
  | 'aws'
  | 'ollama'
  | 'browser-use';

const CLI_PROVIDER_ALIASES: Record<string, CliModelProvider> = {
  openai: 'openai',
  anthropic: 'anthropic',
  google: 'google',
  gemini: 'google',
  deepseek: 'deepseek',
  groq: 'groq',
  openrouter: 'openrouter',
  azure: 'azure',
  mistral: 'mistral',
  cerebras: 'cerebras',
  vercel: 'vercel',
  oci: 'oci',
  ollama: 'ollama',
  'browser-use': 'browser-use',
  browseruse: 'browser-use',
  bu: 'browser-use',
  bedrock: 'aws',
  aws: 'aws',
  'aws-anthropic': 'aws-anthropic',
  'bedrock-anthropic': 'aws-anthropic',
};

export interface ParsedCliArgs {
  help: boolean;
  version: boolean;
  debug: boolean;
  headless: boolean | null;
  window_width: number | null;
  window_height: number | null;
  user_data_dir: string | null;
  profile_directory: string | null;
  allowed_domains: string[] | null;
  proxy_url: string | null;
  no_proxy: string | null;
  proxy_username: string | null;
  proxy_password: string | null;
  cdp_url: string | null;
  model: string | null;
  provider: CliModelProvider | null;
  prompt: string | null;
  mcp: boolean;
  positional: string[];
}

export const CLI_HISTORY_LIMIT = 100;

const INTERACTIVE_EXIT_COMMANDS = new Set(['exit', 'quit', ':q', '/q', '.q']);

const INTERACTIVE_HELP_COMMANDS = new Set(['help', '?', ':help']);

const parseAllowedDomains = (value: string): string[] => {
  const domains = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (domains.length === 0) {
    throw new Error(
      '--allowed-domains must include at least one domain pattern'
    );
  }
  return domains;
};

const parsePositiveInt = (name: string, value: string): number => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer, got "${value}"`);
  }
  return parsed;
};

const parseProvider = (value: string): CliModelProvider => {
  const normalized = value.trim().toLowerCase();
  const provider = CLI_PROVIDER_ALIASES[normalized];
  if (!provider) {
    throw new Error(
      `Unsupported provider "${value}". Supported values: openai, anthropic, google, deepseek, groq, openrouter, azure, mistral, cerebras, vercel, oci, ollama, browser-use, aws, aws-anthropic.`
    );
  }
  return provider;
};

const takeOptionValue = (
  arg: string,
  currentIndex: number,
  argv: string[]
): { value: string; nextIndex: number } => {
  const eqIndex = arg.indexOf('=');
  if (eqIndex >= 0) {
    const inlineValue = arg.slice(eqIndex + 1).trim();
    if (!inlineValue) {
      throw new Error(`Missing value for option: ${arg.slice(0, eqIndex)}`);
    }
    return { value: inlineValue, nextIndex: currentIndex };
  }

  const next = argv[currentIndex + 1];
  if (!next || next.startsWith('-')) {
    throw new Error(`Missing value for option: ${arg}`);
  }
  return { value: next, nextIndex: currentIndex + 1 };
};

const expandHome = (value: string): string => {
  if (!value.startsWith('~')) {
    return value;
  }
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (!home) {
    return value;
  }
  if (value === '~') {
    return home;
  }
  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return path.join(home, value.slice(2));
  }
  return value;
};

export const parseCliArgs = (argv: string[]): ParsedCliArgs => {
  const parsed: ParsedCliArgs = {
    help: false,
    version: false,
    debug: false,
    headless: null,
    window_width: null,
    window_height: null,
    user_data_dir: null,
    profile_directory: null,
    allowed_domains: null,
    proxy_url: null,
    no_proxy: null,
    proxy_username: null,
    proxy_password: null,
    cdp_url: null,
    model: null,
    provider: null,
    prompt: null,
    mcp: false,
    positional: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--') {
      parsed.positional.push(...argv.slice(i + 1));
      break;
    }

    if (arg === '-h' || arg === '--help') {
      parsed.help = true;
      continue;
    }
    if (arg === '--version') {
      parsed.version = true;
      continue;
    }
    if (arg === '--debug') {
      parsed.debug = true;
      continue;
    }
    if (arg === '--headless') {
      parsed.headless = true;
      continue;
    }
    if (arg === '--mcp') {
      parsed.mcp = true;
      continue;
    }

    if (arg === '-p' || arg === '--prompt' || arg.startsWith('--prompt=')) {
      const { value, nextIndex } = takeOptionValue(arg, i, argv);
      parsed.prompt = value;
      i = nextIndex;
      continue;
    }
    if (arg === '--model' || arg.startsWith('--model=')) {
      const { value, nextIndex } = takeOptionValue(arg, i, argv);
      parsed.model = value;
      i = nextIndex;
      continue;
    }
    if (arg === '--provider' || arg.startsWith('--provider=')) {
      const { value, nextIndex } = takeOptionValue(arg, i, argv);
      parsed.provider = parseProvider(value);
      i = nextIndex;
      continue;
    }
    if (arg === '--window-width' || arg.startsWith('--window-width=')) {
      const { value, nextIndex } = takeOptionValue(arg, i, argv);
      parsed.window_width = parsePositiveInt('--window-width', value);
      i = nextIndex;
      continue;
    }
    if (arg === '--window-height' || arg.startsWith('--window-height=')) {
      const { value, nextIndex } = takeOptionValue(arg, i, argv);
      parsed.window_height = parsePositiveInt('--window-height', value);
      i = nextIndex;
      continue;
    }
    if (arg === '--user-data-dir' || arg.startsWith('--user-data-dir=')) {
      const { value, nextIndex } = takeOptionValue(arg, i, argv);
      parsed.user_data_dir = path.resolve(expandHome(value));
      i = nextIndex;
      continue;
    }
    if (
      arg === '--profile-directory' ||
      arg.startsWith('--profile-directory=')
    ) {
      const { value, nextIndex } = takeOptionValue(arg, i, argv);
      parsed.profile_directory = value;
      i = nextIndex;
      continue;
    }
    if (arg === '--allowed-domains' || arg.startsWith('--allowed-domains=')) {
      const { value, nextIndex } = takeOptionValue(arg, i, argv);
      const domains = parseAllowedDomains(value);
      parsed.allowed_domains = [...(parsed.allowed_domains ?? []), ...domains];
      i = nextIndex;
      continue;
    }
    if (arg === '--proxy-url' || arg.startsWith('--proxy-url=')) {
      const { value, nextIndex } = takeOptionValue(arg, i, argv);
      parsed.proxy_url = value.trim();
      i = nextIndex;
      continue;
    }
    if (arg === '--no-proxy' || arg.startsWith('--no-proxy=')) {
      const { value, nextIndex } = takeOptionValue(arg, i, argv);
      parsed.no_proxy = value;
      i = nextIndex;
      continue;
    }
    if (arg === '--proxy-username' || arg.startsWith('--proxy-username=')) {
      const { value, nextIndex } = takeOptionValue(arg, i, argv);
      parsed.proxy_username = value;
      i = nextIndex;
      continue;
    }
    if (arg === '--proxy-password' || arg.startsWith('--proxy-password=')) {
      const { value, nextIndex } = takeOptionValue(arg, i, argv);
      parsed.proxy_password = value;
      i = nextIndex;
      continue;
    }
    if (arg === '--cdp-url' || arg.startsWith('--cdp-url=')) {
      const { value, nextIndex } = takeOptionValue(arg, i, argv);
      parsed.cdp_url = value;
      i = nextIndex;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }
    parsed.positional.push(arg);
  }

  if (parsed.prompt && parsed.positional.length > 0) {
    throw new Error('Use either positional task text or --prompt, not both.');
  }

  return parsed;
};

const resolveTask = (args: ParsedCliArgs): string | null => {
  if (args.prompt) {
    return args.prompt.trim();
  }
  if (args.positional.length > 0) {
    return args.positional.join(' ').trim();
  }
  return null;
};

export const isInteractiveExitCommand = (value: string): boolean =>
  INTERACTIVE_EXIT_COMMANDS.has(value.trim().toLowerCase());

export const isInteractiveHelpCommand = (value: string): boolean =>
  INTERACTIVE_HELP_COMMANDS.has(value.trim().toLowerCase());

export const normalizeCliHistory = (
  history: unknown[],
  maxLength = CLI_HISTORY_LIMIT
): string[] => {
  const normalized = history
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);
  return normalized.slice(-maxLength);
};

export const getCliHistoryPath = (configDir?: string | null): string => {
  const baseDir =
    configDir ??
    CONFIG.BROWSER_USE_CONFIG_DIR ??
    path.join(os.homedir(), '.config', 'browseruse');
  return path.join(baseDir, 'command_history.json');
};

export const loadCliHistory = async (
  historyPath = getCliHistoryPath()
): Promise<string[]> => {
  try {
    const raw = await fs.readFile(historyPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return normalizeCliHistory(parsed);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      return [];
    }
    return [];
  }
};

export const saveCliHistory = async (
  history: string[],
  historyPath = getCliHistoryPath()
): Promise<void> => {
  const normalized = normalizeCliHistory(history);
  await fs.mkdir(path.dirname(historyPath), { recursive: true });
  await fs.writeFile(historyPath, JSON.stringify(normalized, null, 2), 'utf-8');
};

export const shouldStartInteractiveMode = (
  task: string | null,
  options: {
    forceInteractive?: boolean;
    inputIsTTY?: boolean;
    outputIsTTY?: boolean;
  } = {}
): boolean => {
  const forceInteractive =
    options.forceInteractive ??
    process.env.BROWSER_USE_CLI_FORCE_INTERACTIVE === '1';
  const inputIsTTY = options.inputIsTTY ?? Boolean(stdin.isTTY);
  const outputIsTTY = options.outputIsTTY ?? Boolean(stdout.isTTY);
  return !task && (forceInteractive || (inputIsTTY && outputIsTTY));
};

const requireEnv = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
};

const inferProviderFromModel = (model: string): CliModelProvider | null => {
  const lower = model.toLowerCase();

  if (
    lower.startsWith('gpt') ||
    lower.startsWith('o1') ||
    lower.startsWith('o3') ||
    lower.startsWith('o4') ||
    lower.startsWith('gpt-5')
  ) {
    return 'openai';
  }
  if (lower.startsWith('claude')) {
    return 'anthropic';
  }
  if (lower.startsWith('gemini')) {
    return 'google';
  }
  if (lower.startsWith('deepseek')) {
    return 'deepseek';
  }
  if (lower.startsWith('groq:')) {
    return 'groq';
  }
  if (lower.startsWith('openrouter:')) {
    return 'openrouter';
  }
  if (lower.startsWith('azure:')) {
    return 'azure';
  }
  if (lower.startsWith('mistral:')) {
    return 'mistral';
  }
  if (lower.startsWith('cerebras:')) {
    return 'cerebras';
  }
  if (lower.startsWith('vercel:')) {
    return 'vercel';
  }
  if (lower.startsWith('oci:')) {
    return 'oci';
  }
  if (
    lower.startsWith('mistral-') ||
    lower.startsWith('codestral') ||
    lower.startsWith('pixtral')
  ) {
    return 'mistral';
  }
  if (
    lower.startsWith('llama3.') ||
    lower.startsWith('llama-4-') ||
    lower.startsWith('gpt-oss-') ||
    lower.startsWith('qwen-3-')
  ) {
    return 'cerebras';
  }
  if (lower.startsWith('ollama:')) {
    return 'ollama';
  }
  if (
    lower.startsWith('browser-use:') ||
    lower.startsWith('bu-') ||
    lower.startsWith('browser-use/')
  ) {
    return 'browser-use';
  }
  if (lower.startsWith('bedrock:anthropic.')) {
    return 'aws-anthropic';
  }
  if (lower.startsWith('bedrock:')) {
    return 'aws';
  }
  if (lower.startsWith('anthropic.')) {
    return 'aws-anthropic';
  }
  if (
    lower.includes('/') &&
    !lower.startsWith('http://') &&
    !lower.startsWith('https://')
  ) {
    return 'openrouter';
  }
  return null;
};

const normalizeModelValue = (
  model: string,
  provider: CliModelProvider
): string => {
  const lower = model.toLowerCase();
  if (provider === 'groq' && lower.startsWith('groq:')) {
    return model.slice('groq:'.length);
  }
  if (provider === 'openrouter' && lower.startsWith('openrouter:')) {
    return model.slice('openrouter:'.length);
  }
  if (provider === 'azure' && lower.startsWith('azure:')) {
    return model.slice('azure:'.length);
  }
  if (provider === 'mistral' && lower.startsWith('mistral:')) {
    return model.slice('mistral:'.length);
  }
  if (provider === 'cerebras' && lower.startsWith('cerebras:')) {
    return model.slice('cerebras:'.length);
  }
  if (provider === 'vercel' && lower.startsWith('vercel:')) {
    return model.slice('vercel:'.length);
  }
  if (provider === 'oci' && lower.startsWith('oci:')) {
    return model.slice('oci:'.length);
  }
  if (provider === 'ollama' && lower.startsWith('ollama:')) {
    return model.slice('ollama:'.length);
  }
  if (provider === 'browser-use' && lower.startsWith('browser-use:')) {
    return model.slice('browser-use:'.length);
  }
  if (provider === 'browser-use' && lower.startsWith('bu_')) {
    return model.replace(/_/g, '-');
  }
  if (provider === 'aws-anthropic' && lower.startsWith('bedrock:')) {
    return model.slice('bedrock:'.length);
  }
  if (provider === 'aws' && lower.startsWith('bedrock:')) {
    return model.slice('bedrock:'.length);
  }
  return model;
};

const providersAreCompatible = (
  explicitProvider: CliModelProvider,
  inferredProvider: CliModelProvider
): boolean => {
  if (explicitProvider === inferredProvider) {
    return true;
  }
  if (
    (explicitProvider === 'aws' && inferredProvider === 'aws-anthropic') ||
    (explicitProvider === 'aws-anthropic' && inferredProvider === 'aws')
  ) {
    return true;
  }
  return false;
};

const getDefaultModelForProvider = (
  provider: CliModelProvider
): string | null => {
  switch (provider) {
    case 'openai':
      return 'gpt-5-mini';
    case 'anthropic':
      return 'claude-4-sonnet';
    case 'google':
      return 'gemini-2.5-pro';
    case 'deepseek':
      return 'deepseek-chat';
    case 'groq':
      return 'llama-3.1-70b-versatile';
    case 'openrouter':
      return 'openai/gpt-5-mini';
    case 'azure':
      return 'gpt-4o';
    case 'mistral':
      return 'mistral-large-latest';
    case 'cerebras':
      return 'llama3.1-8b';
    case 'vercel':
      return 'openai/gpt-5-mini';
    case 'oci':
      return null;
    case 'aws-anthropic':
      return 'anthropic.claude-3-5-sonnet-20241022-v2:0';
    case 'ollama':
      return process.env.OLLAMA_MODEL || 'qwen2.5:latest';
    case 'browser-use':
      return 'bu-latest';
    case 'aws':
      return null;
    default:
      return null;
  }
};

const createLlmForProvider = (
  provider: CliModelProvider,
  model: string
): BaseChatModel => {
  switch (provider) {
    case 'openai':
      return new ChatOpenAI({
        model,
        apiKey: requireEnv('OPENAI_API_KEY'),
      });
    case 'anthropic':
      return new ChatAnthropic({
        model,
        apiKey: requireEnv('ANTHROPIC_API_KEY'),
      });
    case 'google':
      requireEnv('GOOGLE_API_KEY');
      return new ChatGoogle(model);
    case 'deepseek':
      requireEnv('DEEPSEEK_API_KEY');
      return new ChatDeepSeek(model);
    case 'groq':
      requireEnv('GROQ_API_KEY');
      return new ChatGroq(model);
    case 'openrouter':
      requireEnv('OPENROUTER_API_KEY');
      return new ChatOpenRouter(model);
    case 'azure':
      requireEnv('AZURE_OPENAI_API_KEY');
      requireEnv('AZURE_OPENAI_ENDPOINT');
      return new ChatAzure(model);
    case 'mistral':
      return new ChatMistral({
        model,
        apiKey: requireEnv('MISTRAL_API_KEY'),
        baseURL: process.env.MISTRAL_BASE_URL,
      });
    case 'cerebras':
      return new ChatCerebras({
        model,
        apiKey: requireEnv('CEREBRAS_API_KEY'),
        baseURL: process.env.CEREBRAS_BASE_URL,
      });
    case 'vercel':
      return new ChatVercel({
        model,
        apiKey: requireEnv('VERCEL_API_KEY'),
        baseURL: process.env.VERCEL_BASE_URL,
      });
    case 'oci':
      throw new Error(
        'OCI models require manual configuration in TypeScript runtime. Use ChatOCIRaw directly with your OCI credentials and endpoint setup.'
      );
    case 'ollama': {
      const host = process.env.OLLAMA_HOST || 'http://localhost:11434';
      return new ChatOllama(model, host);
    }
    case 'browser-use':
      return new ChatBrowserUse({
        model,
        apiKey: requireEnv('BROWSER_USE_API_KEY'),
      });
    case 'aws-anthropic':
      return new ChatAnthropicBedrock({
        model,
        region: process.env.AWS_REGION || 'us-east-1',
      });
    case 'aws':
      return new ChatBedrockConverse(
        model,
        process.env.AWS_REGION || 'us-east-1'
      );
    default:
      throw new Error(`Unsupported provider "${provider}"`);
  }
};

export const getLlmFromCliArgs = (args: ParsedCliArgs): BaseChatModel => {
  if (args.model) {
    const inferredProvider = inferProviderFromModel(args.model);
    if (
      args.provider &&
      inferredProvider &&
      !providersAreCompatible(args.provider, inferredProvider)
    ) {
      throw new Error(
        `Provider mismatch: --provider ${args.provider} conflicts with model "${args.model}" (inferred: ${inferredProvider}).`
      );
    }

    const provider = args.provider ?? inferredProvider;
    if (!provider) {
      throw new Error(
        `Cannot infer provider from model "${args.model}". Provide --provider or use a supported model prefix: gpt*/o*, claude*, gemini*, deepseek*, groq:, openrouter:, azure:, mistral:, cerebras:, vercel:, oci:, ollama:, browser-use:, bu-*, bedrock:.`
      );
    }
    const normalizedModel = normalizeModelValue(args.model, provider);
    return createLlmForProvider(provider, normalizedModel);
  }

  if (args.provider) {
    const defaultModel = getDefaultModelForProvider(args.provider);
    if (!defaultModel) {
      throw new Error(
        `Provider "${args.provider}" requires --model. Example: --provider aws --model bedrock:us.amazon.nova-lite-v1:0`
      );
    }
    return createLlmForProvider(args.provider, defaultModel);
  }

  if (process.env.OPENAI_API_KEY) {
    return new ChatOpenAI({
      model: 'gpt-5-mini',
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return new ChatAnthropic({
      model: 'claude-4-sonnet',
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  if (process.env.GOOGLE_API_KEY) {
    return new ChatGoogle('gemini-2.5-pro');
  }
  if (process.env.DEEPSEEK_API_KEY) {
    return new ChatDeepSeek('deepseek-chat');
  }
  if (process.env.GROQ_API_KEY) {
    return new ChatGroq('llama-3.1-70b-versatile');
  }
  if (process.env.OPENROUTER_API_KEY) {
    return new ChatOpenRouter('openai/gpt-5-mini');
  }
  if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT) {
    return new ChatAzure('gpt-4o');
  }
  if (process.env.MISTRAL_API_KEY) {
    return new ChatMistral({
      model: 'mistral-large-latest',
      apiKey: process.env.MISTRAL_API_KEY,
      baseURL: process.env.MISTRAL_BASE_URL,
    });
  }
  if (process.env.CEREBRAS_API_KEY) {
    return new ChatCerebras({
      model: 'llama3.1-8b',
      apiKey: process.env.CEREBRAS_API_KEY,
      baseURL: process.env.CEREBRAS_BASE_URL,
    });
  }
  if (process.env.VERCEL_API_KEY) {
    return new ChatVercel({
      model: 'openai/gpt-5-mini',
      apiKey: process.env.VERCEL_API_KEY,
      baseURL: process.env.VERCEL_BASE_URL,
    });
  }
  if (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE) {
    return new ChatAnthropicBedrock({
      model: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }

  return new ChatOllama(
    process.env.OLLAMA_MODEL || 'qwen2.5:latest',
    process.env.OLLAMA_HOST || 'http://localhost:11434'
  );
};

const parseCommaSeparatedList = (value: string): string[] =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

export const buildBrowserProfileFromCliArgs = (
  args: ParsedCliArgs
): BrowserProfile | null => {
  const profile: Partial<BrowserProfileOptions> = {};

  if (args.headless !== null) {
    profile.headless = args.headless;
  }
  if (args.window_width !== null) {
    profile.window_width = args.window_width;
  }
  if (args.window_height !== null) {
    profile.window_height = args.window_height;
  }
  if (args.user_data_dir) {
    profile.user_data_dir = args.user_data_dir;
  }
  if (args.profile_directory) {
    profile.profile_directory = args.profile_directory;
  }
  if (args.allowed_domains && args.allowed_domains.length > 0) {
    profile.allowed_domains = args.allowed_domains;
  }
  if (
    args.proxy_url ||
    args.no_proxy ||
    args.proxy_username ||
    args.proxy_password
  ) {
    const proxy: Record<string, string> = {};
    if (args.proxy_url) {
      proxy.server = args.proxy_url;
    }
    if (args.no_proxy) {
      proxy.bypass = parseCommaSeparatedList(args.no_proxy).join(',');
    }
    if (args.proxy_username) {
      proxy.username = args.proxy_username;
    }
    if (args.proxy_password) {
      proxy.password = args.proxy_password;
    }
    profile.proxy = proxy as BrowserProfileOptions['proxy'];
  }

  if (Object.keys(profile).length === 0) {
    return null;
  }
  return new BrowserProfile(profile);
};

interface RunAgentTaskOptions {
  task: string;
  llm: BaseChatModel;
  browserProfile?: BrowserProfile | null;
  browserSession?: BrowserSession | null;
  sessionAttachmentMode?: 'copy' | 'strict' | 'shared';
}

const runAgentTask = async ({
  task,
  llm,
  browserProfile,
  browserSession,
  sessionAttachmentMode,
}: RunAgentTaskOptions): Promise<void> => {
  const agent = new Agent({
    task,
    llm,
    ...(browserProfile ? { browser_profile: browserProfile } : {}),
    ...(browserSession ? { browser_session: browserSession } : {}),
    ...(sessionAttachmentMode
      ? { session_attachment_mode: sessionAttachmentMode }
      : {}),
    source: 'cli',
  });
  await agent.run();
};

const runInteractiveMode = async (
  args: ParsedCliArgs,
  llm: BaseChatModel
): Promise<void> => {
  const historyPath = getCliHistoryPath();
  const history = await loadCliHistory(historyPath);
  const browserProfile =
    buildBrowserProfileFromCliArgs(args) ?? new BrowserProfile();
  browserProfile.keep_alive = true;

  const browserSession = new BrowserSession({
    browser_profile: browserProfile,
    ...(args.cdp_url ? { cdp_url: args.cdp_url } : {}),
  });

  const rl = createInterface({
    input: stdin,
    output: stdout,
    terminal: true,
    historySize: CLI_HISTORY_LIMIT,
  });

  if (Array.isArray((rl as any).history) && history.length > 0) {
    (rl as any).history = [...history].reverse();
  }

  console.log('Interactive mode started. Type a task and press Enter.');
  console.log('Commands: help, exit');

  try {
    while (true) {
      const line = await rl.question('browser-use> ');
      const task = line.trim();

      if (!task) {
        continue;
      }

      if (isInteractiveExitCommand(task)) {
        break;
      }

      if (isInteractiveHelpCommand(task)) {
        console.log('Type any task to run it. Use "exit" to quit.');
        continue;
      }

      history.push(task);
      await saveCliHistory(history, historyPath);

      console.log(`Starting task: ${task}`);
      try {
        await runAgentTask({
          task,
          llm,
          browserProfile,
          browserSession,
          sessionAttachmentMode: 'strict',
        });
      } catch (error) {
        console.error('Error running agent:', error);
      }
    }
  } finally {
    rl.close();
    await saveCliHistory(history, historyPath);

    try {
      if ((browserSession as any)._owns_browser_resources) {
        await browserSession.kill();
      } else {
        await browserSession.stop();
      }
    } catch (error) {
      console.error(
        `Warning: failed to close interactive browser session: ${
          (error as Error).message
        }`
      );
    }
  }
};

export const getCliUsage = () => `Usage:
  browser-use                    # interactive mode (TTY)
  browser-use doctor
  browser-use <task>
  browser-use -p "<task>"
  browser-use [options] <task>
  browser-use --mcp

Options:
  -h, --help                  Show this help message
  --version                   Print version and exit
  --mcp                       Run as MCP server
  --provider <name>           Force provider (openai|anthropic|google|deepseek|groq|openrouter|azure|mistral|cerebras|vercel|oci|ollama|browser-use|aws|aws-anthropic)
  --model <model>             Set model (e.g., gpt-5-mini, claude-4-sonnet, gemini-2.5-pro)
  -p, --prompt <task>         Run a single task
  --headless                  Run browser in headless mode
  --allowed-domains <items>   Comma-separated allowlist (e.g., example.com,*.example.org)
  --window-width <px>         Browser window width
  --window-height <px>        Browser window height
  --user-data-dir <path>      Chrome user data directory
  --profile-directory <name>  Chrome profile directory (Default, Profile 1, ...)
  --proxy-url <url>           Proxy server URL (e.g., http://proxy.example.com:8080)
  --no-proxy <items>          Comma-separated proxy bypass list
  --proxy-username <value>    Proxy username
  --proxy-password <value>    Proxy password
  --cdp-url <url>             Connect to an existing Chromium instance via CDP
  --debug                     Enable debug logging`;

export interface CliDoctorCheck {
  status: 'ok' | 'warning' | 'missing' | 'error';
  message: string;
  note?: string;
  fix?: string;
}

export interface CliDoctorReport {
  status: 'healthy' | 'issues_found';
  checks: Record<string, CliDoctorCheck>;
  summary: string;
}

export interface RunDoctorChecksOptions {
  version?: string;
  browser_executable?: string | null;
  api_key?: string | null;
  cloudflared_path?: string | null;
  fetch_impl?: typeof fetch;
}

const summarizeDoctorChecks = (checks: Record<string, CliDoctorCheck>) => {
  const values = Object.values(checks);
  const total = values.length;
  const ok = values.filter((check) => check.status === 'ok').length;
  const warning = values.filter((check) => check.status === 'warning').length;
  const missing = values.filter((check) => check.status === 'missing').length;
  const error = values.filter((check) => check.status === 'error').length;

  const parts = [`${ok}/${total} checks passed`];
  if (warning > 0) {
    parts.push(`${warning} warnings`);
  }
  if (missing > 0) {
    parts.push(`${missing} missing`);
  }
  if (error > 0) {
    parts.push(`${error} errors`);
  }
  return parts.join(', ');
};

const findSystemBinary = (binary: string) => {
  const command = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(command, [binary], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.status !== 0) {
    return null;
  }
  const firstLine = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine ?? null;
};

export const runDoctorChecks = async (
  options: RunDoctorChecksOptions = {}
): Promise<CliDoctorReport> => {
  const fetchImpl = options.fetch_impl ?? fetch;
  const checks: Record<string, CliDoctorCheck> = {
    package: {
      status: 'ok',
      message: `browser-use ${options.version ?? get_browser_use_version()}`,
    },
    browser: (() => {
      const executable =
        options.browser_executable !== undefined
          ? options.browser_executable
          : systemChrome.findExecutable();
      if (executable) {
        return {
          status: 'ok',
          message: `Chrome detected at ${executable}`,
        };
      }
      return {
        status: 'warning',
        message: 'Chrome executable not detected',
        note: 'Local browser launch may fail until Chrome or Chromium is installed.',
      };
    })(),
    api_key: (() => {
      const apiKey =
        options.api_key !== undefined
          ? options.api_key
          : (process.env.BROWSER_USE_API_KEY ?? null);
      if (typeof apiKey === 'string' && apiKey.trim().length > 0) {
        return {
          status: 'ok',
          message: 'BROWSER_USE_API_KEY is configured',
        };
      }
      return {
        status: 'missing',
        message: 'BROWSER_USE_API_KEY is not configured',
        note: 'Required for browser-use cloud browser features.',
      };
    })(),
    cloudflared: (() => {
      const binaryPath =
        options.cloudflared_path !== undefined
          ? options.cloudflared_path
          : findSystemBinary('cloudflared');
      if (binaryPath) {
        return {
          status: 'ok',
          message: `cloudflared detected at ${binaryPath}`,
        };
      }
      return {
        status: 'missing',
        message: 'cloudflared not found',
        note: 'Tunnel features remain unavailable until cloudflared is installed.',
      };
    })(),
    network: {
      status: 'warning',
      message: 'Network connectivity check inconclusive',
      note: 'Some remote features may not work offline.',
    },
  };

  try {
    const response = await fetchImpl('https://api.github.com', {
      method: 'HEAD',
    });
    if (response.ok || response.status < 500) {
      checks.network = {
        status: 'ok',
        message: 'Network connectivity OK',
      };
    }
  } catch {
    checks.network = {
      status: 'warning',
      message: 'Network connectivity check inconclusive',
      note: 'Some remote features may not work offline.',
    };
  }

  const allOk = Object.values(checks).every((check) => check.status === 'ok');
  return {
    status: allOk ? 'healthy' : 'issues_found',
    checks,
    summary: summarizeDoctorChecks(checks),
  };
};

const printDoctorReport = (report: CliDoctorReport) => {
  console.log(`status: ${report.status}`);
  console.log(`summary: ${report.summary}`);
  for (const [name, check] of Object.entries(report.checks)) {
    console.log(`${name}: ${check.status} - ${check.message}`);
    if (check.note) {
      console.log(`  note: ${check.note}`);
    }
    if (check.fix) {
      console.log(`  fix: ${check.fix}`);
    }
  }
};

async function runMcpServer() {
  const server = new MCPServer('browser-use', get_browser_use_version());
  await server.start();

  const shutdown = async () => {
    await server.stop();
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());

  await new Promise(() => {});
}

export async function main(argv: string[] = process.argv.slice(2)) {
  let args: ParsedCliArgs;
  try {
    args = parseCliArgs(argv);
  } catch (error) {
    console.error((error as Error).message);
    console.error(getCliUsage());
    process.exit(1);
    return;
  }

  if (args.help) {
    console.log(getCliUsage());
    return;
  }

  if (args.version) {
    console.log(get_browser_use_version());
    return;
  }

  if (args.debug) {
    process.env.BROWSER_USE_LOGGING_LEVEL = 'debug';
    setupLogging({ logLevel: 'debug', forceSetup: true });
  }

  if (args.mcp) {
    await runMcpServer();
    return;
  }

  if (args.prompt == null && args.positional[0] === 'doctor') {
    const report = await runDoctorChecks();
    printDoctorReport(report);
    return;
  }

  const task = resolveTask(args);
  const shouldStartInteractive = shouldStartInteractiveMode(task);
  if (!task && !shouldStartInteractive) {
    console.error(getCliUsage());
    process.exit(1);
    return;
  }

  let llm: BaseChatModel;
  try {
    llm = getLlmFromCliArgs(args);
  } catch (error) {
    console.error(`Error selecting LLM: ${(error as Error).message}`);
    process.exit(1);
    return;
  }

  if (shouldStartInteractive) {
    await runInteractiveMode(args, llm);
    return;
  }

  if (!task) {
    console.error(getCliUsage());
    process.exit(1);
    return;
  }

  console.log(`Starting task: ${task}`);

  const browserProfile = buildBrowserProfileFromCliArgs(args);
  const browserSession = args.cdp_url
    ? new BrowserSession({
        browser_profile: browserProfile ?? undefined,
        cdp_url: args.cdp_url,
      })
    : null;
  try {
    await runAgentTask({
      task,
      llm,
      browserProfile,
      browserSession,
    });
  } catch (error) {
    console.error('Error running agent:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
