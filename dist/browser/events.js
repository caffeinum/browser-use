import { EventBusEvent } from '../event-bus.js';
const getTimeout = (envVar, defaultValue) => {
    const raw = process.env[envVar];
    if (raw == null || raw.trim() === '') {
        return defaultValue;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return defaultValue;
    }
    return parsed;
};
const resolveEventTimeout = (eventName, defaultSeconds, explicitTimeout) => explicitTimeout !== undefined
    ? explicitTimeout
    : getTimeout(`TIMEOUT_${eventName}`, defaultSeconds);
export class BrowserEvent extends EventBusEvent {
    constructor(eventType, init = {}) {
        super(eventType, init);
    }
}
export class ElementSelectedEvent extends BrowserEvent {
    node;
    constructor(eventType, init) {
        super(eventType, init);
        this.node = init.node;
    }
}
export class NavigateToUrlEvent extends BrowserEvent {
    url;
    wait_until;
    timeout_ms;
    new_tab;
    constructor(init) {
        super('NavigateToUrlEvent', {
            ...init,
            event_timeout: resolveEventTimeout('NavigateToUrlEvent', 15, init.event_timeout),
        });
        this.url = init.url;
        this.wait_until = init.wait_until ?? 'load';
        this.timeout_ms = init.timeout_ms ?? null;
        this.new_tab = init.new_tab ?? false;
    }
}
export class ClickElementEvent extends ElementSelectedEvent {
    button;
    constructor(init) {
        super('ClickElementEvent', {
            ...init,
            event_timeout: resolveEventTimeout('ClickElementEvent', 15, init.event_timeout),
        });
        this.button = init.button ?? 'left';
    }
}
export class ClickCoordinateEvent extends BrowserEvent {
    coordinate_x;
    coordinate_y;
    button;
    force;
    constructor(init) {
        super('ClickCoordinateEvent', {
            ...init,
            event_timeout: resolveEventTimeout('ClickCoordinateEvent', 15, init.event_timeout),
        });
        this.coordinate_x = init.coordinate_x;
        this.coordinate_y = init.coordinate_y;
        this.button = init.button ?? 'left';
        this.force = init.force ?? false;
    }
}
export class TypeTextEvent extends ElementSelectedEvent {
    text;
    clear;
    is_sensitive;
    sensitive_key_name;
    constructor(init) {
        super('TypeTextEvent', {
            ...init,
            event_timeout: resolveEventTimeout('TypeTextEvent', 60, init.event_timeout),
        });
        this.text = init.text;
        this.clear = init.clear ?? true;
        this.is_sensitive = init.is_sensitive ?? false;
        this.sensitive_key_name = init.sensitive_key_name ?? null;
    }
}
export class ScrollEvent extends ElementSelectedEvent {
    direction;
    amount;
    constructor(init) {
        super('ScrollEvent', {
            ...init,
            node: init.node ?? null,
            event_timeout: resolveEventTimeout('ScrollEvent', 8, init.event_timeout),
        });
        this.direction = init.direction;
        this.amount = init.amount;
    }
}
export class SwitchTabEvent extends BrowserEvent {
    target_id;
    constructor(init = {}) {
        super('SwitchTabEvent', {
            ...init,
            event_timeout: resolveEventTimeout('SwitchTabEvent', 10, init.event_timeout),
        });
        this.target_id = init.target_id ?? null;
    }
}
export class CloseTabEvent extends BrowserEvent {
    target_id;
    constructor(init) {
        super('CloseTabEvent', {
            ...init,
            event_timeout: resolveEventTimeout('CloseTabEvent', 10, init.event_timeout),
        });
        this.target_id = init.target_id;
    }
}
export class ScreenshotEvent extends BrowserEvent {
    full_page;
    clip;
    constructor(init = {}) {
        super('ScreenshotEvent', {
            ...init,
            event_timeout: resolveEventTimeout('ScreenshotEvent', 15, init.event_timeout),
        });
        this.full_page = init.full_page ?? false;
        this.clip = init.clip ?? null;
    }
}
export class BrowserStateRequestEvent extends BrowserEvent {
    include_dom;
    include_screenshot;
    include_recent_events;
    constructor(init = {}) {
        super('BrowserStateRequestEvent', {
            ...init,
            event_timeout: resolveEventTimeout('BrowserStateRequestEvent', 30, init.event_timeout),
        });
        this.include_dom = init.include_dom ?? true;
        this.include_screenshot = init.include_screenshot ?? true;
        this.include_recent_events = init.include_recent_events ?? false;
    }
}
export class GoBackEvent extends BrowserEvent {
    constructor(init = {}) {
        super('GoBackEvent', {
            ...init,
            event_timeout: resolveEventTimeout('GoBackEvent', 15, init.event_timeout),
        });
    }
}
export class GoForwardEvent extends BrowserEvent {
    constructor(init = {}) {
        super('GoForwardEvent', {
            ...init,
            event_timeout: resolveEventTimeout('GoForwardEvent', 15, init.event_timeout),
        });
    }
}
export class RefreshEvent extends BrowserEvent {
    constructor(init = {}) {
        super('RefreshEvent', {
            ...init,
            event_timeout: resolveEventTimeout('RefreshEvent', 15, init.event_timeout),
        });
    }
}
export class WaitEvent extends BrowserEvent {
    seconds;
    max_seconds;
    constructor(init = {}) {
        super('WaitEvent', {
            ...init,
            event_timeout: resolveEventTimeout('WaitEvent', 60, init.event_timeout),
        });
        this.seconds = init.seconds ?? 3;
        this.max_seconds = init.max_seconds ?? 10;
    }
}
export class SendKeysEvent extends BrowserEvent {
    keys;
    constructor(init) {
        super('SendKeysEvent', {
            ...init,
            event_timeout: resolveEventTimeout('SendKeysEvent', 60, init.event_timeout),
        });
        this.keys = init.keys;
    }
}
export class UploadFileEvent extends ElementSelectedEvent {
    file_path;
    constructor(init) {
        super('UploadFileEvent', {
            ...init,
            event_timeout: resolveEventTimeout('UploadFileEvent', 30, init.event_timeout),
        });
        this.file_path = init.file_path;
    }
}
export class GetDropdownOptionsEvent extends ElementSelectedEvent {
    constructor(init) {
        super('GetDropdownOptionsEvent', {
            ...init,
            event_timeout: resolveEventTimeout('GetDropdownOptionsEvent', 15, init.event_timeout),
        });
    }
}
export class SelectDropdownOptionEvent extends ElementSelectedEvent {
    text;
    constructor(init) {
        super('SelectDropdownOptionEvent', {
            ...init,
            event_timeout: resolveEventTimeout('SelectDropdownOptionEvent', 8, init.event_timeout),
        });
        this.text = init.text;
    }
}
export class ScrollToTextEvent extends BrowserEvent {
    text;
    direction;
    constructor(init) {
        super('ScrollToTextEvent', {
            ...init,
            event_timeout: resolveEventTimeout('ScrollToTextEvent', 15, init.event_timeout),
        });
        this.text = init.text;
        this.direction = init.direction ?? 'down';
    }
}
export class BrowserStartEvent extends BrowserEvent {
    cdp_url;
    launch_options;
    constructor(init = {}) {
        super('BrowserStartEvent', {
            ...init,
            event_timeout: resolveEventTimeout('BrowserStartEvent', 30, init.event_timeout),
        });
        this.cdp_url = init.cdp_url ?? null;
        this.launch_options = init.launch_options ?? {};
    }
}
export class BrowserStopEvent extends BrowserEvent {
    force;
    constructor(init = {}) {
        super('BrowserStopEvent', {
            ...init,
            event_timeout: resolveEventTimeout('BrowserStopEvent', 45, init.event_timeout),
        });
        this.force = init.force ?? false;
    }
}
export class BrowserLaunchEvent extends BrowserEvent {
    constructor(init = {}) {
        super('BrowserLaunchEvent', {
            ...init,
            event_timeout: resolveEventTimeout('BrowserLaunchEvent', 30, init.event_timeout),
        });
    }
}
export class BrowserKillEvent extends BrowserEvent {
    constructor(init = {}) {
        super('BrowserKillEvent', {
            ...init,
            event_timeout: resolveEventTimeout('BrowserKillEvent', 30, init.event_timeout),
        });
    }
}
export class BrowserConnectedEvent extends BrowserEvent {
    cdp_url;
    constructor(init) {
        super('BrowserConnectedEvent', {
            ...init,
            event_timeout: resolveEventTimeout('BrowserConnectedEvent', 30, init.event_timeout),
        });
        this.cdp_url = init.cdp_url;
    }
}
export class BrowserReconnectingEvent extends BrowserEvent {
    cdp_url;
    attempt;
    max_attempts;
    constructor(init) {
        super('BrowserReconnectingEvent', {
            ...init,
            event_timeout: resolveEventTimeout('BrowserReconnectingEvent', 30, init.event_timeout),
        });
        this.cdp_url = init.cdp_url;
        this.attempt = init.attempt;
        this.max_attempts = init.max_attempts;
    }
}
export class BrowserReconnectedEvent extends BrowserEvent {
    cdp_url;
    attempt;
    downtime_seconds;
    constructor(init) {
        super('BrowserReconnectedEvent', {
            ...init,
            event_timeout: resolveEventTimeout('BrowserReconnectedEvent', 30, init.event_timeout),
        });
        this.cdp_url = init.cdp_url;
        this.attempt = init.attempt;
        this.downtime_seconds = init.downtime_seconds;
    }
}
export class BrowserStoppedEvent extends BrowserEvent {
    reason;
    constructor(init = {}) {
        super('BrowserStoppedEvent', {
            ...init,
            event_timeout: resolveEventTimeout('BrowserStoppedEvent', 30, init.event_timeout),
        });
        this.reason = init.reason ?? null;
    }
}
export class CaptchaSolverStartedEvent extends BrowserEvent {
    target_id;
    vendor;
    url;
    started_at;
    constructor(init) {
        super('CaptchaSolverStartedEvent', {
            ...init,
            event_timeout: resolveEventTimeout('CaptchaSolverStartedEvent', 5, init.event_timeout),
        });
        this.target_id = init.target_id;
        this.vendor = init.vendor;
        this.url = init.url;
        this.started_at = init.started_at;
    }
}
export class CaptchaSolverFinishedEvent extends BrowserEvent {
    target_id;
    vendor;
    url;
    duration_ms;
    finished_at;
    success;
    constructor(init) {
        super('CaptchaSolverFinishedEvent', {
            ...init,
            event_timeout: resolveEventTimeout('CaptchaSolverFinishedEvent', 5, init.event_timeout),
        });
        this.target_id = init.target_id;
        this.vendor = init.vendor;
        this.url = init.url;
        this.duration_ms = init.duration_ms;
        this.finished_at = init.finished_at;
        this.success = init.success;
    }
}
export class TabCreatedEvent extends BrowserEvent {
    target_id;
    url;
    constructor(init) {
        super('TabCreatedEvent', {
            ...init,
            event_timeout: resolveEventTimeout('TabCreatedEvent', 30, init.event_timeout),
        });
        this.target_id = init.target_id;
        this.url = init.url;
    }
}
export class TabClosedEvent extends BrowserEvent {
    target_id;
    constructor(init) {
        super('TabClosedEvent', {
            ...init,
            event_timeout: resolveEventTimeout('TabClosedEvent', 10, init.event_timeout),
        });
        this.target_id = init.target_id;
    }
}
export class AgentFocusChangedEvent extends BrowserEvent {
    target_id;
    url;
    constructor(init) {
        super('AgentFocusChangedEvent', {
            ...init,
            event_timeout: resolveEventTimeout('AgentFocusChangedEvent', 10, init.event_timeout),
        });
        this.target_id = init.target_id;
        this.url = init.url;
    }
}
export class TargetCrashedEvent extends BrowserEvent {
    target_id;
    error;
    constructor(init) {
        super('TargetCrashedEvent', {
            ...init,
            event_timeout: resolveEventTimeout('TargetCrashedEvent', 10, init.event_timeout),
        });
        this.target_id = init.target_id;
        this.error = init.error;
    }
}
export class NavigationStartedEvent extends BrowserEvent {
    target_id;
    url;
    constructor(init) {
        super('NavigationStartedEvent', {
            ...init,
            event_timeout: resolveEventTimeout('NavigationStartedEvent', 30, init.event_timeout),
        });
        this.target_id = init.target_id;
        this.url = init.url;
    }
}
export class NavigationCompleteEvent extends BrowserEvent {
    target_id;
    url;
    status;
    error_message;
    loading_status;
    constructor(init) {
        super('NavigationCompleteEvent', {
            ...init,
            event_timeout: resolveEventTimeout('NavigationCompleteEvent', 30, init.event_timeout),
        });
        this.target_id = init.target_id;
        this.url = init.url;
        this.status = init.status ?? null;
        this.error_message = init.error_message ?? null;
        this.loading_status = init.loading_status ?? null;
    }
}
export class BrowserErrorEvent extends BrowserEvent {
    error_type;
    message;
    details;
    constructor(init) {
        super('BrowserErrorEvent', {
            ...init,
            event_timeout: resolveEventTimeout('BrowserErrorEvent', 30, init.event_timeout),
        });
        this.error_type = init.error_type;
        this.message = init.message;
        this.details = init.details ?? {};
    }
}
export class SaveStorageStateEvent extends BrowserEvent {
    path;
    constructor(init = {}) {
        super('SaveStorageStateEvent', {
            ...init,
            event_timeout: resolveEventTimeout('SaveStorageStateEvent', 45, init.event_timeout),
        });
        this.path = init.path ?? null;
    }
}
export class StorageStateSavedEvent extends BrowserEvent {
    path;
    cookies_count;
    origins_count;
    constructor(init) {
        super('StorageStateSavedEvent', {
            ...init,
            event_timeout: resolveEventTimeout('StorageStateSavedEvent', 30, init.event_timeout),
        });
        this.path = init.path;
        this.cookies_count = init.cookies_count;
        this.origins_count = init.origins_count;
    }
}
export class LoadStorageStateEvent extends BrowserEvent {
    path;
    constructor(init = {}) {
        super('LoadStorageStateEvent', {
            ...init,
            event_timeout: resolveEventTimeout('LoadStorageStateEvent', 45, init.event_timeout),
        });
        this.path = init.path ?? null;
    }
}
export class StorageStateLoadedEvent extends BrowserEvent {
    path;
    cookies_count;
    origins_count;
    constructor(init) {
        super('StorageStateLoadedEvent', {
            ...init,
            event_timeout: resolveEventTimeout('StorageStateLoadedEvent', 30, init.event_timeout),
        });
        this.path = init.path;
        this.cookies_count = init.cookies_count;
        this.origins_count = init.origins_count;
    }
}
export class DownloadStartedEvent extends BrowserEvent {
    guid;
    url;
    suggested_filename;
    auto_download;
    constructor(init) {
        super('DownloadStartedEvent', {
            ...init,
            event_timeout: resolveEventTimeout('DownloadStartedEvent', 5, init.event_timeout),
        });
        this.guid = init.guid;
        this.url = init.url;
        this.suggested_filename = init.suggested_filename;
        this.auto_download = init.auto_download ?? false;
    }
}
export class DownloadProgressEvent extends BrowserEvent {
    guid;
    received_bytes;
    total_bytes;
    state;
    constructor(init) {
        super('DownloadProgressEvent', {
            ...init,
            event_timeout: resolveEventTimeout('DownloadProgressEvent', 5, init.event_timeout),
        });
        this.guid = init.guid;
        this.received_bytes = init.received_bytes;
        this.total_bytes = init.total_bytes;
        this.state = init.state;
    }
}
export class FileDownloadedEvent extends BrowserEvent {
    guid;
    url;
    path;
    file_name;
    file_size;
    file_type;
    mime_type;
    from_cache;
    auto_download;
    constructor(init) {
        super('FileDownloadedEvent', {
            ...init,
            event_timeout: resolveEventTimeout('FileDownloadedEvent', 30, init.event_timeout),
        });
        this.guid = init.guid ?? null;
        this.url = init.url;
        this.path = init.path;
        this.file_name = init.file_name;
        this.file_size = init.file_size;
        this.file_type = init.file_type ?? null;
        this.mime_type = init.mime_type ?? null;
        this.from_cache = init.from_cache ?? false;
        this.auto_download = init.auto_download ?? false;
    }
}
export class AboutBlankDVDScreensaverShownEvent extends BrowserEvent {
    target_id;
    error;
    constructor(init) {
        super('AboutBlankDVDScreensaverShownEvent', init);
        this.target_id = init.target_id;
        this.error = init.error ?? null;
    }
}
export class DialogOpenedEvent extends BrowserEvent {
    dialog_type;
    message;
    url;
    frame_id;
    constructor(init) {
        super('DialogOpenedEvent', init);
        this.dialog_type = init.dialog_type;
        this.message = init.message;
        this.url = init.url;
        this.frame_id = init.frame_id ?? null;
    }
}
export const BROWSER_EVENT_CLASSES = [
    ElementSelectedEvent,
    NavigateToUrlEvent,
    ClickElementEvent,
    ClickCoordinateEvent,
    TypeTextEvent,
    ScrollEvent,
    SwitchTabEvent,
    CloseTabEvent,
    ScreenshotEvent,
    BrowserStateRequestEvent,
    GoBackEvent,
    GoForwardEvent,
    RefreshEvent,
    WaitEvent,
    SendKeysEvent,
    UploadFileEvent,
    GetDropdownOptionsEvent,
    SelectDropdownOptionEvent,
    ScrollToTextEvent,
    BrowserStartEvent,
    BrowserStopEvent,
    BrowserLaunchEvent,
    BrowserKillEvent,
    BrowserConnectedEvent,
    BrowserReconnectingEvent,
    BrowserReconnectedEvent,
    BrowserStoppedEvent,
    TabCreatedEvent,
    TabClosedEvent,
    AgentFocusChangedEvent,
    TargetCrashedEvent,
    NavigationStartedEvent,
    NavigationCompleteEvent,
    BrowserErrorEvent,
    SaveStorageStateEvent,
    StorageStateSavedEvent,
    LoadStorageStateEvent,
    StorageStateLoadedEvent,
    DownloadStartedEvent,
    DownloadProgressEvent,
    FileDownloadedEvent,
    AboutBlankDVDScreensaverShownEvent,
    DialogOpenedEvent,
];
export const BROWSER_EVENT_NAMES = BROWSER_EVENT_CLASSES.map((eventClass) => eventClass.name);
const checkEventNamesDontOverlap = () => {
    for (const nameA of BROWSER_EVENT_NAMES) {
        if (!nameA.endsWith('Event')) {
            throw new Error(`Event ${nameA} does not end with Event`);
        }
        for (const nameB of BROWSER_EVENT_NAMES) {
            if (nameA === nameB) {
                continue;
            }
            if (nameB.includes(nameA)) {
                throw new Error(`Event ${nameA} is a substring of ${nameB}; event names must be non-overlapping`);
            }
        }
    }
};
checkEventNamesDontOverlap();
