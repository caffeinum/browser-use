import { type ZodTypeAny } from 'zod';
import type { Page } from '../../browser/types.js';
export type ActionHandler = (...args: any[]) => Promise<unknown> | unknown;
type BrowserSession = unknown;
type BaseChatModel = unknown;
type FileSystem = unknown;
export declare class RegisteredAction {
    readonly name: string;
    readonly description: string;
    readonly handler: ActionHandler;
    readonly paramSchema: ZodTypeAny;
    readonly domains: string[] | null;
    readonly pageFilter: ((page: Page) => boolean) | null;
    readonly terminates_sequence: boolean;
    constructor(name: string, description: string, handler: ActionHandler, paramSchema: ZodTypeAny, domains?: string[] | null, pageFilter?: ((page: Page) => boolean) | null, terminates_sequence?: boolean);
    promptDescription(): string;
}
export declare class ActionModel {
    constructor(initialData?: Record<string, any>);
    private data;
    toJSON(): Record<string, any>;
    model_dump(options?: {
        exclude_none?: boolean;
    }): any;
    model_dump_json(options?: {
        exclude_none?: boolean;
    }): string;
    get_index(): number | null;
    set_index(index: number): void;
}
export declare class ActionRegistry {
    private actions;
    register(action: RegisteredAction): void;
    remove(name: string): void;
    get(name: string): RegisteredAction | null;
    getAll(): RegisteredAction[];
    get actionsMap(): Map<string, RegisteredAction>;
    get actionEntries(): RegisteredAction[];
    private _matchDomains;
    private _matchPageFilter;
    getAvailableActions(page?: Page | null, includeActions?: string[] | null): RegisteredAction[];
    get_prompt_description(page?: Page | null): string;
}
export declare class SpecialActionParameters {
    context: any | null;
    browser_session: BrowserSession | null;
    browser: BrowserSession | null;
    browser_context: BrowserSession | null;
    page: Page | null;
    page_extraction_llm: BaseChatModel | null;
    extraction_schema: Record<string, unknown> | null;
    file_system: FileSystem | null;
    available_file_paths: string[] | null;
    signal: AbortSignal | null;
    has_sensitive_data: boolean;
    static get_browser_requiring_params(): Set<string>;
}
export {};
