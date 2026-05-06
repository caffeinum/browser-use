export interface EventPayload {
    event_type?: string;
    event_id?: string;
    event_parent_id?: string | null;
    event_timeout?: number | null;
    event_created_at?: Date;
    event_result?: unknown;
    event_error?: unknown;
}
export interface EventBusEventInit<TResult = unknown> {
    event_id?: string;
    event_parent_id?: string | null;
    event_timeout?: number | null;
    event_created_at?: Date;
    event_result?: TResult | null;
    event_error?: unknown;
}
export declare class EventBusEvent<TResult = unknown> implements EventPayload {
    event_type: string;
    event_id: string;
    event_parent_id: string | null;
    event_timeout: number | null;
    event_created_at: Date;
    event_result: TResult | null;
    event_error: unknown;
    constructor(event_type: string, init?: EventBusEventInit<TResult>);
}
export type EventTypeReference<TEvent extends EventPayload = EventPayload> = string | (new (...args: any[]) => TEvent);
export type EventHandler<TEvent extends EventPayload = EventPayload, TResult = unknown> = (event: TEvent) => TResult | Promise<TResult>;
export interface EventSubscriptionOptions {
    once?: boolean;
    handler_id?: string;
    allow_duplicate?: boolean;
}
export interface EventDispatchOptions {
    throw_on_error?: boolean;
    timeout_ms?: number | null;
    parallel_handlers?: boolean;
}
export interface EventBusOptions {
    event_history_limit?: number;
    throw_on_error_by_default?: boolean;
}
export interface EventHandlerExecutionResult {
    handler_id: string;
    event_type: string;
    status: 'fulfilled' | 'rejected' | 'timed_out';
    started_at: Date;
    completed_at: Date;
    duration_ms: number;
    result?: unknown;
    error?: unknown;
}
export interface EventDispatchResult<TEvent extends EventPayload = EventPayload> {
    event: TEvent;
    event_id: string;
    event_type: string;
    event_parent_id: string | null;
    event_timeout: number | null;
    started_at: Date;
    completed_at: Date;
    duration_ms: number;
    status: 'pending' | 'fulfilled' | 'rejected' | 'timed_out';
    handler_results: EventHandlerExecutionResult[];
    errors: unknown[];
}
export declare class EventHandlerTimeoutError extends Error {
    event_type: string;
    handler_id: string;
    timeout_ms: number;
    constructor(event_type: string, handler_id: string, timeout_ms: number);
}
export declare class EventDispatchError extends Error {
    dispatch_result: EventDispatchResult<EventPayload>;
    constructor(dispatch_result: EventDispatchResult<EventPayload>);
}
interface EventHandlerRegistration {
    event_type: string;
    handler: EventHandler<any, any>;
    handler_id: string;
    once: boolean;
}
export declare class EventBus {
    readonly name: string;
    readonly handlers: Map<string, EventHandlerRegistration[]>;
    readonly event_history: Map<string, EventDispatchResult<EventPayload>>;
    private readonly history_limit;
    private readonly throw_on_error_by_default;
    private readonly dispatch_context;
    constructor(name: string, options?: EventBusOptions);
    on<TEvent extends EventPayload = EventPayload, TResult = unknown>(event_type_ref: EventTypeReference<TEvent>, handler: EventHandler<TEvent, TResult>, options?: EventSubscriptionOptions): () => void;
    once<TEvent extends EventPayload = EventPayload, TResult = unknown>(event_type_ref: EventTypeReference<TEvent>, handler: EventHandler<TEvent, TResult>, options?: Omit<EventSubscriptionOptions, 'once'>): () => void;
    off<TEvent extends EventPayload = EventPayload>(event_type_ref: EventTypeReference<TEvent>, handler_or_id?: EventHandler<TEvent, unknown> | string): void;
    dispatch<TEvent extends EventPayload>(event: TEvent, options?: EventDispatchOptions): Promise<EventDispatchResult<TEvent>>;
    dispatch_or_throw<TEvent extends EventPayload>(event: TEvent, options?: Omit<EventDispatchOptions, 'throw_on_error'>): Promise<EventDispatchResult<TEvent>>;
    getHandlers<TEvent extends EventPayload = EventPayload>(event_type_ref: EventTypeReference<TEvent>): EventHandlerRegistration[];
    stop(): Promise<void>;
    private resolveEventType;
    private resolveEventTypeFromRef;
    private resolveHandlerId;
    private resolveEventId;
    private resolveParentEventId;
    private resolveTimeoutMs;
    private assignEventMetadata;
    private assignEventResult;
    private assignEventError;
    private safeAssign;
    private withTimeout;
    private pruneHistory;
}
export {};
