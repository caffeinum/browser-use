import { EventBus, type EventDispatchOptions, type EventPayload } from '../event-bus.js';
import { type Browser, type BrowserContext, type Page, type Locator } from './types.js';
import { BrowserProfile, type BrowserProfileOptions, DEFAULT_BROWSER_PROFILE } from './profile.js';
import { BrowserStateSummary, type TabInfo } from './views.js';
import { type WaitUntilState } from './events.js';
import { DOMElementNode, type SelectorMap } from '../dom/views.js';
import { SessionManager } from './session-manager.js';
import { type CaptchaWaitResult } from './watchdogs/captcha-watchdog.js';
import type { BaseWatchdog } from './watchdogs/base.js';
export interface BrowserSessionInit {
    id?: string;
    browser_profile?: BrowserProfile;
    profile?: Partial<BrowserProfileOptions>;
    browser?: Browser | null;
    browser_context?: BrowserContext | null;
    page?: Page | null;
    title?: string | null;
    url?: string | null;
    wss_url?: string | null;
    cdp_url?: string | null;
    browser_pid?: number | null;
    playwright?: unknown;
    downloaded_files?: string[];
    closed_popup_messages?: string[];
}
export interface ChromeProfileInfo {
    directory: string;
    name: string;
    email?: string;
}
export declare const systemChrome: {
    findExecutable(): string | null;
    getUserDataDir(executablePath?: string | null): string | null;
    listProfiles(userDataDir?: string | null): ChromeProfileInfo[];
};
export interface BrowserSessionFromSystemChromeInit extends Omit<BrowserSessionInit, 'browser_profile' | 'profile'> {
    browser_profile?: BrowserProfile;
    profile?: Partial<BrowserProfileOptions>;
    profile_directory?: string | null;
}
export interface BrowserStateOptions {
    cache_clickable_elements_hashes?: boolean;
    include_screenshot?: boolean;
    include_recent_events?: boolean;
    signal?: AbortSignal | null;
}
export interface BrowserActionOptions {
    signal?: AbortSignal | null;
    clear?: boolean;
}
export interface BrowserNavigationOptions extends BrowserActionOptions {
    wait_until?: WaitUntilState;
    timeout_ms?: number | null;
}
export declare class BrowserSession {
    readonly id: string;
    readonly browser_profile: BrowserProfile;
    readonly event_bus: EventBus;
    readonly session_manager: SessionManager;
    browser: Browser | null;
    browser_context: BrowserContext | null;
    agent_current_page: Page | null;
    human_current_page: Page | null;
    initialized: boolean;
    wss_url: string | null;
    cdp_url: string | null;
    browser_pid: number | null;
    playwright: unknown;
    private cachedBrowserState;
    private _cachedClickableElementHashes;
    private currentUrl;
    private currentTitle;
    private _logger;
    private _tabCounter;
    private _tabs;
    private currentTabIndex;
    private historyStack;
    downloaded_files: string[];
    llm_screenshot_size: [number, number] | null;
    _original_viewport_size: [number, number] | null;
    private ownsBrowserResources;
    private _autoDownloadPdfs;
    private tabPages;
    private currentPageLoadingStatus;
    private _subprocess;
    private _childProcesses;
    private attachedAgentId;
    private attachedSharedAgentIds;
    private _stoppingPromise;
    private _closedPopupMessages;
    private _dialogHandlersAttached;
    private readonly _maxClosedPopupMessages;
    private _recentEvents;
    private readonly _maxRecentEvents;
    private _watchdogs;
    private _defaultWatchdogsAttached;
    private _captchaWatchdog;
    readonly RECONNECT_WAIT_TIMEOUT = 54;
    private _reconnecting;
    private _reconnectTask;
    private _reconnectWaitPromise;
    private _resolveReconnectWait;
    private _intentionalStop;
    private _disconnectAwareBrowser;
    private _browserDisconnectHandler;
    constructor(init?: BrowserSessionInit);
    static from_system_chrome(init?: BrowserSessionFromSystemChromeInit): BrowserSession;
    static list_chrome_profiles(): ChromeProfileInfo[];
    attach_watchdog(watchdog: BaseWatchdog): void;
    attach_watchdogs(watchdogs: BaseWatchdog[]): void;
    detach_watchdog(watchdog: BaseWatchdog): void;
    detach_all_watchdogs(): void;
    get_watchdogs(): BaseWatchdog[];
    dispatch_browser_event<TEvent extends EventPayload>(event: TEvent, options?: Omit<EventDispatchOptions, 'throw_on_error'>): Promise<import("../event-bus.js").EventDispatchResult<TEvent>>;
    launch(): Promise<{
        cdp_url: string;
    }>;
    attach_default_watchdogs(): void;
    wait_if_captcha_solving(timeoutSeconds?: number): Promise<CaptchaWaitResult | null>;
    private _formatTabId;
    private _createTabInfo;
    private _buildSyntheticTargetId;
    private _syncSessionManagerFromTabs;
    get_or_create_cdp_session(page?: Page | null): Promise<any>;
    private _waitForStableNetwork;
    private _setActivePage;
    private _syncCurrentTabFromPage;
    private _syncTabsWithBrowserPages;
    private _captureClosedPopupMessage;
    private _getClosedPopupMessagesSnapshot;
    private _recordRecentEvent;
    private _getRecentEventsSummary;
    private _attachDialogHandler;
    private _getPendingNetworkRequests;
    get tabs(): TabInfo[];
    get active_tab_index(): number;
    get active_tab(): TabInfo;
    describe(): string;
    get _owns_browser_resources(): boolean;
    get is_stopping(): boolean;
    get is_reconnecting(): boolean;
    get should_gate_watchdog_events(): boolean;
    get is_cdp_connected(): boolean;
    wait_for_reconnect(timeoutSeconds?: number): Promise<void>;
    claim_agent(agentId: string, mode?: 'exclusive' | 'shared'): boolean;
    claimAgent(agentId: string, mode?: 'exclusive' | 'shared'): boolean;
    release_agent(agentId?: string): boolean;
    releaseAgent(agentId?: string): boolean;
    get_attached_agent_id(): string | null;
    getAttachedAgentId(): string | null;
    get_attached_agent_ids(): string[];
    getAttachedAgentIds(): string[];
    private _determineOwnership;
    private _createAbortError;
    private _isAbortError;
    private _throwIfAborted;
    private _waitWithAbort;
    private _withAbort;
    private _toPlaywrightOptions;
    set_extra_headers(headers: Record<string, string>): Promise<void>;
    private _applyConfiguredExtraHttpHeaders;
    private _usesRemoteBrowserConnection;
    private _connectToConfiguredBrowser;
    private _ensureBrowserContextFromBrowser;
    private _beginReconnectWait;
    private _endReconnectWait;
    private _detachRemoteDisconnectHandler;
    private _attachRemoteDisconnectHandler;
    private _handleUnexpectedRemoteDisconnect;
    private _restorePagesAfterReconnect;
    reconnect(options?: {
        preferred_url?: string | null;
        preferred_tab_index?: number;
    }): Promise<void>;
    private _auto_reconnect;
    private _isSandboxLaunchError;
    private _createNoSandboxLaunchOptions;
    private _launchChromiumWithSandboxFallback;
    private _connectionDescriptor;
    toString(): string;
    get logger(): import("../logging-config.js").Logger;
    start(): Promise<this>;
    /**
     * Setup browser session by connecting to an existing browser process via PID
     * Useful for debugging or connecting to manually launched browsers
     * @param browserPid - Process ID of the browser to connect to
     * @param cdpUrl - Optional CDP URL (will be discovered if not provided)
     */
    setupBrowserViaBrowserPid(browserPid: number, cdpUrl?: string): Promise<void>;
    /**
     * Discover CDP URL from browser PID
     * Tries common ports and checks for debugging endpoints
     */
    private _discoverCdpUrl;
    private _shutdown_browser_session;
    close(): Promise<void>;
    get_browser_state_with_recovery(options?: BrowserStateOptions): Promise<BrowserStateSummary>;
    get_current_page(): Promise<import("playwright").Page | null>;
    update_current_page(page: Page | null, title?: string | null, url?: string | null): void;
    private _buildTabs;
    navigate_to(url: string, options?: BrowserNavigationOptions): Promise<import("playwright").Page | null>;
    create_new_tab(url: string, options?: BrowserNavigationOptions): Promise<import("playwright").Page | null>;
    private _resolveTabIndex;
    switch_to_tab(identifier: number | string, options?: BrowserActionOptions): Promise<import("playwright").Page | null>;
    close_tab(identifier: number | string): Promise<void>;
    wait(seconds: number, options?: BrowserActionOptions): Promise<void>;
    send_keys(keys: string, options?: BrowserActionOptions): Promise<void>;
    click_coordinates(coordinate_x: number, coordinate_y: number, options?: BrowserActionOptions & {
        button?: 'left' | 'right' | 'middle';
    }): Promise<void>;
    scroll(direction: 'up' | 'down' | 'left' | 'right', amount: number, options?: BrowserActionOptions & {
        node?: DOMElementNode | null;
    }): Promise<void>;
    scroll_to_text(text: string, options?: BrowserActionOptions & {
        direction?: 'up' | 'down';
    }): Promise<void>;
    get_dropdown_options(element_node: DOMElementNode, options?: BrowserActionOptions): Promise<{
        type: string;
        options: string;
        formatted_options: any;
        message: any;
        short_term_memory: any;
        long_term_memory: string;
    }>;
    select_dropdown_option(element_node: DOMElementNode, text: string, options?: BrowserActionOptions): Promise<{
        message: string;
        short_term_memory: string;
        long_term_memory: string;
        matched_text: string;
        matched_value: string;
    } | {
        message: string;
        short_term_memory: string;
        long_term_memory: string;
        matched_text: string;
        matched_value?: undefined;
    }>;
    upload_file(element_node: DOMElementNode, file_path: string, options?: BrowserActionOptions): Promise<void>;
    go_back(options?: BrowserActionOptions): Promise<void>;
    get_dom_element_by_index(_index: number, options?: BrowserActionOptions): Promise<DOMElementNode>;
    set_downloaded_files(files: string[]): void;
    add_downloaded_file(filePath: string): void;
    get_downloaded_files(): string[];
    set_auto_download_pdfs(enabled: boolean): void;
    auto_download_pdfs(): boolean;
    static get_unique_filename(directory: string, filename: string): Promise<string>;
    get_selector_map(options?: BrowserActionOptions): Promise<SelectorMap>;
    static is_file_input(node: DOMElementNode | null): boolean;
    is_file_input(node: DOMElementNode | null): boolean;
    find_file_upload_element_by_index(index: number, maxHeight?: number, maxDescendantDepth?: number, options?: BrowserActionOptions): Promise<DOMElementNode | null>;
    get_locate_element(node: DOMElementNode): Promise<Locator | null>;
    _input_text_element_node(node: DOMElementNode, text: string, options?: BrowserActionOptions): Promise<void>;
    _click_element_node(node: DOMElementNode, options?: BrowserActionOptions): Promise<string | null>;
    private _waitForLoad;
    /**
     * Get all cookies from the current browser context
     */
    get_cookies(): Promise<Array<Record<string, any>>>;
    /**
     * Save cookies to a file (deprecated, use save_storage_state instead)
     * @deprecated Use save_storage_state() instead
     */
    save_cookies(...args: any[]): Promise<void>;
    /**
     * Load cookies from a file (deprecated, use load_storage_state instead)
     * @deprecated Use load_storage_state() instead
     */
    load_cookies_from_file(...args: any[]): Promise<void>;
    /**
     * Save the current storage state (cookies, localStorage, sessionStorage) to a file
     */
    save_storage_state(filePath?: string): Promise<void>;
    /**
     * Load storage state (cookies, localStorage, sessionStorage) from a file
     */
    load_storage_state(filePath?: string): Promise<void>;
    /**
     * Execute JavaScript in the current page context
     */
    execute_javascript(script: string): Promise<any>;
    /**
     * Get comprehensive page information (size, scroll position, etc.)
     */
    get_page_info(page?: Page): Promise<any>;
    /**
     * Get the HTML content of the current page
     */
    get_page_html(): Promise<string>;
    /**
     * Get a debug view of the page structure including iframes
     */
    get_page_structure(): Promise<string>;
    /**
     * Navigate forward in browser history
     */
    go_forward(): Promise<void>;
    /**
     * Refresh the current page
     */
    refresh(): Promise<void>;
    /**
     * Wait for an element to appear on the page
     */
    wait_for_element(selector: string, timeout?: number): Promise<void>;
    /**
     * Take a screenshot of the current page.
     * @param full_page Whether to capture the full scrollable page
     * @param clip Optional clip region for partial screenshots
     * @returns Base64 encoded PNG screenshot
     */
    take_screenshot(full_page?: boolean, clip?: {
        x: number;
        y: number;
        width: number;
        height: number;
    } | null): Promise<string | null>;
    /**
     * Add a request event listener to the current page
     */
    on_request(callback: (request: any) => void | Promise<void>): Promise<void>;
    /**
     * Add a response event listener to the current page
     */
    on_response(callback: (response: any) => void | Promise<void>): Promise<void>;
    /**
     * Remove a request event listener from the current page
     */
    off_request(callback: (request: any) => void | Promise<void>): Promise<void>;
    /**
     * Remove a response event listener from the current page
     */
    off_response(callback: (response: any) => void | Promise<void>): Promise<void>;
    /**
     * Get information about all open tabs
     * @returns Array of tab information including page_id, tab_id, url, and title
     */
    get_tabs_info(): Promise<Array<{
        page_id: number;
        tab_id: string;
        url: string;
        title: string;
    }>>;
    /**
     * Check if a page is responsive by trying to evaluate simple JavaScript
     * @param page - The page to check
     * @param timeout - Timeout in seconds (default: 5)
     * @returns True if page is responsive, false otherwise
     */
    _is_page_responsive(page: any, timeout?: number): Promise<boolean>;
    /**
     * Get scroll information for the current page
     * @returns Object with scroll position and page dimensions
     */
    get_scroll_info(): Promise<{
        scroll_x: number;
        scroll_y: number;
        page_width: number;
        page_height: number;
        viewport_width: number;
        viewport_height: number;
    }>;
    /**
     * Get a summary of the current browser state
     * @param cache_clickable_elements_hashes - Cache clickable element hashes to detect new elements
     * @param include_screenshot - Include screenshot in state summary
     * @returns BrowserStateSummary with current page state
     */
    get_state_summary(cache_clickable_elements_hashes?: boolean, include_screenshot?: boolean, include_recent_events?: boolean): Promise<BrowserStateSummary>;
    /**
     * Get minimal state summary without DOM processing, but with screenshot
     * Used when page is in error state or unresponsive
     */
    get_minimal_state_summary(include_recent_events?: boolean): Promise<BrowserStateSummary>;
    /**
     * Internal method to get updated browser state with DOM processing
     * @param focus_element - Element index to focus on (default: -1)
     * @param include_screenshot - Whether to include screenshot
     */
    private _get_updated_state;
    /**
     * Check if a URL is a new tab page
     */
    private _is_new_tab_page;
    private _is_ip_address_host;
    private _get_domain_variants;
    private _setEntryMatchesUrl;
    /**
     * Check if page is displaying a PDF
     */
    private _is_pdf_viewer;
    /**
     * Auto-download PDF if detected and auto-download is enabled
     */
    private _auto_download_pdf_if_needed;
    /**
     * Check if an element is visible on the page
     */
    private _is_visible;
    /**
     * Locate an element by XPath
     */
    get_locate_element_by_xpath(xpath: string): Promise<any>;
    /**
     * Locate an element by CSS selector
     */
    get_locate_element_by_css_selector(css_selector: string): Promise<any>;
    /**
     * Locate an element by text content
     * @param text - Text to search for
     * @param nth - Which matching element to return (0-based index)
     * @param element_type - Optional tag name to filter by (e.g., 'button', 'span')
     */
    get_locate_element_by_text(text: string, nth?: number, element_type?: string | null): Promise<any>;
    /**
     * Check if browser session is connected and has valid browser/context objects
     * @param restart - If true, attempt to create a new tab if no pages exist
     */
    is_connected(restart?: boolean): Promise<boolean>;
    /**
     * Check if a URL is allowed based on allowed_domains configuration
     * @param url - URL to check
     */
    private _get_url_access_denial_reason;
    private _is_url_allowed;
    private _formatDomainCollection;
    private _assert_url_allowed;
    /**
     * Navigate helper with URL validation
     */
    navigate(url: string): Promise<void>;
    /**
     * Kill the browser session (force close even if keep_alive=true)
     */
    kill(): Promise<void>;
    /**
     * Alias for close() to match Python API
     */
    stop(): Promise<void>;
    /**
     * Perform a click action with download and navigation handling
     * @param element_node - DOM element to click
     */
    perform_click(element_node: DOMElementNode): Promise<string | null>;
    /**
     * Remove all highlights from the current page
     */
    remove_highlights(): Promise<void>;
    /**
     * Start tracing on browser context if traces_dir is configured
     * Note: Currently optional as it may cause performance issues in some cases
     */
    start_trace_recording(): Promise<void>;
    /**
     * Save browser trace recording if active
     */
    save_trace_recording(): Promise<void>;
    /**
     * Start tracing on browser context if traces_dir is configured
     * Note: Currently optional as it may cause performance issues in some cases
     */
    private _startContextTracing;
    /**
     * Save browser trace recording
     */
    private _saveTraceRecording;
    /**
     * Scroll using CDP Input.synthesizeScrollGesture for universal compatibility
     * @param page - The page to scroll
     * @param pixels - Number of pixels to scroll (positive = up, negative = down)
     * @returns true if successful, false if failed
     */
    private _scrollWithCdpGesture;
    /**
     * Scroll the current page container
     * @param pixels - Number of pixels to scroll (positive = up, negative = down)
     */
    private _scrollContainer;
    /**
     * Compute hashes for all clickable elements in the selector map
     * @param selectorMap - Selector map from DOM state
     * @returns Set of element hashes
     */
    private _computeElementHashes;
    /**
     * Mark elements in the selector map as new if they weren't in the cached hashes
     * @param selectorMap - Selector map to update
     * @param cachedHashes - Previously cached element hashes
     */
    private _markNewElements;
    /**
     * Helper to get a safe method name from the calling context
     * Used for recovery error messages
     */
    private _getCurrentMethodName;
    /**
     * Get current page with fallback logic
     * Alias for compatibility with Python API
     */
    getCurrentPage(): Promise<Page | null>;
    /**
     * Log warning about unsafe glob patterns
     * @param pattern - The glob pattern being used
     */
    private _logGlobWarning;
    /**
     * Create a shallow copy of the browser session
     * Note: This doesn't copy the actual browser instance, just the session metadata
     * @returns A new BrowserSession instance with copied state
     */
    modelCopy(): BrowserSession;
    model_copy(): BrowserSession;
    private _inRecovery;
    /**
     * Check if a page is responsive by trying to evaluate simple JavaScript
     * @param page - The page to check
     * @param timeout - Timeout in seconds (default: 5.0)
     * @returns true if page is responsive, false otherwise
     */
    private _isPageResponsive;
    /**
     * Force close a crashed page using CDP from a clean temporary page
     * @param pageUrl - The URL of the page to force close
     * @returns true if successful, false otherwise
     */
    private _forceClosePageViaCdp;
    /**
     * Try to reopen a URL in a new page and check if it's responsive
     * @param url - The URL to reopen
     * @param timeoutMs - Navigation timeout in milliseconds
     * @returns true if successful and responsive, false otherwise
     */
    private _tryReopenUrl;
    /**
     * Create a new blank page as a fallback when recovery fails
     * @param url - The original URL that failed
     */
    private _createBlankFallbackPage;
    /**
     * Recover from an unresponsive page by closing and reopening it
     * @param callingMethod - The name of the method that detected the unresponsive page
     * @param timeoutMs - Navigation timeout in milliseconds
     */
    private _recoverUnresponsivePage;
    /**
     * Generate enhanced CSS selector for an element
     * Handles special characters and provides fallback strategies
     * @param xpath - XPath of the element
     * @param element - Optional element node for additional context
     * @returns Enhanced CSS selector string
     */
    private _enhancedCssSelectorForElement;
    /**
     * Convert XPath to CSS selector
     * Handles simple XPath expressions
     */
    private _xpathToCss;
    /**
     * Escape special characters in CSS selectors
     * Handles characters that need escaping in CSS
     */
    private _escapeSelector;
    /**
     * Prepare user data directory for browser profile
     * Handles singleton lock conflicts and creates temp profiles if needed
     */
    prepareUserDataDir(userDataDir?: string): Promise<string>;
    /**
     * Check if user data directory has a singleton lock
     * This happens when another Chrome instance is using the profile
     */
    private _checkForSingletonLockConflict;
    /**
     * Fallback to a temporary profile when the primary one is locked
     */
    private _fallbackToTempProfile;
    /**
     * Create a temporary user data directory
     */
    private _createTempUserDataDir;
    /**
     * Setup listeners for page visibility changes
     * Tracks when user switches tabs to update human_current_page
     */
    private _setupCurrentPageChangeListeners;
    /**
     * Callback when tab visibility changes
     * Updates human_current_page to reflect which tab the user is viewing
     */
    private _onTabVisibilityChange;
    /**
     * Normalize pid values before issuing process operations.
     */
    private _normalizePid;
    /**
     * Kill all child processes spawned by this browser session
     */
    private _killChildProcesses;
    /**
     * Terminate the browser process and all its children
     */
    private _terminateBrowserProcess;
    /**
     * Get child processes of a given PID
     * Cross-platform implementation using ps on Unix-like systems and WMIC on Windows
     */
    private _getChildProcesses;
    /**
     * Track a child process
     */
    private _trackChildProcess;
    /**
     * Untrack a child process
     */
    private _untrackChildProcess;
    /**
     * Show DVD screensaver loading animation
     * Returns a function to stop the animation
     *
     * @param message - Message to display (default: 'Loading...')
     * @param fps - Frames per second (default: 10)
     * @returns Function to stop the animation
     *
     * @example
     * const stopAnimation = this._showDvdScreensaverLoadingAnimation('Loading page...');
     * await someLongOperation();
     * stopAnimation();
     */
    _showDvdScreensaverLoadingAnimation(message?: string, fps?: number): () => void;
    /**
     * Show simple spinner loading animation
     * Returns a function to stop the animation
     *
     * @param message - Message to display (default: 'Loading...')
     * @param fps - Frames per second (default: 10)
     * @returns Function to stop the animation
     *
     * @example
     * const stopSpinner = this._showSpinnerLoadingAnimation('Processing...');
     * await someLongOperation();
     * stopSpinner();
     */
    _showSpinnerLoadingAnimation(message?: string, fps?: number): () => void;
    /**
     * Execute an async operation with DVD screensaver animation
     *
     * @param operation - Async operation to execute
     * @param message - Message to display during operation
     * @returns Result of the operation
     *
     * @example
     * const page = await this._withDvdScreensaver(
     *   async () => await this.browser_context!.newPage(),
     *   'Opening new page...'
     * );
     */
    _withDvdScreensaver<T>(operation: () => Promise<T>, message?: string): Promise<T>;
}
export { DEFAULT_BROWSER_PROFILE };
