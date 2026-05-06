import { z } from 'zod';
import { ActionResult } from '../agent/views.js';
import { FileSystem } from '../filesystem/file-system.js';
import { Registry } from './registry/service.js';
type BrowserSession = any;
type BaseChatModel = {
    ainvoke: (messages: any[], output_format?: undefined, options?: {
        signal?: AbortSignal;
    }) => Promise<{
        completion: string;
    }>;
};
export interface ControllerOptions<Context = unknown> {
    exclude_actions?: string[];
    output_model?: z.ZodTypeAny | null;
    display_files_in_done_text?: boolean;
    context?: Context;
}
export interface ActParams<Context = unknown> {
    browser_session: BrowserSession;
    page_extraction_llm?: BaseChatModel | null;
    sensitive_data?: Record<string, string | Record<string, string>> | null;
    available_file_paths?: string[] | null;
    file_system?: FileSystem | null;
    context?: Context | null;
    signal?: AbortSignal | null;
}
export declare class Controller<Context = unknown> {
    registry: Registry<Context>;
    private displayFilesInDoneText;
    private outputModel;
    private coordinateClickingEnabled;
    private clickActionHandler;
    private logger;
    constructor(options?: ControllerOptions<Context>);
    private registerDefaultActions;
    private registerNavigationActions;
    private registerElementActions;
    private registerClickActions;
    private registerTabActions;
    private registerContentActions;
    private registerExplorationActions;
    private registerScrollActions;
    private registerFileSystemActions;
    private registerUtilityActions;
    private registerKeyboardActions;
    private registerDropdownActions;
    private registerSheetsActions;
    private gotoSheetsRange;
    private registerDoneAction;
    use_structured_output_action(outputModel: z.ZodTypeAny): void;
    get_output_model(): z.ZodTypeAny | null;
    exclude_action(actionName: string): void;
    set_coordinate_clicking(enabled: boolean): void;
    action(description: string, options?: {}): <Params = any>(handler: import("./index.js").RegistryActionHandler<Params, Context>) => any;
    act(action: Record<string, unknown>, { browser_session, page_extraction_llm, sensitive_data, available_file_paths, file_system, context, signal, }: ActParams<Context>): Promise<ActionResult>;
}
export {};
