import type { TabInfo } from './views.js';
export type SessionManagerTargetSource = 'tab' | 'cdp' | 'unknown';
export interface SessionManagerTarget {
    target_id: string;
    target_type: string;
    url: string;
    title: string;
    attached: boolean;
    source: SessionManagerTargetSource;
    first_seen_at: string;
    last_seen_at: string;
}
export interface SessionManagerChannel {
    session_id: string;
    target_id: string;
    attached_at: string;
    last_seen_at: string;
}
export interface TargetAttachedPayload {
    target_id: string;
    session_id?: string | null;
    target_type?: string;
    url?: string;
    title?: string;
}
export interface TargetDetachedPayload {
    target_id: string;
    session_id?: string | null;
}
export interface TargetInfoChangedPayload {
    target_id: string;
    target_type?: string;
    url?: string;
    title?: string;
}
export declare class SessionManager {
    private _targets;
    private _sessions;
    private _target_sessions;
    private _session_to_target;
    private _page_targets;
    private _tab_target_ids;
    private _focused_target_id;
    sync_tabs(tabs: TabInfo[], current_tab_index: number, target_id_factory: (page_id: number) => string): void;
    handle_target_attached(payload: TargetAttachedPayload): void;
    handle_target_detached(payload: TargetDetachedPayload): void;
    handle_target_info_changed(payload: TargetInfoChangedPayload): void;
    upsert_target(init: {
        target_id: string;
        target_type?: string;
        url?: string;
        title?: string;
        attached?: boolean;
        source?: SessionManagerTargetSource;
    }): SessionManagerTarget;
    remove_target(target_id: string): void;
    upsert_session(session_id: string, target_id: string): void;
    remove_session(session_id: string): void;
    bind_page_to_target(page_id: number, target_id: string): void;
    unbind_page(page_id: number): void;
    set_focused_target(target_id: string | null): void;
    get_focused_target_id(): string | null;
    get_target(target_id: string): SessionManagerTarget | null;
    get_session(session_id: string): SessionManagerChannel | null;
    get_target_id_for_session(session_id: string): string | null;
    get_target_id_for_page(page_id: number): string | null;
    get_sessions_for_target(target_id: string): SessionManagerChannel[];
    get_all_targets(): {
        target_id: string;
        target_type: string;
        url: string;
        title: string;
        attached: boolean;
        source: SessionManagerTargetSource;
        first_seen_at: string;
        last_seen_at: string;
    }[];
    get_all_sessions(): {
        session_id: string;
        target_id: string;
        attached_at: string;
        last_seen_at: string;
    }[];
    clear(): void;
}
