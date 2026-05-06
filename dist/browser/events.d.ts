import type { DOMElementNode } from '../dom/views.js';
import { EventBusEvent, type EventBusEventInit } from '../event-bus.js';
import { BrowserStateSummary } from './views.js';
export type TargetID = string;
export type WaitUntilState = 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
export type MouseButton = 'left' | 'right' | 'middle';
export declare abstract class BrowserEvent<TResult = unknown> extends EventBusEvent<TResult> {
    protected constructor(eventType: string, init?: EventBusEventInit<TResult>);
}
export declare class ElementSelectedEvent<TResult = unknown, TNode = DOMElementNode> extends BrowserEvent<TResult> {
    node: TNode;
    constructor(eventType: string, init: EventBusEventInit<TResult> & {
        node: TNode;
    });
}
export declare class NavigateToUrlEvent extends BrowserEvent<void> {
    url: string;
    wait_until: WaitUntilState;
    timeout_ms: number | null;
    new_tab: boolean;
    constructor(init: EventBusEventInit<void> & {
        url: string;
        wait_until?: WaitUntilState;
        timeout_ms?: number | null;
        new_tab?: boolean;
    });
}
export declare class ClickElementEvent extends ElementSelectedEvent<Record<string, unknown> | null> {
    button: MouseButton;
    constructor(init: EventBusEventInit<Record<string, unknown> | null> & {
        node: DOMElementNode;
        button?: MouseButton;
    });
}
export declare class ClickCoordinateEvent extends BrowserEvent<Record<string, unknown>> {
    coordinate_x: number;
    coordinate_y: number;
    button: MouseButton;
    force: boolean;
    constructor(init: EventBusEventInit<Record<string, unknown>> & {
        coordinate_x: number;
        coordinate_y: number;
        button?: MouseButton;
        force?: boolean;
    });
}
export declare class TypeTextEvent extends ElementSelectedEvent<Record<string, unknown> | null> {
    text: string;
    clear: boolean;
    is_sensitive: boolean;
    sensitive_key_name: string | null;
    constructor(init: EventBusEventInit<Record<string, unknown> | null> & {
        node: DOMElementNode;
        text: string;
        clear?: boolean;
        is_sensitive?: boolean;
        sensitive_key_name?: string | null;
    });
}
export declare class ScrollEvent extends ElementSelectedEvent<void, DOMElementNode | null> {
    direction: 'up' | 'down' | 'left' | 'right';
    amount: number;
    constructor(init: EventBusEventInit<void> & {
        direction: 'up' | 'down' | 'left' | 'right';
        amount: number;
        node?: DOMElementNode | null;
    });
}
export declare class SwitchTabEvent extends BrowserEvent<TargetID> {
    target_id: TargetID | null;
    constructor(init?: EventBusEventInit<TargetID> & {
        target_id?: TargetID | null;
    });
}
export declare class CloseTabEvent extends BrowserEvent<void> {
    target_id: TargetID;
    constructor(init: EventBusEventInit<void> & {
        target_id: TargetID;
    });
}
export declare class ScreenshotEvent extends BrowserEvent<string> {
    full_page: boolean;
    clip: {
        x: number;
        y: number;
        width: number;
        height: number;
    } | null;
    constructor(init?: EventBusEventInit<string> & {
        full_page?: boolean;
        clip?: {
            x: number;
            y: number;
            width: number;
            height: number;
        } | null;
    });
}
export declare class BrowserStateRequestEvent extends BrowserEvent<BrowserStateSummary> {
    include_dom: boolean;
    include_screenshot: boolean;
    include_recent_events: boolean;
    constructor(init?: EventBusEventInit<BrowserStateSummary> & {
        include_dom?: boolean;
        include_screenshot?: boolean;
        include_recent_events?: boolean;
    });
}
export declare class GoBackEvent extends BrowserEvent<void> {
    constructor(init?: EventBusEventInit<void>);
}
export declare class GoForwardEvent extends BrowserEvent<void> {
    constructor(init?: EventBusEventInit<void>);
}
export declare class RefreshEvent extends BrowserEvent<void> {
    constructor(init?: EventBusEventInit<void>);
}
export declare class WaitEvent extends BrowserEvent<void> {
    seconds: number;
    max_seconds: number;
    constructor(init?: EventBusEventInit<void> & {
        seconds?: number;
        max_seconds?: number;
    });
}
export declare class SendKeysEvent extends BrowserEvent<void> {
    keys: string;
    constructor(init: EventBusEventInit<void> & {
        keys: string;
    });
}
export declare class UploadFileEvent extends ElementSelectedEvent<void> {
    file_path: string;
    constructor(init: EventBusEventInit<void> & {
        node: DOMElementNode;
        file_path: string;
    });
}
export declare class GetDropdownOptionsEvent extends ElementSelectedEvent<Record<string, string>> {
    constructor(init: EventBusEventInit<Record<string, string>> & {
        node: DOMElementNode;
    });
}
export declare class SelectDropdownOptionEvent extends ElementSelectedEvent<Record<string, string>> {
    text: string;
    constructor(init: EventBusEventInit<Record<string, string>> & {
        node: DOMElementNode;
        text: string;
    });
}
export declare class ScrollToTextEvent extends BrowserEvent<void> {
    text: string;
    direction: 'up' | 'down';
    constructor(init: EventBusEventInit<void> & {
        text: string;
        direction?: 'up' | 'down';
    });
}
export declare class BrowserStartEvent extends BrowserEvent<void> {
    cdp_url: string | null;
    launch_options: Record<string, unknown>;
    constructor(init?: EventBusEventInit<void> & {
        cdp_url?: string | null;
        launch_options?: Record<string, unknown>;
    });
}
export declare class BrowserStopEvent extends BrowserEvent<void> {
    force: boolean;
    constructor(init?: EventBusEventInit<void> & {
        force?: boolean;
    });
}
export interface BrowserLaunchResult {
    cdp_url: string;
}
export declare class BrowserLaunchEvent extends BrowserEvent<BrowserLaunchResult> {
    constructor(init?: EventBusEventInit<BrowserLaunchResult>);
}
export declare class BrowserKillEvent extends BrowserEvent<void> {
    constructor(init?: EventBusEventInit<void>);
}
export declare class BrowserConnectedEvent extends BrowserEvent<void> {
    cdp_url: string;
    constructor(init: EventBusEventInit<void> & {
        cdp_url: string;
    });
}
export declare class BrowserReconnectingEvent extends BrowserEvent<void> {
    cdp_url: string;
    attempt: number;
    max_attempts: number;
    constructor(init: EventBusEventInit<void> & {
        cdp_url: string;
        attempt: number;
        max_attempts: number;
    });
}
export declare class BrowserReconnectedEvent extends BrowserEvent<void> {
    cdp_url: string;
    attempt: number;
    downtime_seconds: number;
    constructor(init: EventBusEventInit<void> & {
        cdp_url: string;
        attempt: number;
        downtime_seconds: number;
    });
}
export declare class BrowserStoppedEvent extends BrowserEvent<void> {
    reason: string | null;
    constructor(init?: EventBusEventInit<void> & {
        reason?: string | null;
    });
}
export declare class CaptchaSolverStartedEvent extends BrowserEvent<void> {
    target_id: TargetID;
    vendor: string;
    url: string;
    started_at: number;
    constructor(init: EventBusEventInit<void> & {
        target_id: TargetID;
        vendor: string;
        url: string;
        started_at: number;
    });
}
export declare class CaptchaSolverFinishedEvent extends BrowserEvent<void> {
    target_id: TargetID;
    vendor: string;
    url: string;
    duration_ms: number;
    finished_at: number;
    success: boolean;
    constructor(init: EventBusEventInit<void> & {
        target_id: TargetID;
        vendor: string;
        url: string;
        duration_ms: number;
        finished_at: number;
        success: boolean;
    });
}
export declare class TabCreatedEvent extends BrowserEvent<void> {
    target_id: TargetID;
    url: string;
    constructor(init: EventBusEventInit<void> & {
        target_id: TargetID;
        url: string;
    });
}
export declare class TabClosedEvent extends BrowserEvent<void> {
    target_id: TargetID;
    constructor(init: EventBusEventInit<void> & {
        target_id: TargetID;
    });
}
export declare class AgentFocusChangedEvent extends BrowserEvent<void> {
    target_id: TargetID;
    url: string;
    constructor(init: EventBusEventInit<void> & {
        target_id: TargetID;
        url: string;
    });
}
export declare class TargetCrashedEvent extends BrowserEvent<void> {
    target_id: TargetID;
    error: string;
    constructor(init: EventBusEventInit<void> & {
        target_id: TargetID;
        error: string;
    });
}
export declare class NavigationStartedEvent extends BrowserEvent<void> {
    target_id: TargetID;
    url: string;
    constructor(init: EventBusEventInit<void> & {
        target_id: TargetID;
        url: string;
    });
}
export declare class NavigationCompleteEvent extends BrowserEvent<void> {
    target_id: TargetID;
    url: string;
    status: number | null;
    error_message: string | null;
    loading_status: string | null;
    constructor(init: EventBusEventInit<void> & {
        target_id: TargetID;
        url: string;
        status?: number | null;
        error_message?: string | null;
        loading_status?: string | null;
    });
}
export declare class BrowserErrorEvent extends BrowserEvent<void> {
    error_type: string;
    message: string;
    details: Record<string, unknown>;
    constructor(init: EventBusEventInit<void> & {
        error_type: string;
        message: string;
        details?: Record<string, unknown>;
    });
}
export declare class SaveStorageStateEvent extends BrowserEvent<void> {
    path: string | null;
    constructor(init?: EventBusEventInit<void> & {
        path?: string | null;
    });
}
export declare class StorageStateSavedEvent extends BrowserEvent<void> {
    path: string;
    cookies_count: number;
    origins_count: number;
    constructor(init: EventBusEventInit<void> & {
        path: string;
        cookies_count: number;
        origins_count: number;
    });
}
export declare class LoadStorageStateEvent extends BrowserEvent<void> {
    path: string | null;
    constructor(init?: EventBusEventInit<void> & {
        path?: string | null;
    });
}
export declare class StorageStateLoadedEvent extends BrowserEvent<void> {
    path: string;
    cookies_count: number;
    origins_count: number;
    constructor(init: EventBusEventInit<void> & {
        path: string;
        cookies_count: number;
        origins_count: number;
    });
}
export declare class DownloadStartedEvent extends BrowserEvent<void> {
    guid: string;
    url: string;
    suggested_filename: string;
    auto_download: boolean;
    constructor(init: EventBusEventInit<void> & {
        guid: string;
        url: string;
        suggested_filename: string;
        auto_download?: boolean;
    });
}
export declare class DownloadProgressEvent extends BrowserEvent<void> {
    guid: string;
    received_bytes: number;
    total_bytes: number;
    state: string;
    constructor(init: EventBusEventInit<void> & {
        guid: string;
        received_bytes: number;
        total_bytes: number;
        state: string;
    });
}
export declare class FileDownloadedEvent extends BrowserEvent<void> {
    guid: string | null;
    url: string;
    path: string;
    file_name: string;
    file_size: number;
    file_type: string | null;
    mime_type: string | null;
    from_cache: boolean;
    auto_download: boolean;
    constructor(init: EventBusEventInit<void> & {
        guid?: string | null;
        url: string;
        path: string;
        file_name: string;
        file_size: number;
        file_type?: string | null;
        mime_type?: string | null;
        from_cache?: boolean;
        auto_download?: boolean;
    });
}
export declare class AboutBlankDVDScreensaverShownEvent extends BrowserEvent<void> {
    target_id: TargetID;
    error: string | null;
    constructor(init: EventBusEventInit<void> & {
        target_id: TargetID;
        error?: string | null;
    });
}
export declare class DialogOpenedEvent extends BrowserEvent<void> {
    dialog_type: string;
    message: string;
    url: string;
    frame_id: string | null;
    constructor(init: EventBusEventInit<void> & {
        dialog_type: string;
        message: string;
        url: string;
        frame_id?: string | null;
    });
}
export declare const BROWSER_EVENT_CLASSES: readonly [typeof ElementSelectedEvent, typeof NavigateToUrlEvent, typeof ClickElementEvent, typeof ClickCoordinateEvent, typeof TypeTextEvent, typeof ScrollEvent, typeof SwitchTabEvent, typeof CloseTabEvent, typeof ScreenshotEvent, typeof BrowserStateRequestEvent, typeof GoBackEvent, typeof GoForwardEvent, typeof RefreshEvent, typeof WaitEvent, typeof SendKeysEvent, typeof UploadFileEvent, typeof GetDropdownOptionsEvent, typeof SelectDropdownOptionEvent, typeof ScrollToTextEvent, typeof BrowserStartEvent, typeof BrowserStopEvent, typeof BrowserLaunchEvent, typeof BrowserKillEvent, typeof BrowserConnectedEvent, typeof BrowserReconnectingEvent, typeof BrowserReconnectedEvent, typeof BrowserStoppedEvent, typeof TabCreatedEvent, typeof TabClosedEvent, typeof AgentFocusChangedEvent, typeof TargetCrashedEvent, typeof NavigationStartedEvent, typeof NavigationCompleteEvent, typeof BrowserErrorEvent, typeof SaveStorageStateEvent, typeof StorageStateSavedEvent, typeof LoadStorageStateEvent, typeof StorageStateLoadedEvent, typeof DownloadStartedEvent, typeof DownloadProgressEvent, typeof FileDownloadedEvent, typeof AboutBlankDVDScreensaverShownEvent, typeof DialogOpenedEvent];
export declare const BROWSER_EVENT_NAMES: string[];
