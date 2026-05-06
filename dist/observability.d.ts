type SpanType = 'DEFAULT' | 'LLM' | 'TOOL';
export interface ObserveOptions {
    name?: string | null;
    ignoreInput?: boolean;
    ignoreOutput?: boolean;
    metadata?: Record<string, unknown> | null;
    spanType?: SpanType;
    [key: string]: unknown;
}
type AnyFunc = (...args: any[]) => any;
type Decorator<T extends AnyFunc> = (fn: T) => T;
export declare const observe: (options?: ObserveOptions) => Decorator<AnyFunc>;
export declare const observeDebug: (options?: ObserveOptions) => Decorator<AnyFunc>;
export declare const observe_debug: (options?: ObserveOptions) => Decorator<AnyFunc>;
export declare const isLmnrAvailable: () => boolean;
export declare const isDebugMode: () => boolean;
export declare const getObservabilityStatus: () => {
    lmnrAvailable: boolean;
    debugMode: boolean;
    observeActive: boolean;
    observeDebugActive: boolean;
};
export {};
