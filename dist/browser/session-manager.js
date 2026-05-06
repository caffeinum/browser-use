export class SessionManager {
    _targets = new Map();
    _sessions = new Map();
    _target_sessions = new Map();
    _session_to_target = new Map();
    _page_targets = new Map();
    _tab_target_ids = new Set();
    _focused_target_id = null;
    sync_tabs(tabs, current_tab_index, target_id_factory) {
        const nextTabTargetIds = new Set();
        const seenPageIds = new Set();
        for (const tab of tabs) {
            const target_id = tab.target_id ?? target_id_factory(tab.page_id);
            tab.target_id = target_id;
            nextTabTargetIds.add(target_id);
            seenPageIds.add(tab.page_id);
            this.upsert_target({
                target_id,
                target_type: 'page',
                url: tab.url,
                title: tab.title,
                attached: true,
                source: 'tab',
            });
            this.bind_page_to_target(tab.page_id, target_id);
        }
        for (const target_id of [...this._tab_target_ids]) {
            if (!nextTabTargetIds.has(target_id)) {
                this.remove_target(target_id);
            }
        }
        this._tab_target_ids = nextTabTargetIds;
        for (const page_id of [...this._page_targets.keys()]) {
            if (!seenPageIds.has(page_id)) {
                this._page_targets.delete(page_id);
            }
        }
        const currentTab = tabs[current_tab_index] ?? null;
        this._focused_target_id = currentTab?.target_id ?? null;
    }
    handle_target_attached(payload) {
        this.upsert_target({
            target_id: payload.target_id,
            target_type: payload.target_type ?? 'page',
            url: payload.url ?? '',
            title: payload.title ?? '',
            attached: true,
            source: 'cdp',
        });
        if (payload.session_id) {
            this.upsert_session(payload.session_id, payload.target_id);
        }
    }
    handle_target_detached(payload) {
        if (payload.session_id) {
            this.remove_session(payload.session_id);
        }
        const targetSessions = this._target_sessions.get(payload.target_id);
        if (targetSessions && targetSessions.size > 0) {
            return;
        }
        const target = this._targets.get(payload.target_id);
        if (!target) {
            return;
        }
        if (target.source === 'tab' &&
            this._tab_target_ids.has(payload.target_id)) {
            target.attached = false;
            target.last_seen_at = new Date().toISOString();
            this._targets.set(payload.target_id, target);
            return;
        }
        this.remove_target(payload.target_id);
    }
    handle_target_info_changed(payload) {
        const current = this._targets.get(payload.target_id);
        this.upsert_target({
            target_id: payload.target_id,
            target_type: payload.target_type ?? current?.target_type ?? 'page',
            url: payload.url ?? current?.url ?? '',
            title: payload.title ?? current?.title ?? '',
            attached: current?.attached ?? true,
            source: current?.source ?? 'cdp',
        });
    }
    upsert_target(init) {
        const now = new Date().toISOString();
        const existing = this._targets.get(init.target_id);
        const nextTarget = {
            target_id: init.target_id,
            target_type: init.target_type ?? existing?.target_type ?? 'page',
            url: init.url ?? existing?.url ?? '',
            title: init.title ?? existing?.title ?? '',
            attached: init.attached ?? existing?.attached ?? true,
            source: init.source ?? existing?.source ?? 'unknown',
            first_seen_at: existing?.first_seen_at ?? now,
            last_seen_at: now,
        };
        this._targets.set(init.target_id, nextTarget);
        return nextTarget;
    }
    remove_target(target_id) {
        this._targets.delete(target_id);
        this._tab_target_ids.delete(target_id);
        const sessions = this._target_sessions.get(target_id);
        if (sessions) {
            for (const session_id of sessions) {
                this._sessions.delete(session_id);
                this._session_to_target.delete(session_id);
            }
        }
        this._target_sessions.delete(target_id);
        for (const [page_id, mapped_target_id] of this._page_targets.entries()) {
            if (mapped_target_id === target_id) {
                this._page_targets.delete(page_id);
            }
        }
        if (this._focused_target_id === target_id) {
            this._focused_target_id = null;
        }
    }
    upsert_session(session_id, target_id) {
        const now = new Date().toISOString();
        const existing = this._sessions.get(session_id);
        this._sessions.set(session_id, {
            session_id,
            target_id,
            attached_at: existing?.attached_at ?? now,
            last_seen_at: now,
        });
        const previous_target_id = this._session_to_target.get(session_id);
        if (previous_target_id && previous_target_id !== target_id) {
            const previousSessions = this._target_sessions.get(previous_target_id);
            previousSessions?.delete(session_id);
            if (previousSessions && previousSessions.size === 0) {
                this._target_sessions.delete(previous_target_id);
            }
        }
        this._session_to_target.set(session_id, target_id);
        const sessions = this._target_sessions.get(target_id) ?? new Set();
        sessions.add(session_id);
        this._target_sessions.set(target_id, sessions);
    }
    remove_session(session_id) {
        const target_id = this._session_to_target.get(session_id);
        this._session_to_target.delete(session_id);
        this._sessions.delete(session_id);
        if (!target_id) {
            return;
        }
        const sessions = this._target_sessions.get(target_id);
        if (!sessions) {
            return;
        }
        sessions.delete(session_id);
        if (sessions.size === 0) {
            this._target_sessions.delete(target_id);
        }
    }
    bind_page_to_target(page_id, target_id) {
        this._page_targets.set(page_id, target_id);
    }
    unbind_page(page_id) {
        this._page_targets.delete(page_id);
    }
    set_focused_target(target_id) {
        this._focused_target_id = target_id;
    }
    get_focused_target_id() {
        return this._focused_target_id;
    }
    get_target(target_id) {
        return this._targets.get(target_id) ?? null;
    }
    get_session(session_id) {
        return this._sessions.get(session_id) ?? null;
    }
    get_target_id_for_session(session_id) {
        return this._session_to_target.get(session_id) ?? null;
    }
    get_target_id_for_page(page_id) {
        return this._page_targets.get(page_id) ?? null;
    }
    get_sessions_for_target(target_id) {
        const session_ids = this._target_sessions.get(target_id);
        if (!session_ids) {
            return [];
        }
        return [...session_ids]
            .map((session_id) => this._sessions.get(session_id))
            .filter((session) => session != null);
    }
    get_all_targets() {
        return [...this._targets.values()].map((target) => ({ ...target }));
    }
    get_all_sessions() {
        return [...this._sessions.values()].map((session) => ({ ...session }));
    }
    clear() {
        this._targets.clear();
        this._sessions.clear();
        this._target_sessions.clear();
        this._session_to_target.clear();
        this._page_targets.clear();
        this._tab_target_ids.clear();
        this._focused_target_id = null;
    }
}
