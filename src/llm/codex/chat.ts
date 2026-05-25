import OpenAI from 'openai';
import type { BaseChatModel, ChatInvokeOptions } from '../base.js';
import { ModelProviderError, ModelRateLimitError } from '../exceptions.js';
import type { Message } from '../messages.js';
import { ResponsesAPIMessageSerializer } from '../openai/responses-serializer.js';
import { SchemaOptimizer, zodSchemaToJsonSchema } from '../schema.js';
import { ChatInvokeCompletion, type ChatInvokeUsage } from '../views.js';
import {
  CodexAuthError,
  DEFAULT_CODEX_BASE_URL,
  getCodexCloudflareHeaders,
  resolveCodexRuntimeCredentials,
} from './auth.js';

export interface ChatCodexOptions {
  model?: string;
  apiKey?: string | null;
  baseURL?: string | null;
  timeout?: number | null;
  maxRetries?: number;
  defaultHeaders?: Record<string, string> | null;
  defaultQuery?: Record<string, string | undefined> | null;
  fetchImplementation?: typeof fetch;
  fetchOptions?: RequestInit | null;
  reasoningEffort?: 'low' | 'medium' | 'high';
  maxCompletionTokens?: number | null;
  topP?: number | null;
  seed?: number | null;
  serviceTier?: 'auto' | 'default' | 'flex' | 'priority' | 'scale' | null;
  include?: string[] | null;
  addSchemaToSystemPrompt?: boolean;
  dontForceStructuredOutput?: boolean;
  removeMinItemsFromSchema?: boolean;
  removeDefaultsFromSchema?: boolean;
  configDir?: string | null;
  authStorePath?: string | null;
  refreshSkewSeconds?: number;
}

interface CodexClientConfig {
  apiKey: string;
  baseURL: string;
}

const isCodexBackendURL = (baseURL: string): boolean => {
  try {
    const parsed = new URL(baseURL);
    return (
      parsed.hostname === 'chatgpt.com' &&
      parsed.pathname.replace(/\/+$/, '') === '/backend-api/codex'
    );
  } catch {
    return false;
  }
};

export class ChatCodex implements BaseChatModel {
  public model: string;
  public provider = 'codex';
  private apiKey: string | null;
  private baseURL: string;
  private timeout: number | null;
  private maxRetries: number;
  private defaultHeaders: Record<string, string> | null;
  private defaultQuery: Record<string, string | undefined> | null;
  private fetchImplementation: typeof fetch | undefined;
  private fetchOptions: RequestInit | null;
  private reasoningEffort: 'low' | 'medium' | 'high';
  private maxCompletionTokens: number | null;
  private topP: number | null;
  private seed: number | null;
  private serviceTier:
    | 'auto'
    | 'default'
    | 'flex'
    | 'priority'
    | 'scale'
    | null;
  private include: string[] | null;
  private addSchemaToSystemPrompt: boolean;
  private dontForceStructuredOutput: boolean;
  private removeMinItemsFromSchema: boolean;
  private removeDefaultsFromSchema: boolean;
  private configDir: string | null;
  private authStorePath: string | null;
  private refreshSkewSeconds: number | undefined;

  constructor(options: ChatCodexOptions = {}) {
    const {
      model = process.env.BROWSER_USE_CODEX_MODEL ?? 'gpt-5.1-codex',
      apiKey = process.env.BROWSER_USE_CODEX_ACCESS_TOKEN ?? null,
      baseURL = process.env.BROWSER_USE_CODEX_BASE_URL ??
        DEFAULT_CODEX_BASE_URL,
      timeout = null,
      maxRetries = 2,
      defaultHeaders = null,
      defaultQuery = null,
      fetchImplementation,
      fetchOptions = null,
      reasoningEffort = 'low',
      maxCompletionTokens = 4096,
      topP = null,
      seed = null,
      serviceTier = null,
      include = null,
      addSchemaToSystemPrompt = false,
      dontForceStructuredOutput = false,
      removeMinItemsFromSchema = false,
      removeDefaultsFromSchema = false,
      configDir = null,
      authStorePath = null,
      refreshSkewSeconds,
    } = options;

    this.model = model;
    this.apiKey = apiKey?.trim() || null;
    this.baseURL =
      (baseURL ?? '').trim().replace(/\/+$/, '') || DEFAULT_CODEX_BASE_URL;
    this.timeout = timeout;
    this.maxRetries = maxRetries;
    this.defaultHeaders = defaultHeaders;
    this.defaultQuery = defaultQuery;
    this.fetchImplementation = fetchImplementation;
    this.fetchOptions = fetchOptions;
    this.reasoningEffort = reasoningEffort;
    this.maxCompletionTokens = maxCompletionTokens;
    this.topP = topP;
    this.seed = seed;
    this.serviceTier = serviceTier;
    this.include = include ? [...include] : null;
    this.addSchemaToSystemPrompt = addSchemaToSystemPrompt;
    this.dontForceStructuredOutput = dontForceStructuredOutput;
    this.removeMinItemsFromSchema = removeMinItemsFromSchema;
    this.removeDefaultsFromSchema = removeDefaultsFromSchema;
    this.configDir = configDir;
    this.authStorePath = authStorePath;
    this.refreshSkewSeconds = refreshSkewSeconds;
  }

