import type { ClientCertificate, Geolocation, HttpCredentials, ProxySettings, ViewportSize, StorageState } from './types.js';
export declare const CHROME_DEBUG_PORT = 9242;
export declare const DOMAIN_OPTIMIZATION_THRESHOLD = 100;
export declare const CHROME_DISABLED_COMPONENTS: string[];
export declare const CHROME_HEADLESS_ARGS: string[];
export declare const CHROME_DOCKER_ARGS: string[];
export declare const CHROME_DISABLE_SECURITY_ARGS: string[];
export declare const CHROME_DETERMINISTIC_RENDERING_ARGS: string[];
export declare const CHROME_DEFAULT_ARGS: string[];
export declare const get_display_size: () => ViewportSize | null;
export declare const get_window_adjustments: () => [number, number];
export declare enum ColorScheme {
    LIGHT = "light",
    DARK = "dark",
    NO_PREFERENCE = "no-preference",
    NULL = "null"
}
export declare enum Contrast {
    NO_PREFERENCE = "no-preference",
    MORE = "more",
    NULL = "null"
}
export declare enum ReducedMotion {
    REDUCE = "reduce",
    NO_PREFERENCE = "no-preference",
    NULL = "null"
}
export declare enum ForcedColors {
    ACTIVE = "active",
    NONE = "none",
    NULL = "null"
}
export declare enum ServiceWorkers {
    ALLOW = "allow",
    BLOCK = "block"
}
export declare enum RecordHarContent {
    OMIT = "omit",
    EMBED = "embed",
    ATTACH = "attach"
}
export declare enum RecordHarMode {
    FULL = "full",
    MINIMAL = "minimal"
}
export declare enum BrowserChannel {
    CHROMIUM = "chromium",
    CHROME = "chrome",
    CHROME_BETA = "chrome-beta",
    CHROME_DEV = "chrome-dev",
    CHROME_CANARY = "chrome-canary",
    MSEDGE = "msedge",
    MSEDGE_BETA = "msedge-beta",
    MSEDGE_DEV = "msedge-dev",
    MSEDGE_CANARY = "msedge-canary"
}
export declare const BROWSERUSE_DEFAULT_CHANNEL = BrowserChannel.CHROMIUM;
type Nullable<T> = T | null;
type WindowRect = {
    width: number;
    height: number;
};
export interface BrowserContextArgs {
    accept_downloads: boolean;
    offline: boolean;
    strict_selectors: boolean;
    proxy: Nullable<ProxySettings>;
    permissions: string[];
    bypass_csp: boolean;
    client_certificates: ClientCertificate[];
    extra_http_headers: Record<string, string>;
    http_credentials: Nullable<HttpCredentials>;
    ignore_https_errors: boolean;
    java_script_enabled: boolean;
    base_url: Nullable<string>;
    service_workers: ServiceWorkers;
    user_agent: Nullable<string>;
    screen: Nullable<ViewportSize>;
    viewport: Nullable<ViewportSize>;
    no_viewport: Nullable<boolean>;
    device_scale_factor: Nullable<number>;
    is_mobile: boolean;
    has_touch: boolean;
    locale: Nullable<string>;
    geolocation: Nullable<Geolocation>;
    timezone_id: Nullable<string>;
    color_scheme: ColorScheme;
    contrast: Contrast;
    reduced_motion: ReducedMotion;
    forced_colors: ForcedColors;
    record_har_content: RecordHarContent;
    record_har_mode: RecordHarMode;
    record_har_omit_content: boolean;
    record_har_path: Nullable<string>;
    record_har_url_filter: Nullable<string | RegExp>;
    record_video_dir: Nullable<string>;
    record_video_size: Nullable<ViewportSize>;
}
export interface BrowserConnectArgs {
    headers: Nullable<Record<string, string>>;
    slow_mo: number;
    timeout: number;
}
export interface BrowserLaunchArgs {
    env: Nullable<Record<string, string | number | boolean>>;
    executable_path: Nullable<string>;
    headless: Nullable<boolean>;
    args: string[];
    ignore_default_args: string[] | true;
    channel: Nullable<BrowserChannel>;
    chromium_sandbox: boolean;
    devtools: boolean;
    slow_mo: number;
    timeout: number;
    proxy: Nullable<ProxySettings>;
    downloads_path: Nullable<string>;
    traces_dir: Nullable<string>;
    handle_sighup: boolean;
    handle_sigint: boolean;
    handle_sigterm: boolean;
}
export type BrowserNewContextArgs = BrowserContextArgs & {
    storage_state: Nullable<string | StorageState | Record<string, unknown>>;
};
export type BrowserLaunchPersistentContextArgs = BrowserContextArgs & BrowserLaunchArgs & {
    user_data_dir: Nullable<string>;
};
export interface BrowserProfileSpecificOptions {
    id: string;
    user_data_dir: Nullable<string>;
    storage_state: Nullable<string | StorageState | Record<string, unknown>>;
    stealth: boolean;
    disable_security: boolean;
    deterministic_rendering: boolean;
    allowed_domains: Nullable<string[] | Set<string>>;
    prohibited_domains: Nullable<string[] | Set<string>>;
    block_ip_addresses: boolean;
    keep_alive: Nullable<boolean>;
    enable_default_extensions: boolean;
    captcha_solver: boolean;
    window_size: Nullable<ViewportSize>;
    window_height: Nullable<number>;
    window_width: Nullable<number>;
    window_position: Nullable<WindowRect>;
    default_navigation_timeout: Nullable<number>;
    default_timeout: Nullable<number>;
    minimum_wait_page_load_time: number;
    wait_for_network_idle_page_load_time: number;
    maximum_wait_page_load_time: number;
    wait_between_actions: number;
    include_dynamic_attributes: boolean;
    highlight_elements: boolean;
    viewport_expansion: number;
    profile_directory: string;
    cookies_file: Nullable<string>;
}
export type BrowserProfileOptions = BrowserContextArgs & BrowserLaunchArgs & BrowserConnectArgs & BrowserProfileSpecificOptions;
export declare class BrowserProfile {
    private options;
    constructor(init?: Partial<BrowserProfileOptions>);
    toString(): string;
    describe(): string;
    get config(): BrowserProfileOptions;
    get allowed_domains(): Nullable<string[] | Set<string>>;
    get prohibited_domains(): Nullable<string[] | Set<string>>;
    get block_ip_addresses(): boolean;
    get cookies_file(): Nullable<string>;
    get default_navigation_timeout(): Nullable<number>;
    get downloads_path(): Nullable<string>;
    get highlight_elements(): boolean;
    get keep_alive(): boolean | null;
    set keep_alive(value: boolean | null);
    get maximum_wait_page_load_time(): number;
    get traces_dir(): Nullable<string>;
    get user_data_dir(): Nullable<string>;
    get viewport_expansion(): number;
    get viewport(): Nullable<import("playwright").ViewportSize>;
    get wait_for_network_idle_page_load_time(): number;
    get window_size(): Nullable<import("playwright").ViewportSize>;
    private applyLegacyWindowSize;
    private warnStorageStateUserDataDirConflict;
    private warnUserDataDirNonDefault;
    private warnDeterministicRenderingWeirdness;
    private ensureDefaultDownloadsPath;
    private getDefaultArgsList;
    private getWindowSizeArgs;
    private getWindowPositionArgs;
    private getExtensionArgs;
    private ensureDefaultExtensionsDownloaded;
    private downloadExtension;
    private extractExtension;
    private stripCrxHeader;
    getArgs(): Promise<string[]>;
    detect_display_configuration(): Promise<any>;
    private cloneContextArgs;
    private cloneLaunchArgs;
    kwargs_for_new_context(): BrowserNewContextArgs;
    kwargs_for_connect(): BrowserConnectArgs;
    kwargs_for_launch(): Promise<BrowserLaunchArgs>;
    kwargs_for_launch_persistent_context(): Promise<BrowserLaunchPersistentContextArgs>;
}
export declare const DEFAULT_BROWSER_PROFILE: BrowserProfile;
export {};
