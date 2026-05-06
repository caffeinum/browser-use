const resolveEventType = (eventTypeRef) => typeof eventTypeRef === 'string' ? eventTypeRef : eventTypeRef.name;
const LIFECYCLE_EVENT_NAMES = new Set([
    'BrowserStartEvent',
    'BrowserStopEvent',
    'BrowserStoppedEvent',
    'BrowserLaunchEvent',
    'BrowserKillEvent',
    'BrowserConnectedEvent',
    'BrowserReconnectingEvent',
    'BrowserReconnectedEvent',
    'BrowserErrorEvent',
]);
const createConnectionError = (message) => {
    const error = new Error(message);
    error.name = 'ConnectionError';
    return error;
};
export class BaseWatchdog {
    static LISTENS_TO = [];
    static EMITS = [];
    browser_session;
    event_bus;
    _attached = false;
    _registeredHandlers = [];
    constructor(init) {
        this.browser_session = init.browser_session;
        this.event_bus = init.event_bus ?? init.browser_session.event_bus;
    }
    get is_attached() {
        return this._attached;
    }
    attach_to_session() {
        if (this._attached) {
            throw new Error(`[${this.constructor.name}] attach_to_session() called twice`);
        }
        const handlerMethods = this._collectHandlerMethods();
        const declaredListenEvents = new Set(this.constructor.LISTENS_TO.map(resolveEventType));
        const registeredEventTypes = new Set();
        for (const methodName of handlerMethods) {
            const event_type = methodName.slice(3);
            if (declaredListenEvents.size > 0 &&
                !declaredListenEvents.has(event_type)) {
                throw new Error(`[${this.constructor.name}] Handler ${methodName} listens to ${event_type} but ${event_type} is not declared in LISTENS_TO`);
            }
            const handler_id = `${this.constructor.name}.${methodName}`;
            const method = this[methodName];
            if (typeof method !== 'function') {
                continue;
            }
            const bound = method.bind(this);
            const wrapped = async (event) => {
                if (!LIFECYCLE_EVENT_NAMES.has(event_type) &&
                    this.browser_session.should_gate_watchdog_events &&
                    !this.browser_session.is_cdp_connected) {
                    if (this.browser_session.is_reconnecting) {
                        await this.browser_session.wait_for_reconnect();
                        if (!this.browser_session.is_cdp_connected) {
                            throw createConnectionError(`[${this.constructor.name}.${methodName}] Reconnection failed; browser connection is still unavailable`);
                        }
                    }
                    else {
                        this.browser_session.logger.debug(`[${this.constructor.name}.${methodName}] Skipped because browser connection is not available`);
                        return null;
                    }
                }
                return await bound(event);
            };
            this.event_bus.on(event_type, wrapped, { handler_id });
            this._registeredHandlers.push({ event_type, handler_id });
            registeredEventTypes.add(event_type);
        }
        if (declaredListenEvents.size > 0) {
            const missing = [...declaredListenEvents].filter((eventType) => !registeredEventTypes.has(eventType));
            if (missing.length > 0) {
                throw new Error(`[${this.constructor.name}] LISTENS_TO declares ${missing.join(', ')} but no matching on_<EventName> handlers were found`);
            }
        }
        this._attached = true;
        this.onAttached();
    }
    detach_from_session() {
        if (!this._attached) {
            return;
        }
        for (const { event_type, handler_id } of this._registeredHandlers) {
            this.event_bus.off(event_type, handler_id);
        }
        this._registeredHandlers = [];
        this._attached = false;
        this.onDetached();
    }
    onAttached() { }
    onDetached() { }
    _collectHandlerMethods() {
        const methodNames = new Set();
        let prototype = Object.getPrototypeOf(this);
        while (prototype && prototype !== BaseWatchdog.prototype) {
            for (const name of Object.getOwnPropertyNames(prototype)) {
                if (!name.startsWith('on_')) {
                    continue;
                }
                if (name.length <= 3) {
                    continue;
                }
                const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
                if (typeof descriptor?.value === 'function') {
                    methodNames.add(name);
                }
            }
            prototype = Object.getPrototypeOf(prototype);
        }
        return [...methodNames];
    }
}
