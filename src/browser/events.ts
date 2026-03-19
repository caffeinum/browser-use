import type { DOMElementNode } from '../dom/views.js';
import { EventBusEvent, type EventBusEventInit } from '../event-bus.js';
import { BrowserStateSummary } from './views.js';

export type TargetID = string;

export type WaitUntilState =
  | 'load'
  | 'domcontentloaded'
  | 'networkidle'
  | 'commit';

export type MouseButton = 'left' | 'right' | 'middle';

const getTimeout = (envVar: string, defaultValue: number): number | null => {
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

const resolveEventTimeout = (
  eventName: string,
  defaultSeconds: number,
  explicitTimeout: number | null | undefined
) =>
  explicitTimeout !== undefined
    ? explicitTimeout
    : getTimeout(`TIMEOUT_${eventName}`, defaultSeconds);

export abstract class BrowserEvent<
  TResult = unknown,
> extends EventBusEvent<TResult> {
  protected constructor(
    eventType: string,
    init: EventBusEventInit<TResult> = {}
  ) {
    super(eventType, init);
  }
}

export class ElementSelectedEvent<
  TResult = unknown,
  TNode = DOMElementNode,
> extends BrowserEvent<TResult> {
  node: TNode;

  constructor(
    eventType: string,
    init: EventBusEventInit<TResult> & { node: TNode }
  ) {
    super(eventType, init);
    this.node = init.node;
  }
}

export class NavigateToUrlEvent extends BrowserEvent<void> {
  url: string;
  wait_until: WaitUntilState;
  timeout_ms: number | null;
  new_tab: boolean;

  constructor(
    init: EventBusEventInit<void> & {
      url: string;
      wait_until?: WaitUntilState;
      timeout_ms?: number | null;
      new_tab?: boolean;
    }
  ) {
    super('NavigateToUrlEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'NavigateToUrlEvent',
        15,
        init.event_timeout
      ),
    });
    this.url = init.url;
    this.wait_until = init.wait_until ?? 'load';
    this.timeout_ms = init.timeout_ms ?? null;
    this.new_tab = init.new_tab ?? false;
  }
}

export class ClickElementEvent extends ElementSelectedEvent<Record<
  string,
  unknown
> | null> {
  button: MouseButton;

  constructor(
    init: EventBusEventInit<Record<string, unknown> | null> & {
      node: DOMElementNode;
      button?: MouseButton;
    }
  ) {
    super('ClickElementEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'ClickElementEvent',
        15,
        init.event_timeout
      ),
    });
    this.button = init.button ?? 'left';
  }
}

export class ClickCoordinateEvent extends BrowserEvent<
  Record<string, unknown>
> {
  coordinate_x: number;
  coordinate_y: number;
  button: MouseButton;
  force: boolean;

  constructor(
    init: EventBusEventInit<Record<string, unknown>> & {
      coordinate_x: number;
      coordinate_y: number;
      button?: MouseButton;
      force?: boolean;
    }
  ) {
    super('ClickCoordinateEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'ClickCoordinateEvent',
        15,
        init.event_timeout
      ),
    });
    this.coordinate_x = init.coordinate_x;
    this.coordinate_y = init.coordinate_y;
    this.button = init.button ?? 'left';
    this.force = init.force ?? false;
  }
}

export class TypeTextEvent extends ElementSelectedEvent<Record<
  string,
  unknown
> | null> {
  text: string;
  clear: boolean;
  is_sensitive: boolean;
  sensitive_key_name: string | null;

  constructor(
    init: EventBusEventInit<Record<string, unknown> | null> & {
      node: DOMElementNode;
      text: string;
      clear?: boolean;
      is_sensitive?: boolean;
      sensitive_key_name?: string | null;
    }
  ) {
    super('TypeTextEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'TypeTextEvent',
        60,
        init.event_timeout
      ),
    });
    this.text = init.text;
    this.clear = init.clear ?? true;
    this.is_sensitive = init.is_sensitive ?? false;
    this.sensitive_key_name = init.sensitive_key_name ?? null;
  }
}

export class ScrollEvent extends ElementSelectedEvent<
  void,
  DOMElementNode | null
> {
  direction: 'up' | 'down' | 'left' | 'right';
  amount: number;

  constructor(
    init: EventBusEventInit<void> & {
      direction: 'up' | 'down' | 'left' | 'right';
      amount: number;
      node?: DOMElementNode | null;
    }
  ) {
    super('ScrollEvent', {
      ...init,
      node: init.node ?? null,
      event_timeout: resolveEventTimeout('ScrollEvent', 8, init.event_timeout),
    });
    this.direction = init.direction;
    this.amount = init.amount;
  }
}

