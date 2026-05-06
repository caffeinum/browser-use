export declare class SandboxError extends Error {
    constructor(message: string);
}
export declare enum SSEEventType {
    BROWSER_CREATED = "browser_created",
    INSTANCE_CREATED = "instance_created",
    INSTANCE_READY = "instance_ready",
    LOG = "log",
    RESULT = "result",
    ERROR = "error",
    STREAM_COMPLETE = "stream_complete"
}
export declare class BrowserCreatedData {
    session_id: string;
    live_url: string;
    status: string;
    constructor(init: {
        session_id: string;
        live_url: string;
        status: string;
    });
}
export declare class LogData {
    message: string;
    level: string;
    constructor(init: {
        message: string;
        level?: string;
    });
}
export interface ExecutionResponse {
    success: boolean;
    result?: unknown;
    error?: string | null;
    traceback?: string | null;
}
export declare class ResultData {
    execution_response: ExecutionResponse;
    constructor(init: {
        execution_response: ExecutionResponse;
    });
}
export declare class ErrorData {
    error: string;
    traceback: string | null;
    status_code: number;
    constructor(init: {
        error: string;
        traceback?: string | null;
        status_code?: number;
    });
}
export declare class SSEEvent {
    type: SSEEventType;
    data: BrowserCreatedData | LogData | ResultData | ErrorData | Record<string, unknown>;
    timestamp: string | null;
    constructor(init: {
        type: SSEEventType;
        data: BrowserCreatedData | LogData | ResultData | ErrorData | Record<string, unknown>;
        timestamp?: string | null;
    });
    static from_json(event_json: string): SSEEvent;
    is_browser_created(): boolean;
    is_log(): boolean;
    is_result(): boolean;
    is_error(): boolean;
}
