import fs from 'node:fs';
import path from 'node:path';
import { BrowserConnectedEvent, BrowserStopEvent, LoadStorageStateEvent, SaveStorageStateEvent, StorageStateLoadedEvent, StorageStateSavedEvent, } from '../events.js';
import { BaseWatchdog } from './base.js';
export class StorageStateWatchdog extends BaseWatchdog {
    static LISTENS_TO = [
        BrowserConnectedEvent,
        BrowserStopEvent,
        SaveStorageStateEvent,
        LoadStorageStateEvent,
    ];
    static EMITS = [StorageStateSavedEvent, StorageStateLoadedEvent];
    _monitorInterval = null;
    _autoSaveIntervalMs = 30_000;
    _monitoring = false;
    _lastSavedSnapshot = null;
    async on_BrowserConnectedEvent() {
        this._startMonitoring();
        await this.event_bus.dispatch(new LoadStorageStateEvent());
    }
    async on_BrowserStopEvent() {
        this._stopMonitoring();
        await this.event_bus.dispatch(new SaveStorageStateEvent());
    }
    async on_SaveStorageStateEvent(event) {
        const targetPath = this._resolveStoragePath(event.path);
        if (!targetPath) {
            return;
        }
        const browserContext = this.browser_session.browser_context;
        if (!browserContext?.storageState) {
            this.browser_session.logger.debug('[StorageStateWatchdog] Browser context unavailable for save');
            return;
        }
        const storageState = (await browserContext.storageState());
        const normalized = storageState ?? {};
        const merged = this._mergeStorageStates(this._readStoredState(targetPath), {
            cookies: Array.isArray(normalized.cookies) ? normalized.cookies : [],
            origins: Array.isArray(normalized.origins) ? normalized.origins : [],
        });
        this._lastSavedSnapshot = this._snapshotStorageState(merged);
        const dirPath = path.dirname(targetPath);
        fs.mkdirSync(dirPath, { recursive: true });
        const tempPath = `${targetPath}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(merged, null, 2));
        if (fs.existsSync(targetPath)) {
            const backupPath = `${targetPath}.bak`;
            try {
                fs.renameSync(targetPath, backupPath);
            }
            catch {
                // Ignore backup failures and continue with atomic swap.
            }
        }
        fs.renameSync(tempPath, targetPath);
        await this.event_bus.dispatch(new StorageStateSavedEvent({
            path: targetPath,
            cookies_count: Array.isArray(merged.cookies)
                ? merged.cookies.length
                : 0,
            origins_count: Array.isArray(merged.origins)
                ? merged.origins.length
                : 0,
        }));
    }
    async on_LoadStorageStateEvent(event) {
        const targetPath = this._resolveStoragePath(event.path);
        if (!targetPath || !fs.existsSync(targetPath)) {
            return;
        }
        const browserContext = this.browser_session.browser_context;
        if (!browserContext) {
            this.browser_session.logger.debug('[StorageStateWatchdog] Browser context unavailable for load');
            return;
        }
        const raw = fs.readFileSync(targetPath, 'utf-8');
        const parsed = JSON.parse(raw);
        const cookies = Array.isArray(parsed.cookies) ? parsed.cookies : [];
        const origins = Array.isArray(parsed.origins) ? parsed.origins : [];
        this._lastSavedSnapshot = this._snapshotStorageState({
            cookies,
            origins,
        });
        if (cookies.length > 0 && typeof browserContext.addCookies === 'function') {
            await browserContext.addCookies(cookies);
        }
        if (origins.length > 0) {
            await this._applyOriginsStorage(origins);
        }
        await this.event_bus.dispatch(new StorageStateLoadedEvent({
            path: targetPath,
            cookies_count: cookies.length,
            origins_count: origins.length,
        }));
    }
    onDetached() {
        this._stopMonitoring();
    }
    _resolveStoragePath(pathFromEvent) {
        if (typeof pathFromEvent === 'string' && pathFromEvent.trim().length > 0) {
            return path.resolve(pathFromEvent);
        }
        const configured = this.browser_session.browser_profile.config.storage_state;
        if (typeof configured === 'string' && configured.trim().length > 0) {
            return path.resolve(configured);
        }
        const cookiesFile = this.browser_session.browser_profile.cookies_file;
        if (typeof cookiesFile === 'string' && cookiesFile.trim().length > 0) {
            return path.resolve(cookiesFile);
        }
        return null;
    }
    _startMonitoring() {
        if (this._monitorInterval) {
            return;
        }
        if (!this._resolveStoragePath(null)) {
            return;
        }
        this._monitorInterval = setInterval(() => {
            void this._checkAndAutoSave().catch((error) => {
                this.browser_session.logger.debug(`[StorageStateWatchdog] Auto-save monitor failed: ${error.message}`);
            });
        }, this._autoSaveIntervalMs);
    }
    _stopMonitoring() {
        if (!this._monitorInterval) {
            return;
        }
        clearInterval(this._monitorInterval);
        this._monitorInterval = null;
    }
    async _checkAndAutoSave() {
        if (this._monitoring) {
            return;
        }
        const browserContext = this.browser_session.browser_context;
        if (!browserContext?.storageState) {
            return;
        }
        this._monitoring = true;
        try {
            const storageState = (await browserContext.storageState());
            const normalized = storageState ?? {};
            const snapshot = this._snapshotStorageState(normalized);
            if (snapshot === this._lastSavedSnapshot) {
                return;
            }
            await this.event_bus.dispatch(new SaveStorageStateEvent());
        }
        finally {
            this._monitoring = false;
        }
    }
    _snapshotStorageState(state) {
        const cookies = Array.isArray(state.cookies) ? state.cookies : [];
        const origins = Array.isArray(state.origins) ? state.origins : [];
        return JSON.stringify({
            cookies,
            origins,
        });
    }
    _readStoredState(targetPath) {
        if (!fs.existsSync(targetPath)) {
            return {
                cookies: [],
                origins: [],
            };
        }
        try {
            const raw = fs.readFileSync(targetPath, 'utf-8');
            const parsed = JSON.parse(raw);
            return {
                cookies: Array.isArray(parsed.cookies) ? parsed.cookies : [],
                origins: Array.isArray(parsed.origins) ? parsed.origins : [],
            };
        }
        catch (error) {
            this.browser_session.logger.debug(`[StorageStateWatchdog] Failed to parse existing storage state: ${error.message}`);
            return {
                cookies: [],
                origins: [],
            };
        }
    }
    _mergeStorageStates(existing, incoming) {
        const mergedCookies = new Map();
        const toCookieKey = (cookie) => `${String(cookie?.name ?? '')}::${String(cookie?.domain ?? '')}::${String(cookie?.path ?? '')}`;
        for (const cookie of Array.isArray(existing.cookies)
            ? existing.cookies
            : []) {
            mergedCookies.set(toCookieKey(cookie), cookie);
        }
        for (const cookie of Array.isArray(incoming.cookies)
            ? incoming.cookies
            : []) {
            mergedCookies.set(toCookieKey(cookie), cookie);
        }
        const mergedOrigins = new Map();
        const toOriginKey = (origin) => String(origin?.origin ?? '');
        for (const origin of Array.isArray(existing.origins)
            ? existing.origins
            : []) {
            mergedOrigins.set(toOriginKey(origin), origin);
        }
        for (const origin of Array.isArray(incoming.origins)
            ? incoming.origins
            : []) {
            mergedOrigins.set(toOriginKey(origin), origin);
        }
        return {
            cookies: [...mergedCookies.values()],
            origins: [...mergedOrigins.values()],
        };
    }
    async _applyOriginsStorage(origins) {
        const browserContext = this.browser_session.browser_context;
        if (!browserContext?.newPage) {
            return;
        }
        for (const originState of origins) {
            const origin = typeof originState?.origin === 'string'
                ? originState.origin.trim()
                : '';
            if (!origin || !/^https?:\/\//i.test(origin)) {
                continue;
            }
            const localStorageEntries = this._normalizeStorageEntries(originState?.localStorage);
            const sessionStorageEntries = this._normalizeStorageEntries(originState?.sessionStorage);
            if (localStorageEntries.length === 0 &&
                sessionStorageEntries.length === 0) {
                continue;
            }
            let page = null;
            try {
                page = await browserContext.newPage();
                await page.goto?.(origin, {
                    waitUntil: 'domcontentloaded',
                    timeout: 5_000,
                });
                await page.evaluate?.((payload) => {
                    for (const entry of payload.localStorageEntries) {
                        window.localStorage.setItem(entry.name, entry.value);
                    }
                    for (const entry of payload.sessionStorageEntries) {
                        window.sessionStorage.setItem(entry.name, entry.value);
                    }
                }, {
                    localStorageEntries,
                    sessionStorageEntries,
                });
            }
            catch (error) {
                this.browser_session.logger.debug(`[StorageStateWatchdog] Failed to apply origin storage for ${origin}: ${error.message}`);
            }
            finally {
                try {
                    await page?.close?.();
                }
                catch {
                    // Ignore cleanup errors.
                }
            }
        }
    }
    _normalizeStorageEntries(entries) {
        if (!Array.isArray(entries)) {
            return [];
        }
        const normalized = [];
        for (const entry of entries) {
            const name = entry && typeof entry === 'object' && 'name' in entry
                ? String(entry.name ?? '')
                : '';
            if (!name) {
                continue;
            }
            const value = entry && typeof entry === 'object' && 'value' in entry
                ? String(entry.value ?? '')
                : '';
            normalized.push({
                name,
                value,
            });
        }
        return normalized;
    }
}