export class SwitchTabEvent extends BrowserEvent<TargetID> {
  target_id: TargetID | null;

  constructor(
    init: EventBusEventInit<TargetID> & { target_id?: TargetID | null } = {}
  ) {
    super('SwitchTabEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'SwitchTabEvent',
        10,
        init.event_timeout
      ),
    });
    this.target_id = init.target_id ?? null;
  }
}

export class CloseTabEvent extends BrowserEvent<void> {
  target_id: TargetID;

  constructor(init: EventBusEventInit<void> & { target_id: TargetID }) {
    super('CloseTabEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'CloseTabEvent',
        10,
        init.event_timeout
      ),
    });
    this.target_id = init.target_id;
  }
}

export class ScreenshotEvent extends BrowserEvent<string> {
  full_page: boolean;
  clip: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;

  constructor(
    init: EventBusEventInit<string> & {
      full_page?: boolean;
      clip?: {
        x: number;
        y: number;
        width: number;
        height: number;
      } | null;
    } = {}
  ) {
    super('ScreenshotEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'ScreenshotEvent',
        15,
        init.event_timeout
      ),
    });
    this.full_page = init.full_page ?? false;
    this.clip = init.clip ?? null;
  }
}

export class BrowserStateRequestEvent extends BrowserEvent<BrowserStateSummary> {
  include_dom: boolean;
  include_screenshot: boolean;
  include_recent_events: boolean;

  constructor(
    init: EventBusEventInit<BrowserStateSummary> & {
      include_dom?: boolean;
      include_screenshot?: boolean;
      include_recent_events?: boolean;
    } = {}
  ) {
    super('BrowserStateRequestEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'BrowserStateRequestEvent',
        30,
        init.event_timeout
      ),
    });
    this.include_dom = init.include_dom ?? true;
    this.include_screenshot = init.include_screenshot ?? true;
    this.include_recent_events = init.include_recent_events ?? false;
  }
}

export class GoBackEvent extends BrowserEvent<void> {
  constructor(init: EventBusEventInit<void> = {}) {
    super('GoBackEvent', {
      ...init,
      event_timeout: resolveEventTimeout('GoBackEvent', 15, init.event_timeout),
    });
  }
}

export class GoForwardEvent extends BrowserEvent<void> {
  constructor(init: EventBusEventInit<void> = {}) {
    super('GoForwardEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'GoForwardEvent',
        15,
        init.event_timeout
      ),
    });
  }
}

export class RefreshEvent extends BrowserEvent<void> {
  constructor(init: EventBusEventInit<void> = {}) {
    super('RefreshEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'RefreshEvent',
        15,
        init.event_timeout
      ),
    });
  }
}

export class WaitEvent extends BrowserEvent<void> {
  seconds: number;
  max_seconds: number;

  constructor(
    init: EventBusEventInit<void> & {
      seconds?: number;
      max_seconds?: number;
    } = {}
  ) {
    super('WaitEvent', {
      ...init,
      event_timeout: resolveEventTimeout('WaitEvent', 60, init.event_timeout),
    });
    this.seconds = init.seconds ?? 3;
    this.max_seconds = init.max_seconds ?? 10;
  }
}

export class SendKeysEvent extends BrowserEvent<void> {
  keys: string;

  constructor(init: EventBusEventInit<void> & { keys: string }) {
    super('SendKeysEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'SendKeysEvent',
        60,
        init.event_timeout
      ),
    });
    this.keys = init.keys;
  }
}

export class UploadFileEvent extends ElementSelectedEvent<void> {
  file_path: string;

  constructor(
    init: EventBusEventInit<void> & { node: DOMElementNode; file_path: string }
  ) {
    super('UploadFileEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'UploadFileEvent',
        30,
        init.event_timeout
      ),
    });
    this.file_path = init.file_path;
  }
}

export class GetDropdownOptionsEvent extends ElementSelectedEvent<
  Record<string, string>
> {
  constructor(
    init: EventBusEventInit<Record<string, string>> & { node: DOMElementNode }
  ) {
    super('GetDropdownOptionsEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'GetDropdownOptionsEvent',
        15,
        init.event_timeout
      ),
    });
  }
}

