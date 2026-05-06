export declare const is_running_in_docker: () => boolean;
declare class OldConfig {
    private _dirs_created;
    get BROWSER_USE_LOGGING_LEVEL(): string;
    get ANONYMIZED_TELEMETRY(): boolean;
    get BROWSER_USE_CLOUD_SYNC(): boolean;
    get BROWSER_USE_CLOUD_API_URL(): string;
    get BROWSER_USE_CLOUD_UI_URL(): string;
    get BROWSER_USE_DEBUG_LOG_FILE(): string | null;
    get BROWSER_USE_INFO_LOG_FILE(): string | null;
    get XDG_CACHE_HOME(): string;
    get XDG_CONFIG_HOME(): string;
    get BROWSER_USE_CONFIG_DIR(): string;
    get BROWSER_USE_CONFIG_FILE(): string;
    get BROWSER_USE_PROFILES_DIR(): string;
    get BROWSER_USE_DEFAULT_USER_DATA_DIR(): string;
    get BROWSER_USE_EXTENSIONS_DIR(): string;
    get OPENAI_API_KEY(): string;
    get ANTHROPIC_API_KEY(): string;
    get GOOGLE_API_KEY(): string;
    get DEEPSEEK_API_KEY(): string;
    get GROQ_API_KEY(): string;
    get GROK_API_KEY(): string;
    get NOVITA_API_KEY(): string;
    get AZURE_OPENAI_ENDPOINT(): string;
    get AZURE_OPENAI_KEY(): string;
    get SKIP_LLM_API_KEY_VERIFICATION(): boolean;
    get DEFAULT_LLM(): string;
    get IN_DOCKER(): boolean;
    get IS_IN_EVALS(): boolean;
    get BROWSER_USE_VERSION_CHECK(): boolean;
    get WIN_FONT_DIR(): string;
    _ensure_dirs(base_dir?: string): void;
}
declare class FlatEnvConfig {
    get BROWSER_USE_LOGGING_LEVEL(): string;
    get ANONYMIZED_TELEMETRY(): boolean;
    get BROWSER_USE_CLOUD_SYNC(): boolean | null;
    get BROWSER_USE_CLOUD_API_URL(): string;
    get BROWSER_USE_CLOUD_UI_URL(): string;
    get BROWSER_USE_DEBUG_LOG_FILE(): string | null;
    get BROWSER_USE_INFO_LOG_FILE(): string | null;
    get XDG_CACHE_HOME(): string;
    get XDG_CONFIG_HOME(): string;
    get BROWSER_USE_CONFIG_DIR(): string | null;
    get OPENAI_API_KEY(): string;
    get ANTHROPIC_API_KEY(): string;
    get GOOGLE_API_KEY(): string;
    get DEEPSEEK_API_KEY(): string;
    get GROQ_API_KEY(): string;
    get GROK_API_KEY(): string;
    get NOVITA_API_KEY(): string;
    get AZURE_OPENAI_ENDPOINT(): string;
    get AZURE_OPENAI_KEY(): string;
    get SKIP_LLM_API_KEY_VERIFICATION(): boolean;
    get DEFAULT_LLM(): string;
    get IN_DOCKER(): boolean | null;
    get IS_IN_EVALS(): boolean;
    get BROWSER_USE_VERSION_CHECK(): boolean;
    get WIN_FONT_DIR(): string;
    get BROWSER_USE_CONFIG_PATH(): string | null;
    get BROWSER_USE_HEADLESS(): boolean | null;
    get BROWSER_USE_ALLOWED_DOMAINS(): string | null;
    get BROWSER_USE_LLM_MODEL(): string | null;
    get BROWSER_USE_PROXY_URL(): string | null;
    get BROWSER_USE_NO_PROXY(): string | null;
    get BROWSER_USE_PROXY_USERNAME(): string | null;
    get BROWSER_USE_PROXY_PASSWORD(): string | null;
    get BROWSER_USE_DISABLE_EXTENSIONS(): boolean | null;
}
interface DBStyleEntry {
    id: string;
    default: boolean;
    created_at: string;
}
export interface BrowserProfileEntry extends DBStyleEntry {
    headless?: boolean | null;
    user_data_dir?: string | null;
    allowed_domains?: string[] | null;
    downloads_path?: string | null;
    [key: string]: unknown;
}
export interface LLMEntry extends DBStyleEntry {
    api_key?: string | null;
    model?: string | null;
    temperature?: number | null;
    max_tokens?: number | null;
}
export interface AgentEntry extends DBStyleEntry {
    max_steps?: number | null;
    use_vision?: boolean | null;
    system_prompt?: string | null;
}
export interface DBStyleConfigJSON {
    browser_profile: Record<string, BrowserProfileEntry>;
    llm: Record<string, LLMEntry>;
    agent: Record<string, AgentEntry>;
}
type RuntimeConfig = {
    browser_profile: Record<string, any>;
    llm: Record<string, any>;
    agent: Record<string, any>;
};
declare class ConfigCore {
    private _get_config_path;
    private _get_db_config;
    private _get_default_entry;
    _get_default_profile(): Record<string, any>;
    _get_default_llm(): Record<string, any>;
    _get_default_agent(): Record<string, any>;
    _load_config(): RuntimeConfig;
    _ensure_dirs(): void;
    load_config(): RuntimeConfig;
    get_default_profile(): Record<string, any>;
    get_default_llm(): Record<string, any>;
    get_default_agent(): Record<string, any>;
}
type ConfigType = ConfigCore & OldConfig & FlatEnvConfig;
export declare const CONFIG: ConfigType;
export declare const load_browser_use_config: () => RuntimeConfig;
export declare const get_default_profile: (config: Record<string, any>) => any;
export declare const get_default_llm: (config: Record<string, any>) => any;
export {};
