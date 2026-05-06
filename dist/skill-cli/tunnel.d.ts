import { spawn } from 'node:child_process';
export type TunnelStatus = {
    available: boolean;
    source: 'system' | null;
    path: string | null;
    note: string;
};
export type StartTunnelResult = {
    url: string;
    port: number;
    existing?: boolean;
} | {
    error: string;
};
export type ListTunnelsResult = {
    tunnels: Array<{
        port: number;
        url: string;
    }>;
    count: number;
};
export type StopTunnelResult = {
    stopped: number;
    url: string;
} | {
    error: string;
};
export type StopAllTunnelsResult = {
    stopped: number[];
    count: number;
};
export interface TunnelManagerOptions {
    tunnel_dir?: string;
    binary_resolver?: (binary: string) => string | null;
    spawn_impl?: typeof spawn;
    sleep_impl?: (ms: number) => Promise<void>;
    is_process_alive?: (pid: number) => boolean;
    kill_process?: (pid: number) => Promise<boolean>;
}
export declare class TunnelManager {
    private readonly tunnel_dir;
    private readonly binary_resolver;
    private readonly spawn_impl;
    private readonly sleep_impl;
    private readonly is_process_alive_impl;
    private readonly kill_process_impl;
    private binary_path;
    constructor(options?: TunnelManagerOptions);
    private get_tunnel_file;
    private get_tunnel_log_file;
    private save_tunnel_info;
    private load_tunnel_info;
    get_binary_path(): string;
    is_available(): boolean;
    get_status(): TunnelStatus;
    start_tunnel(port: number): Promise<StartTunnelResult>;
    list_tunnels(): ListTunnelsResult;
    stop_tunnel(port: number): Promise<StopTunnelResult>;
    stop_all_tunnels(): Promise<StopAllTunnelsResult>;
}
export declare const get_tunnel_manager: () => TunnelManager;