export class SelectDropdownOptionEvent extends ElementSelectedEvent<
  Record<string, string>
> {
  text: string;

  constructor(
    init: EventBusEventInit<Record<string, string>> & {
      node: DOMElementNode;
      text: string;
    }
  ) {
    super('SelectDropdownOptionEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'SelectDropdownOptionEvent',
        8,
        init.event_timeout
      ),
    });
    this.text = init.text;
  }
}

export class ScrollToTextEvent extends BrowserEvent<void> {
  text: string;
  direction: 'up' | 'down';

  constructor(
    init: EventBusEventInit<void> & {
      text: string;
      direction?: 'up' | 'down';
    }
  ) {
    super('ScrollToTextEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'ScrollToTextEvent',
        15,
        init.event_timeout
      ),
    });
    this.text = init.text;
    this.direction = init.direction ?? 'down';
  }
}

export class BrowserStartEvent extends BrowserEvent<void> {
  cdp_url: string | null;
  launch_options: Record<string, unknown>;

  constructor(
    init: EventBusEventInit<void> & {
      cdp_url?: string | null;
      launch_options?: Record<string, unknown>;
    } = {}
  ) {
    super('BrowserStartEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'BrowserStartEvent',
        30,
        init.event_timeout
      ),
    });
    this.cdp_url = init.cdp_url ?? null;
    this.launch_options = init.launch_options ?? {};
  }
}

export class BrowserStopEvent extends BrowserEvent<void> {
  force: boolean;

  constructor(init: EventBusEventInit<void> & { force?: boolean } = {}) {
    super('BrowserStopEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'BrowserStopEvent',
        45,
        init.event_timeout
      ),
    });
    this.force = init.force ?? false;
  }
}

export interface BrowserLaunchResult {
  cdp_url: string;
}

export class BrowserLaunchEvent extends BrowserEvent<BrowserLaunchResult> {
  constructor(init: EventBusEventInit<BrowserLaunchResult> = {}) {
    super('BrowserLaunchEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'BrowserLaunchEvent',
        30,
        init.event_timeout
      ),
    });
  }
}

export class BrowserKillEvent extends BrowserEvent<void> {
  constructor(init: EventBusEventInit<void> = {}) {
    super('BrowserKillEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'BrowserKillEvent',
        30,
        init.event_timeout
      ),
    });
  }
}

export class BrowserConnectedEvent extends BrowserEvent<void> {
  cdp_url: string;

  constructor(init: EventBusEventInit<void> & { cdp_url: string }) {
    super('BrowserConnectedEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'BrowserConnectedEvent',
        30,
        init.event_timeout
      ),
    });
    this.cdp_url = init.cdp_url;
  }
}

export class BrowserReconnectingEvent extends BrowserEvent<void> {
  cdp_url: string;
  attempt: number;
  max_attempts: number;

  constructor(
    init: EventBusEventInit<void> & {
      cdp_url: string;
      attempt: number;
      max_attempts: number;
    }
  ) {
    super('BrowserReconnectingEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'BrowserReconnectingEvent',
        30,
        init.event_timeout
      ),
    });
    this.cdp_url = init.cdp_url;
    this.attempt = init.attempt;
    this.max_attempts = init.max_attempts;
  }
}

export class BrowserReconnectedEvent extends BrowserEvent<void> {
  cdp_url: string;
  attempt: number;
  downtime_seconds: number;

  constructor(
    init: EventBusEventInit<void> & {
      cdp_url: string;
      attempt: number;
      downtime_seconds: number;
    }
  ) {
    super('BrowserReconnectedEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'BrowserReconnectedEvent',
        30,
        init.event_timeout
      ),
    });
    this.cdp_url = init.cdp_url;
    this.attempt = init.attempt;
    this.downtime_seconds = init.downtime_seconds;
  }
}

export class BrowserStoppedEvent extends BrowserEvent<void> {
  reason: string | null;

  constructor(init: EventBusEventInit<void> & { reason?: string | null } = {}) {
    super('BrowserStoppedEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'BrowserStoppedEvent',
        30,
        init.event_timeout
      ),
    });
    this.reason = init.reason ?? null;
  }
}

export class CaptchaSolverStartedEvent extends BrowserEvent<void> {
  target_id: TargetID;
  vendor: string;
  url: string;
  started_at: number;

