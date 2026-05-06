export class SandboxError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SandboxError';
    }
}
export var SSEEventType;
(function (SSEEventType) {
    SSEEventType["BROWSER_CREATED"] = "browser_created";
    SSEEventType["INSTANCE_CREATED"] = "instance_created";
    SSEEventType["INSTANCE_READY"] = "instance_ready";
    SSEEventType["LOG"] = "log";
    SSEEventType["RESULT"] = "result";
    SSEEventType["ERROR"] = "error";
    SSEEventType["STREAM_COMPLETE"] = "stream_complete";
})(SSEEventType || (SSEEventType = {}));
export class BrowserCreatedData {
    session_id;
    live_url;
    status;
    constructor(init) {
        this.session_id = init.session_id;
        this.live_url = init.live_url;
        this.status = init.status;
    }
}
export class LogData {
    message;
    level;
    constructor(init) {
        this.message = init.message;
        this.level = init.level ?? 'info';
    }
}
export class ResultData {
    execution_response;
    constructor(init) {
        this.execution_response = init.execution_response;
    }
}
export class ErrorData {
    error;
    traceback;
    status_code;
    constructor(init) {
        this.error = init.error;
        this.traceback = init.traceback ?? null;
        this.status_code = init.status_code ?? 500;
    }
}
export class SSEEvent {
    type;
    data;
    timestamp;
    constructor(init) {
        this.type = init.type;
        this.data = init.data;
        this.timestamp = init.timestamp ?? null;
    }
    static from_json(event_json) {
        const raw = JSON.parse(event_json);
        const type = raw.type;
        const payload = raw.data ?? {};
        let data;
        if (type === SSEEventType.BROWSER_CREATED) {
            data = new BrowserCreatedData({
                session_id: String(payload.session_id ?? ''),
                live_url: String(payload.live_url ?? ''),
                status: String(payload.status ?? ''),
            });
        }
        else if (type === SSEEventType.LOG) {
            data = new LogData({
                message: String(payload.message ?? ''),
                level: payload.level == null ? undefined : String(payload.level),
            });
        }
        else if (type === SSEEventType.RESULT) {
            data = new ResultData({
                execution_response: {
                    success: Boolean(payload.execution_response?.success),
                    result: payload.execution_response?.result,
                    error: payload.execution_response?.error == null
                        ? null
                        : String(payload.execution_response?.error),
                    traceback: payload.execution_response?.traceback == null
                        ? null
                        : String(payload.execution_response?.traceback),
                },
            });
        }
        else if (type === SSEEventType.ERROR) {
            data = new ErrorData({
                error: String(payload.error ?? ''),
                traceback: payload.traceback == null ? null : String(payload.traceback),
                status_code: payload.status_code == null ? undefined : Number(payload.status_code),
            });
        }
        else {
            data = payload;
        }
        return new SSEEvent({
            type,
            data,
            timestamp: raw.timestamp ?? null,
        });
    }
    is_browser_created() {
        return (this.type === SSEEventType.BROWSER_CREATED &&
            this.data instanceof BrowserCreatedData);
    }
    is_log() {
        return this.type === SSEEventType.LOG && this.data instanceof LogData;
    }
    is_result() {
        return this.type === SSEEventType.RESULT && this.data instanceof ResultData;
    }
    is_error() {
        return this.type === SSEEventType.ERROR && this.data instanceof ErrorData;
    }
}
