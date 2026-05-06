import { type ZodTypeAny } from 'zod';
import type { Page } from '../../browser/types.js';
import { FileSystem } from '../../filesystem/file-system.js';
import { ActionModel, RegisteredAction } from './views.js';
import type { BrowserSession } from '../../browser/session.js';
type BaseChatModel = unknown;
export interface SensitiveDataMap {
    [key: string]: string | Record<string, string>;
}
export interface ExecuteActionContext<Context> {
    context?: Context;
    browser_session?: BrowserSession | null;
    browser?: BrowserSession | null;
    browser_context?: BrowserSession | null;
    page_url?: string | null;
    cdp_client?: unknown;
    page_extraction_llm?: BaseChatModel | null;
    extraction_schema?: Record<string, unknown> | null;
    file_system?: FileSystem | null;
    available_file_paths?: string[] | null;
    sensitive_data?: SensitiveDataMap | null;
    signal?: AbortSignal | null;
}
export type RegistryActionHandler<Params = any, Context = unknown> = (params: Params, ctx: ExecuteActionContext<Context> & {
    page?: Page | null;
    has_sensitive_data?: boolean;
}) => Promise<unknown> | unknown;
export interface ActionOptions {
    param_model?: ZodTypeAny;
    action_name?: string;
    domains?: string[] | null;
    allowed_domains?: string[] | null;
    page_filter?: ((page: Page) => boolean) | null;
    terminates_sequence?: boolean;
}
export declare class Registry<Context = unknown> {
    private registry;
    private excludeActions;
    constructor(exclude_actions?: string[] | null);
    action(description: string, options?: ActionOptions): <Params = any>(handler: RegistryActionHandler<Params, Context>) => any;
    get_action(action_name: string): RegisteredAction | null;
    exclude_action(action_name: string): void;
    remove_action(action_name: string): void;
    get_all_actions(): Map<string, RegisteredAction>;
    execute_action: (...args: any[]) => any;
    private replace_sensitive_data;
    private log_sensitive_data_usage;
    create_action_model(options?: {
        include_actions?: string[] | null;
        page?: Page | null;
    }): typeof ActionModel;
    get_prompt_description(page?: Page | null): string;
}
export {};