  constructor(
    init: EventBusEventInit<void> & {
      target_id: TargetID;
      vendor: string;
      url: string;
      started_at: number;
    }
  ) {
    super('CaptchaSolverStartedEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'CaptchaSolverStartedEvent',
        5,
        init.event_timeout
      ),
    });
    this.target_id = init.target_id;
    this.vendor = init.vendor;
    this.url = init.url;
    this.started_at = init.started_at;
  }
}

export class CaptchaSolverFinishedEvent extends BrowserEvent<void> {
  target_id: TargetID;
  vendor: string;
  url: string;
  duration_ms: number;
  finished_at: number;
  success: boolean;

  constructor(
    init: EventBusEventInit<void> & {
      target_id: TargetID;
      vendor: string;
      url: string;
      duration_ms: number;
      finished_at: number;
      success: boolean;
    }
  ) {
    super('CaptchaSolverFinishedEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'CaptchaSolverFinishedEvent',
        5,
        init.event_timeout
      ),
    });
    this.target_id = init.target_id;
    this.vendor = init.vendor;
    this.url = init.url;
    this.duration_ms = init.duration_ms;
    this.finished_at = init.finished_at;
    this.success = init.success;
  }
}

export class TabCreatedEvent extends BrowserEvent<void> {
  target_id: TargetID;
  url: string;

  constructor(
    init: EventBusEventInit<void> & { target_id: TargetID; url: string }
  ) {
    super('TabCreatedEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'TabCreatedEvent',
        30,
        init.event_timeout
      ),
    });
    this.target_id = init.target_id;
    this.url = init.url;
  }
}

export class TabClosedEvent extends BrowserEvent<void> {
  target_id: TargetID;

  constructor(init: EventBusEventInit<void> & { target_id: TargetID }) {
    super('TabClosedEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'TabClosedEvent',
        10,
        init.event_timeout
      ),
    });
    this.target_id = init.target_id;
  }
}

export class AgentFocusChangedEvent extends BrowserEvent<void> {
  target_id: TargetID;
  url: string;

  constructor(
    init: EventBusEventInit<void> & { target_id: TargetID; url: string }
  ) {
    super('AgentFocusChangedEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'AgentFocusChangedEvent',
        10,
        init.event_timeout
      ),
    });
    this.target_id = init.target_id;
    this.url = init.url;
  }
}

export class TargetCrashedEvent extends BrowserEvent<void> {
  target_id: TargetID;
  error: string;

  constructor(
    init: EventBusEventInit<void> & { target_id: TargetID; error: string }
  ) {
    super('TargetCrashedEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'TargetCrashedEvent',
        10,
        init.event_timeout
      ),
    });
    this.target_id = init.target_id;
    this.error = init.error;
  }
}

export class NavigationStartedEvent extends BrowserEvent<void> {
  target_id: TargetID;
  url: string;

  constructor(
    init: EventBusEventInit<void> & { target_id: TargetID; url: string }
  ) {
    super('NavigationStartedEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'NavigationStartedEvent',
        30,
        init.event_timeout
      ),
    });
    this.target_id = init.target_id;
    this.url = init.url;
  }
}

export class NavigationCompleteEvent extends BrowserEvent<void> {
  target_id: TargetID;
  url: string;
  status: number | null;
  error_message: string | null;
  loading_status: string | null;

  constructor(
    init: EventBusEventInit<void> & {
      target_id: TargetID;
      url: string;
      status?: number | null;
      error_message?: string | null;
      loading_status?: string | null;
    }
  ) {
    super('NavigationCompleteEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'NavigationCompleteEvent',
        30,
        init.event_timeout
      ),
    });
    this.target_id = init.target_id;
    this.url = init.url;
    this.status = init.status ?? null;
    this.error_message = init.error_message ?? null;
    this.loading_status = init.loading_status ?? null;
  }
}

export class BrowserErrorEvent extends BrowserEvent<void> {
  error_type: string;
  message: string;
  details: Record<string, unknown>;

  constructor(
    init: EventBusEventInit<void> & {
      error_type: string;
      message: string;
      details?: Record<string, unknown>;
    }
  ) {
    super('BrowserErrorEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'BrowserErrorEvent',
        30,
        init.event_timeout
      ),
    });
    this.error_type = init.error_type;
    this.message = init.message;
    this.details = init.details ?? {};
  }
}

export class SaveStorageStateEvent extends BrowserEvent<void> {
  path: string | null;

  constructor(init: EventBusEventInit<void> & { path?: string | null } = {}) {
    super('SaveStorageStateEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'SaveStorageStateEvent',
        45,
        init.event_timeout
      ),
    });
    this.path = init.path ?? null;
  }
}