  get name(): string {
    return this.model;
  }

  get model_name(): string {
    return this.model;
  }

  private async resolveClientConfig(
    forceRefresh = false
  ): Promise<CodexClientConfig> {
    if (this.apiKey) {
      return {
        apiKey: this.apiKey,
        baseURL: this.baseURL,
      };
    }

    const credentials = await resolveCodexRuntimeCredentials({
      configDir: this.configDir,
      authStorePath: this.authStorePath,
      baseURL: this.baseURL,
      forceRefresh,
      refreshSkewSeconds: this.refreshSkewSeconds,
      fetchImplementation: this.fetchImplementation,
    });
    return {
      apiKey: credentials.api_key,
      baseURL: credentials.base_url,
    };
  }

  private createClient(config: CodexClientConfig): OpenAI {
    const codexHeaders = isCodexBackendURL(config.baseURL)
      ? getCodexCloudflareHeaders(config.apiKey)
      : {};
    return new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: this.timeout ?? undefined,
      maxRetries: this.maxRetries,
      defaultHeaders: {
        ...codexHeaders,
        ...(this.defaultHeaders ?? {}),
      },
      defaultQuery: this.defaultQuery ?? undefined,
      fetch: this.fetchImplementation,
      fetchOptions: (this.fetchOptions ?? undefined) as any,
    });
  }

  private getResponsesUsage(response: any): ChatInvokeUsage | null {
    if (!response?.usage) {
      return null;
    }

    return {
      prompt_tokens: response.usage.input_tokens ?? 0,
      prompt_cached_tokens:
        response.usage.input_tokens_details?.cached_tokens ?? null,
      prompt_cache_creation_tokens: null,
      prompt_image_tokens: null,
      completion_tokens: response.usage.output_tokens ?? 0,
      total_tokens: response.usage.total_tokens ?? 0,
    };
  }

  private getResponseOutputText(response: any): string {
    if (typeof response?.output_text === 'string') {
      return response.output_text;
    }

    const outputs = Array.isArray(response?.output) ? response.output : [];
    for (const item of outputs) {
      if (Array.isArray(item?.content)) {
        for (const part of item.content) {
          if (typeof part?.text === 'string') {
            return part.text;
          }
          if (typeof part?.output_text === 'string') {
            return part.output_text;
          }
        }
      }
    }

    return '';
  }

  private getModelParamsForResponses(): Record<string, unknown> {
    const modelParams: Record<string, unknown> = {
      store: false,
      reasoning: { effort: this.reasoningEffort },
    };

    if (this.maxCompletionTokens !== null) {
      modelParams.max_output_tokens = this.maxCompletionTokens;
    }
    if (this.topP !== null) {
      modelParams.top_p = this.topP;
    }
    if (this.seed !== null) {
      modelParams.seed = this.seed;
    }
    if (this.serviceTier !== null) {
      modelParams.service_tier = this.serviceTier;
    }
    if (this.include !== null) {
      modelParams.include = this.include;
    }

    return modelParams;
  }

  private getZodSchemaCandidate(
    output_format?: { parse: (input: string) => unknown } | undefined
  ) {
    const output = output_format as any;
    if (
      output &&
      typeof output === 'object' &&
      typeof output.safeParse === 'function' &&
      typeof output.parse === 'function'
    ) {
      return output;
    }
    if (
      output &&
      typeof output === 'object' &&
      output.schema &&
      typeof output.schema.safeParse === 'function' &&
      typeof output.schema.parse === 'function'
    ) {
      return output.schema;
    }
    return null;
  }

  private buildRequest(
    messages: Message[],
    zodSchemaCandidate: any
  ): Record<string, unknown> {
    const serializer = new ResponsesAPIMessageSerializer();
    const inputMessages = serializer.serialize(messages);
    const request: Record<string, unknown> = {
      model: this.model,
      input: inputMessages,
      ...this.getModelParamsForResponses(),
    };

    if (!zodSchemaCandidate) {
      return request;
    }

    try {
      const rawJsonSchema = zodSchemaToJsonSchema(zodSchemaCandidate, {
        name: 'agent_output',
        target: 'jsonSchema7',
      });
      const optimizedJsonSchema = SchemaOptimizer.createOptimizedJsonSchema(
        rawJsonSchema as Record<string, unknown>,
        {
          removeMinItems: this.removeMinItemsFromSchema,
          removeDefaults: this.removeDefaultsFromSchema,
        }
      );

      if (
        this.addSchemaToSystemPrompt &&
        inputMessages.length > 0 &&
        inputMessages[0]?.role === 'system'
      ) {
        const schemaText = `\n<json_schema>\n${JSON.stringify(optimizedJsonSchema)}\n</json_schema>`;
        const firstInput = inputMessages[0] as any;
        const firstContent = firstInput?.content;
        let patchedContent: unknown = firstContent ?? '';
        if (typeof firstContent === 'string') {
          patchedContent = firstContent + schemaText;
        } else if (Array.isArray(firstContent)) {
          patchedContent = [
            ...firstContent,
            { type: 'input_text', text: schemaText },
          ];
        }
        inputMessages[0] = {
          ...inputMessages[0],
          content: patchedContent as any,
        };
        request.input = inputMessages;
      }

      if (!this.dontForceStructuredOutput) {
        request.text = {
          format: {
            type: 'json_schema',
            name: 'agent_output',
            strict: true,
            schema: optimizedJsonSchema,
          },
        };
      }
    } catch {
      // Skip structured output forcing when schema conversion fails.
    }

    return request;
  }

  async ainvoke(
    messages: Message[],
    output_format?: undefined,
    options?: ChatInvokeOptions
  ): Promise<ChatInvokeCompletion<string>>;
  async ainvoke<T>(
    messages: Message[],
    output_format: { parse: (input: string) => T } | undefined,
    options?: ChatInvokeOptions
  ): Promise<ChatInvokeCompletion<T>>;
  async ainvoke<T>(
    messages: Message[],
    output_format?: { parse: (input: string) => T } | undefined,
    options: ChatInvokeOptions = {}
  ): Promise<ChatInvokeCompletion<T | string>> {
    return this.invokeResponses(messages, output_format, options, false);
  }

  private async invokeResponses<T>(
    messages: Message[],
    output_format: { parse: (input: string) => T } | undefined,
    options: ChatInvokeOptions,
    forceRefresh: boolean
  ): Promise<ChatInvokeCompletion<T | string>> {
    const zodSchemaCandidate = this.getZodSchemaCandidate(output_format);
    const request = this.buildRequest(messages, zodSchemaCandidate);

    try {
      const clientConfig = await this.resolveClientConfig(forceRefresh);
      const client = this.createClient(clientConfig);
      const response = await (client as any).responses.create(
        request,
        options.signal ? { signal: options.signal } : undefined
      );

      const content = this.getResponseOutputText(response);
      const usage = this.getResponsesUsage(response);
      const stopReason = response?.status ?? null;

      let completion: T | string = content;
      if (output_format) {
        if (zodSchemaCandidate) {
          const parsedJson = JSON.parse(content);
          const output = output_format as any;
          if (
            output &&
            typeof output === 'object' &&
            output.schema &&
            typeof output.schema.parse === 'function'
          ) {
            completion = output.schema.parse(parsedJson);
          } else {
            completion = output.parse(parsedJson);
          }
        } else {
          completion = output_format.parse(content);
        }
      }

      return new ChatInvokeCompletion(
        completion,
        usage,
        null,
        null,
        stopReason
      );
    } catch (error: any) {
      if (
        !this.apiKey &&
        !forceRefresh &&
        (error?.status === 401 || error?.status === 403)
      ) {
        return this.invokeResponses(messages, output_format, options, true);
      }
      if (error?.status === 429) {
        throw new ModelRateLimitError(
          error?.message ?? 'Rate limit exceeded',
          429,
          this.model
        );
      }
      if (error instanceof CodexAuthError) {
        throw error;
      }
      throw new ModelProviderError(
        error?.message ?? String(error),
        error?.status ?? 500,
        this.model
      );
    }
  }
}
