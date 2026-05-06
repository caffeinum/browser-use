import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
export class EventBusEvent {
    event_type;
    event_id;
    event_parent_id;
    event_timeout;
    event_created_at;
    event_result;
    event_error;
    constructor(event_type, init = {}) {
        this.event_type = event_type;
        this.event_id = init.event_id ?? randomUUID();
        this.event_parent_id = init.event_parent_id ?? null;
        this.event_timeout = init.event_timeout ?? null;
        this.event_created_at = init.event_created_at ?? new Date();
        this.event_result = init.event_result ?? null;
        this.event_error = init.event_error ?? null;
    }
}
export class EventHandlerTimeoutError extends Error {
    event_type;
    handler_id;
    timeout_ms;
    constructor(event_type, handler_id, timeout_ms) {
        super(`Handler ${handler_id} timed out after ${timeout_ms}ms for ${event_type}`);
        this.name = 'EventHandlerTimeoutError';
        this.event_type = event_type;
        this.handler_id = handler_id;
        this.timeout_ms = timeout_ms;
    }
}
export class EventDispatchError extends Error {
    dispatch_result;
    constructor(dispatch_result) {
        super(`Event ${dispatch_result.event_type}#${dispatch_result.event_id} failed with ${dispatch_result.errors.length} error(s)`);
        this.name = 'EventDispatchError';
        this.dispatch_result = dispatch_result;
    }
}
export class EventBus {
    name;
    handlers = new Map();
    event_history = new Map();
    history_limit;
    throw_on_error_by_default;
    dispatch_context = new AsyncLocalStorage();
    constructor(name, options = {}) {
        this.name = name;
        this.history_limit = options.event_history_limit ?? 500;
        this.throw_on_error_by_default = options.throw_on_error_by_default ?? false;
    }
    on(event_type_ref, handler, options = {}) {
        const event_type = this.resolveEventTypeFromRef(event_type_ref);
        const handler_id = options.handler_id ??
            this.resolveHandlerId(event_type, handler);
        const registrations = this.handlers.get(event_type) ?? [];
        if (!options.allow_duplicate) {
            const hasDuplicate = registrations.some((existing) => existing.handler === handler || existing.handler_id === handler_id);
            if (hasDuplicate) {
                throw new Error(`Duplicate handler registration for ${event_type} (${handler_id})`);
            }
        }
        const registration = {
            event_type,
            handler: handler,
            handler_id,
            once: options.once ?? false,
        };
        registrations.push(registration);
        this.handlers.set(event_type, registrations);
        return () => {
            this.off(event_type_ref, handler_id);
        };
    }
    once(event_type_ref, handler, options = {}) {
        return this.on(event_type_ref, handler, { ...options, once: true });
    }
    off(event_type_ref, handler_or_id) {
        const event_type = this.resolveEventTypeFromRef(event_type_ref);
        const registrations = this.handlers.get(event_type);
        if (!registrations || registrations.length === 0) {
            return;
        }
        if (!handler_or_id) {
            this.handlers.delete(event_type);
            return;
        }
        const next = registrations.filter((entry) => {
            if (typeof handler_or_id === 'string') {
                return entry.handler_id !== handler_or_id;
            }
            return entry.handler !== handler_or_id;
        });
        if (next.length) {
            this.handlers.set(event_type, next);
        }
        else {
            this.handlers.delete(event_type);
        }
    }
    async dispatch(event, options = {}) {
        const event_type = this.resolveEventType(event) ?? this.resolveEventTypeFromRef('event');
        const event_id = this.resolveEventId(event);
        const event_parent_id = this.resolveParentEventId(event);
        const timeout_ms = this.resolveTimeoutMs(event, options.timeout_ms);
        const timeout_seconds = timeout_ms == null ? null : timeout_ms / 1000;
        this.assignEventMetadata(event, {
            event_type,
            event_id,
            event_parent_id,
            event_timeout: timeout_seconds,
        });
        const started_at = new Date();
        const registrations = [
            ...(this.handlers.get(event_type) ?? []),
            ...(event_type === '*' ? [] : (this.handlers.get('*') ?? [])),
        ];
        const dispatch_result = {
            event,
            event_id,
            event_type,
            event_parent_id,
            event_timeout: timeout_seconds,
            started_at,
            completed_at: started_at,
            duration_ms: 0,
            status: 'pending',
            handler_results: [],
            errors: [],
        };
        this.event_history.set(event_id, dispatch_result);
        this.pruneHistory();
        const runHandler = async (registration) => {
            const handler_started_at = new Date();
            const safeTimeoutMs = timeout_ms ?? undefined;
            let handler_status = 'fulfilled';
            let handler_result;
            let handler_error;
            try {
                const execution = this.dispatch_context.run({ event_id }, () => Promise.resolve(registration.handler(event)));
                handler_result =
                    safeTimeoutMs == null
                        ? await execution
                        : await this.withTimeout(execution, safeTimeoutMs, event_type, registration.handler_id);
            }
            catch (error) {
                handler_error = error;
                handler_status =
                    error instanceof EventHandlerTimeoutError ? 'timed_out' : 'rejected';
                dispatch_result.errors.push(error);
            }
            const handler_completed_at = new Date();
            const handler_execution_result = {
                handler_id: registration.handler_id,
                event_type: registration.event_type,
                status: handler_status,
                started_at: handler_started_at,
                completed_at: handler_completed_at,
                duration_ms: handler_completed_at.getTime() - handler_started_at.getTime(),
            };
            if (handler_result !== undefined) {
                handler_execution_result.result = handler_result;
            }
            if (handler_error !== undefined) {
                handler_execution_result.error = handler_error;
            }
            dispatch_result.handler_results.push(handler_execution_result);
            if (registration.once) {
                this.off(registration.event_type, registration.handler_id);
            }
        };
        if (options.parallel_handlers) {
            await Promise.all(registrations.map((registration) => runHandler(registration)));
        }
        else {
            for (const registration of registrations) {
                await runHandler(registration);
            }
        }
        const completed_at = new Date();
        dispatch_result.completed_at = completed_at;
        dispatch_result.duration_ms = completed_at.getTime() - started_at.getTime();
        if (dispatch_result.errors.length > 0) {
            const hasTimeout = dispatch_result.handler_results.some((result) => result.status === 'timed_out');
            dispatch_result.status = hasTimeout ? 'timed_out' : 'rejected';
        }
        else {
            dispatch_result.status = 'fulfilled';
        }
        this.assignEventResult(event, dispatch_result.handler_results);
        if (dispatch_result.errors.length > 0) {
            this.assignEventError(event, dispatch_result.errors[0] ?? null);
        }
        const throw_on_error = options.throw_on_error ?? this.throw_on_error_by_default;
        if (throw_on_error && dispatch_result.errors.length > 0) {
            throw new EventDispatchError(dispatch_result);
        }
        return dispatch_result;
    }
    async dispatch_or_throw(event, options = {}) {
        return this.dispatch(event, { ...options, throw_on_error: true });
    }
    getHandlers(event_type_ref) {
        const event_type = this.resolveEventTypeFromRef(event_type_ref);
        return [...(this.handlers.get(event_type) ?? [])];
    }
    async stop() {
        this.handlers.clear();
        this.event_history.clear();
    }
    resolveEventType(event) {
        const event_type = event.event_type ??
            event.constructor?.name ??
            null;
        return event_type && event_type.length > 0 ? event_type : null;
    }
    resolveEventTypeFromRef(event_type_ref) {
        if (typeof event_type_ref === 'string') {
            return event_type_ref;
        }
        return event_type_ref.name;
    }
    resolveHandlerId(event_type, handler) {
        const suffix = typeof handler.name === 'string' && handler.name.length > 0
            ? handler.name
            : `handler_${randomUUID().slice(0, 8)}`;
        return `${event_type}:${suffix}`;
    }
    resolveEventId(event) {
        if (event.event_id && event.event_id.length > 0) {
            return event.event_id;
        }
        return randomUUID();
    }
    resolveParentEventId(event) {
        if (typeof event.event_parent_id === 'string' &&
            event.event_parent_id.length > 0) {
            return event.event_parent_id;
        }
        return this.dispatch_context.getStore()?.event_id ?? null;
    }
    resolveTimeoutMs(event, dispatch_timeout_ms) {
        if (dispatch_timeout_ms !== undefined) {
            return dispatch_timeout_ms;
        }
        if (event.event_timeout == null) {
            return null;
        }
        if (!Number.isFinite(event.event_timeout)) {
            return null;
        }
        if (event.event_timeout < 0) {
            return null;
        }
        return event.event_timeout * 1000;
    }
    assignEventMetadata(event, metadata) {
        this.safeAssign(event, 'event_type', metadata.event_type);
        this.safeAssign(event, 'event_id', metadata.event_id);
        this.safeAssign(event, 'event_parent_id', metadata.event_parent_id);
        if (event.event_timeout === undefined) {
            this.safeAssign(event, 'event_timeout', metadata.event_timeout);
        }
        if (event.event_created_at === undefined) {
            this.safeAssign(event, 'event_created_at', new Date());
        }
    }
    assignEventResult(event, handler_results) {
        const first_defined_result = handler_results.find((result) => result.status === 'fulfilled' &&
            Object.prototype.hasOwnProperty.call(result, 'result'));
        if (!first_defined_result) {
            return;
        }
        this.safeAssign(event, 'event_result', first_defined_result.result);
    }
    assignEventError(event, error) {
        this.safeAssign(event, 'event_error', error);
    }
    safeAssign(event, key, value) {
        try {
            event[key] = value;
        }
        catch {
            // Read-only event objects should still be dispatchable.
        }
    }
    async withTimeout(promise, timeout_ms, event_type, handler_id) {
        if (timeout_ms <= 0) {
            throw new EventHandlerTimeoutError(event_type, handler_id, timeout_ms);
        }
        let timeout_handle = null;
        try {
            return await Promise.race([
                promise,
                new Promise((_, reject) => {
                    timeout_handle = setTimeout(() => {
                        reject(new EventHandlerTimeoutError(event_type, handler_id, timeout_ms));
                    }, timeout_ms);
                }),
            ]);
        }
        finally {
            if (timeout_handle) {
                clearTimeout(timeout_handle);
            }
        }
    }
    pruneHistory() {
        if (this.history_limit <= 0) {
            this.event_history.clear();
            return;
        }
        while (this.event_history.size > this.history_limit) {
            const firstKey = this.event_history.keys().next().value;
            if (!firstKey) {
                break;
            }
            this.event_history.delete(firstKey);
        }
    }
}