export class StorageStateSavedEvent extends BrowserEvent<void> {
  path: string;
  cookies_count: number;
  origins_count: number;

  constructor(
    init: EventBusEventInit<void> & {
      path: string;
      cookies_count: number;
      origins_count: number;
    }
  ) {
    super('StorageStateSavedEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'StorageStateSavedEvent',
        30,
        init.event_timeout
      ),
    });
    this.path = init.path;
    this.cookies_count = init.cookies_count;
    this.origins_count = init.origins_count;
  }
}

export class LoadStorageStateEvent extends BrowserEvent<void> {
  path: string | null;

  constructor(init: EventBusEventInit<void> & { path?: string | null } = {}) {
    super('LoadStorageStateEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'LoadStorageStateEvent',
        45,
        init.event_timeout
      ),
    });
    this.path = init.path ?? null;
  }
}

export class StorageStateLoadedEvent extends BrowserEvent<void> {
  path: string;
  cookies_count: number;
  origins_count: number;

  constructor(
    init: EventBusEventInit<void> & {
      path: string;
      cookies_count: number;
      origins_count: number;
    }
  ) {
    super('StorageStateLoadedEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'StorageStateLoadedEvent',
        30,
        init.event_timeout
      ),
    });
    this.path = init.path;
    this.cookies_count = init.cookies_count;
    this.origins_count = init.origins_count;
  }
}

export class DownloadStartedEvent extends BrowserEvent<void> {
  guid: string;
  url: string;
  suggested_filename: string;
  auto_download: boolean;

  constructor(
    init: EventBusEventInit<void> & {
      guid: string;
      url: string;
      suggested_filename: string;
      auto_download?: boolean;
    }
  ) {
    super('DownloadStartedEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'DownloadStartedEvent',
        5,
        init.event_timeout
      ),
    });
    this.guid = init.guid;
    this.url = init.url;
    this.suggested_filename = init.suggested_filename;
    this.auto_download = init.auto_download ?? false;
  }
}

export class DownloadProgressEvent extends BrowserEvent<void> {
  guid: string;
  received_bytes: number;
  total_bytes: number;
  state: string;

  constructor(
    init: EventBusEventInit<void> & {
      guid: string;
      received_bytes: number;
      total_bytes: number;
      state: string;
    }
  ) {
    super('DownloadProgressEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'DownloadProgressEvent',
        5,
        init.event_timeout
      ),
    });
    this.guid = init.guid;
    this.received_bytes = init.received_bytes;
    this.total_bytes = init.total_bytes;
    this.state = init.state;
  }
}

export class FileDownloadedEvent extends BrowserEvent<void> {
  guid: string | null;
  url: string;
  path: string;
  file_name: string;
  file_size: number;
  file_type: string | null;
  mime_type: string | null;
  from_cache: boolean;
  auto_download: boolean;

  constructor(
    init: EventBusEventInit<void> & {
      guid?: string | null;
      url: string;
      path: string;
      file_name: string;
      file_size: number;
      file_type?: string | null;
      mime_type?: string | null;
      from_cache?: boolean;
      auto_download?: boolean;
    }
  ) {
    super('FileDownloadedEvent', {
      ...init,
      event_timeout: resolveEventTimeout(
        'FileDownloadedEvent',
        30,
        init.event_timeout
      ),
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

export class AboutBlankDVDScreensaverShownEvent extends BrowserEvent<void> {
  target_id: TargetID;
  error: string | null;

  constructor(
    init: EventBusEventInit<void> & {
      target_id: TargetID;
      error?: string | null;
    }
  ) {
    super('AboutBlankDVDScreensaverShownEvent', init);
    this.target_id = init.target_id;
    this.error = init.error ?? null;
  }
}

export class DialogOpenedEvent extends BrowserEvent<void> {
  dialog_type: string;
  message: string;
  url: string;
  frame_id: string | null;

  constructor(
    init: EventBusEventInit<void> & {
      dialog_type: string;
      message: string;
      url: string;
      frame_id?: string | null;
    }
  ) {
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
] as const;

export const BROWSER_EVENT_NAMES = BROWSER_EVENT_CLASSES.map(
  (eventClass) => eventClass.name
);

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
        throw new Error(
          `Event ${nameA} is a substring of ${nameB}; event names must be non-overlapping`
        );
      }
    }
  }
};

checkEventNamesDontOverlap();
