import type { ChatInvokeCompletion } from './views.js';
import type { Message } from './messages.js';
export interface ChatInvokeOptions {
    signal?: AbortSignal;
    request_type?: string;
    [key: string]: unknown;
}
export interface BaseChatModel {
    model: string;
    _verified_api_keys?: boolean;
    get provider(): string;
    get name(): string;
    get model_name(): string;
    ainvoke(messages: Message[], output_format?: undefined, options?: ChatInvokeOptions): Promise<ChatInvokeCompletion<string>>;
    ainvoke<T>(messages: Message[], output_format: {
        parse: (input: string) => T;
    } | undefined, options?: ChatInvokeOptions): Promise<ChatInvokeCompletion<T>>;
}
