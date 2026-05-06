#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { BrowserProfile } from './browser/profile.js';
import { CloudBrowserClient } from './browser/cloud/cloud.js';
import { CloudManagementClient } from './browser/cloud/management.js';
import type { BaseChatModel } from './llm/base.js';
import { get_tunnel_manager } from './skill-cli/tunnel.js';
type CliModelProvider = 'openai' | 'anthropic' | 'google' | 'deepseek' | 'groq' | 'openrouter' | 'azure' | 'mistral' | 'cerebras' | 'vercel' | 'oci' | 'aws-anthropic' | 'aws' | 'ollama' | 'browser-use';
export interface ParsedCliArgs {
    help: boolean;
    version: boolean;
    debug: boolean;
    headless: boolean | null;
    window_width: number | null;
    window_height: number | null;
    user_data_dir: string | null;
    profile_directory: string | null;
    allowed_domains: string[] | null;
    proxy_url: string | null;
    no_proxy: string | null;
    proxy_username: string | null;
    proxy_password: string | null;
    cdp_url: string | null;
    model: string | null;
    provider: CliModelProvider | null;
    prompt: string | null;
    mcp: boolean;
    json: boolean;
    yes: boolean;
    setup_mode: string | null;
    api_key: string | null;
    positional: string[];
}
export declare const CLI_HISTORY_LIMIT = 100;
export declare const parseCliArgs: (argv: string[]) => ParsedCliArgs;
export declare const isInteractiveExitCommand: (value: string) => boolean;
export declare const isInteractiveHelpCommand: (value: string) => boolean;
export declare const normalizeCliHistory: (history: unknown[], maxLength?: number) => string[];
export declare const getCliHistoryPath: (configDir?: string | null) => string;
export declare const loadCliHistory: (historyPath?: string) => Promise<string[]>;
export declare const saveCliHistory: (history: string[], historyPath?: string) => Promise<void>;
export declare const shouldStartInteractiveMode: (task: string | null, options?: {
    forceInteractive?: boolean;
    inputIsTTY?: boolean;
    outputIsTTY?: boolean;
}) => boolean;
export declare const getLlmFromCliArgs: (args: ParsedCliArgs) => BaseChatModel;
export declare const buildBrowserProfileFromCliArgs: (args: ParsedCliArgs) => BrowserProfile | null;
export declare const getCliUsage: () => string;
export interface RunInstallCommandOptions {
    playwright_cli_path?: string;
    spawn_impl?: typeof spawnSync;
}
type WritableLike = {
    write(chunk: string): unknown;
};
export interface RunTunnelCommandOptions {
    manager?: Pick<ReturnType<typeof get_tunnel_manager>, 'start_tunnel' | 'list_tunnels' | 'stop_tunnel' | 'stop_all_tunnels'>;
    stdout?: WritableLike;
    stderr?: WritableLike;
    json_output?: boolean;
}
export interface RunSetupCommandOptions {
    run_doctor_checks?: (options?: RunDoctorChecksOptions) => Promise<CliDoctorReport>;
    install_command?: () => void | Promise<void>;
    save_api_key?: (api_key: string) => void;
    stdout?: WritableLike;
    stderr?: WritableLike;
    json_output?: boolean;
}
export interface RunTaskCommandOptions {
    client?: Pick<CloudManagementClient, 'list_tasks' | 'get_task' | 'update_task' | 'get_task_logs'>;
    stdout?: WritableLike;
    stderr?: WritableLike;
}
export interface RunSessionCommandOptions {
    client?: Pick<CloudManagementClient, 'list_sessions' | 'get_session' | 'update_session' | 'create_session' | 'create_session_public_share' | 'delete_session_public_share'>;
    stdout?: WritableLike;
    stderr?: WritableLike;
}
export interface RunProfileCommandOptions {
    client?: Pick<CloudManagementClient, 'list_profiles' | 'get_profile' | 'create_profile' | 'update_profile' | 'delete_profile'>;
    profile_lister?: () => Array<{
        directory: string;
        name: string;
        email?: string;
    }>;
    local_session_factory?: (profile_directory: string) => {
        start: () => Promise<unknown>;
        stop?: () => Promise<void>;
        get_cookies?: () => Promise<BrowserCookieInit[]>;
    };
    remote_session_factory?: (init: {
        cdp_url: string;
    }) => {
        start: () => Promise<unknown>;
        stop?: () => Promise<void>;
        browser_context?: {
            addCookies?: (cookies: BrowserCookieInit[]) => Promise<unknown>;
        } | null;
    };
    cloud_browser_client_factory?: () => Pick<CloudBrowserClient, 'create_browser' | 'stop_browser'>;
    stdout?: WritableLike;
    stderr?: WritableLike;
}
export interface RunCloudTaskCommandOptions {
    client?: Pick<CloudManagementClient, 'create_task' | 'create_session' | 'get_task' | 'update_session'>;
    stdout?: WritableLike;
    stderr?: WritableLike;
    sleep_impl?: (ms: number) => Promise<void>;
}
type BrowserCookieInit = {
    name: string;
    value: string;
    url?: string;
    domain?: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
    partitionKey?: string;
};
export declare const runInstallCommand: (options?: RunInstallCommandOptions) => void;
export declare const runTunnelCommand: (argv: string[], options?: RunTunnelCommandOptions) => Promise<0 | 1>;
export declare const runSetupCommand: (params: {
    mode?: string | null;
    yes?: boolean;
    api_key?: string | null;
}, options?: RunSetupCommandOptions) => Promise<number>;
export declare const runTaskCommand: (argv: string[], options?: RunTaskCommandOptions) => Promise<0 | 1>;
export declare const runSessionCommand: (argv: string[], options?: RunSessionCommandOptions) => Promise<0 | 1>;
export declare const runProfileCommand: (argv: string[], options?: RunProfileCommandOptions) => Promise<0 | 1>;
export declare const hasCloudRunFlags: (argv: string[]) => boolean;
type PrefixedSubcommand = {
    command: 'run' | 'task' | 'session' | 'profile';
    argv: string[];
    debug: boolean;
    forwardedArgs: string[];
};
export declare const extractPrefixedSubcommand: (argv: string[]) => PrefixedSubcommand | null;
export declare const runCloudTaskCommand: (argv: string[], options?: RunCloudTaskCommandOptions) => Promise<0 | 1>;
export interface CliDoctorCheck {
    status: 'ok' | 'warning' | 'missing' | 'error';
    message: string;
    note?: string;
    fix?: string;
}
export interface CliDoctorReport {
    status: 'healthy' | 'issues_found';
    checks: Record<string, CliDoctorCheck>;
    summary: string;
}
export interface RunDoctorChecksOptions {
    version?: string;
    browser_executable?: string | null;
    api_key?: string | null;
    cloudflared_path?: string | null;
    fetch_impl?: typeof fetch;
}
export declare const runDoctorChecks: (options?: RunDoctorChecksOptions) => Promise<CliDoctorReport>;
export declare function main(argv?: string[]): Promise<void>;
export {};
