#!/usr/bin/env node
import { CloudBrowserClient } from '../browser/cloud/cloud.js';
export interface DirectModeState {
    mode?: 'local' | 'remote';
    cdp_url?: string | null;
    session_id?: string | null;
    browser_pid?: number | null;
    user_data_dir?: string | null;
    owns_user_data_dir?: boolean | null;
    active_url?: string | null;
}
export declare const DIRECT_STATE_FILE: string;
interface StreamLike {
    write(chunk: string): void;
}
interface DirectSessionLike {
    tabs?: Array<{
        target_id?: string | null;
        url?: string | null;
    }>;
    active_tab?: {
        target_id?: string | null;
        url?: string | null;
    } | null;
    event_bus?: {
        stop?: () => Promise<void> | void;
    } | null;
    browser_context?: {
        cookies?: (urls?: string[]) => Promise<any[]>;
        addCookies?: (cookies: any[]) => Promise<unknown>;
        clearCookies?: () => Promise<unknown>;
    } | null;
    detach_all_watchdogs?: () => void;
    start: () => Promise<unknown>;
    navigate_to?: (url: string) => Promise<unknown>;
    get_current_page?: () => Promise<any>;
    get_browser_state_with_recovery?: (options?: {
        include_screenshot?: boolean;
    }) => Promise<{
        llm_representation: () => string;
        url?: string;
        title?: string;
        tabs?: unknown[];
    }>;
    get_page_info?: () => Promise<any>;
    get_dom_element_by_index?: (index: number) => Promise<any>;
    get_locate_element?: (node: any) => Promise<any>;
    _click_element_node?: (node: any) => Promise<unknown>;
    click_coordinates?: (x: number, y: number, options?: {
        button?: 'left' | 'middle' | 'right';
    }) => Promise<unknown>;
    send_keys?: (text: string) => Promise<unknown>;
    _input_text_element_node?: (node: any, text: string, options?: {
        clear?: boolean;
    }) => Promise<unknown>;
    take_screenshot?: (full_page?: boolean) => Promise<string | null>;
    scroll?: (direction: 'up' | 'down' | 'left' | 'right', amount: number) => Promise<unknown>;
    go_back?: () => Promise<unknown>;
    go_forward?: () => Promise<unknown>;
    get_page_html?: () => Promise<string>;
    execute_javascript?: (script: string) => Promise<unknown>;
    switch_to_tab?: (identifier: number | string) => Promise<unknown>;
    close_tab?: (identifier: number | string) => Promise<unknown>;
    select_dropdown_option?: (node: any, value: string) => Promise<unknown>;
    wait_for_element?: (selector: string, timeout: number) => Promise<unknown>;
    get_cookies?: () => Promise<any[]>;
}
export interface DirectCliEnvironment {
    state_file?: string;
    stdout?: StreamLike;
    stderr?: StreamLike;
    session_factory?: (init: {
        cdp_url?: string | null;
    }) => DirectSessionLike;
    cloud_client_factory?: () => Pick<CloudBrowserClient, 'create_browser' | 'stop_browser'>;
    local_launcher?: (options: {
        state: DirectModeState;
    }) => Promise<{
        cdp_url: string;
        browser_pid?: number | null;
        user_data_dir?: string | null;
        owns_user_data_dir?: boolean | null;
    }>;
    kill_process?: (pid: number) => void | Promise<void>;
}
export declare const load_direct_state: (state_file?: string) => DirectModeState;
export declare const save_direct_state: (state: DirectModeState, state_file?: string) => void;
export declare const clear_direct_state: (state_file?: string) => void;
export declare const defaultLocalLauncher: (options: {
    state: DirectModeState;
    timeout_ms?: number;
}) => Promise<{
    cdp_url: string;
    browser_pid: number | null;
    user_data_dir: string | null | undefined;
    owns_user_data_dir: boolean;
}>;
export declare const run_direct_command: (argv: string[], options?: DirectCliEnvironment) => Promise<0 | 1>;
export declare const main: (argv?: string[]) => Promise<0 | 1>;
export {};
