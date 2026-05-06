import type { EventBus, EventPayload, EventTypeReference } from '../../event-bus.js';
import type { BrowserSession } from '../session.js';
export interface BaseWatchdogInit {
    browser_session: BrowserSession;
    event_bus?: EventBus;
}
export declare abstract class BaseWatchdog {
    static LISTENS_TO: EventTypeReference<EventPayload>[];
    static EMITS: EventTypeReference<EventPayload>[];
    protected readonly browser_session: BrowserSession;
    protected readonly event_bus: EventBus;
    private _attached;
    private _registeredHandlers;
    constructor(init: BaseWatchdogInit);
    get is_attached(): boolean;
    attach_to_session(): void;
    detach_from_session(): void;
    protected onAttached(): void;
    protected onDetached(): void;
    private _collectHandlerMethods;
}
