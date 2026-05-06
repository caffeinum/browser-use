import { BrowserConnectedEvent, BrowserStopEvent, LoadStorageStateEvent, SaveStorageStateEvent, StorageStateSavedEvent } from '../events.js';
import { BaseWatchdog } from './base.js';
export declare class StorageStateWatchdog extends BaseWatchdog {
    static LISTENS_TO: (typeof BrowserStopEvent | typeof BrowserConnectedEvent | typeof SaveStorageStateEvent)[];
    static EMITS: (typeof StorageStateSavedEvent)[];
    private _monitorInterval;
    private _autoSaveIntervalMs;
    private _monitoring;
    private _lastSavedSnapshot;
    on_BrowserConnectedEvent(): Promise<void>;
    on_BrowserStopEvent(): Promise<void>;
    on_SaveStorageStateEvent(event: SaveStorageStateEvent): Promise<void>;
    on_LoadStorageStateEvent(event: LoadStorageStateEvent): Promise<void>;
    protected onDetached(): void;
    private _resolveStoragePath;
    private _startMonitoring;
    private _stopMonitoring;
    private _checkAndAutoSave;
    private _snapshotStorageState;
    private _readStoredState;
    private _mergeStorageStates;
    private _applyOriginsStorage;
    private _normalizeStorageEntries;
}
