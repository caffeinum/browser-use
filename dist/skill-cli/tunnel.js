import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
const TUNNEL_URL_PATTERN = /(https:\/\/\S+\.trycloudflare\.com)/;
const DEFAULT_TUNNELS_DIR = path.join(os.homedir(), '.browser-use', 'tunnels');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const findSystemBinary = (binary) => {
    const command = process.platform === 'win32' ? 'where' : 'which';
    const result = spawnSync(command, [binary], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (result.status !== 0) {
        return null;
    }
    return (result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean) ?? null);
};
export class TunnelManager {
    tunnel_dir;
    binary_resolver;
    spawn_impl;
    sleep_impl;
    is_process_alive_impl;
    kill_process_impl;
    binary_path = null;
    constructor(options = {}) {
        this.tunnel_dir = options.tunnel_dir ?? DEFAULT_TUNNELS_DIR;
        this.binary_resolver = options.binary_resolver ?? findSystemBinary;
        this.spawn_impl = options.spawn_impl ?? spawn;
        this.sleep_impl = options.sleep_impl ?? sleep;
        this.is_process_alive_impl =
            options.is_process_alive ?? default_is_process_alive;
        this.kill_process_impl = options.kill_process ?? default_kill_process;
    }
    get_tunnel_file(port) {
        return path.join(this.tunnel_dir, `${port}.json`);
    }
    get_tunnel_log_file(port) {
        return path.join(this.tunnel_dir, `${port}.log`);
    }
    save_tunnel_info(port, pid, url) {
        fs.mkdirSync(this.tunnel_dir, { recursive: true });
        fs.writeFileSync(this.get_tunnel_file(port), JSON.stringify({ port, pid, url }), 'utf-8');
    }
    load_tunnel_info(port) {
        const filePath = this.get_tunnel_file(port);
        if (!fs.existsSync(filePath)) {
            return null;
        }
        try {
            const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            if (!parsed ||
                typeof parsed.port !== 'number' ||
                typeof parsed.pid !== 'number' ||
                typeof parsed.url !== 'string') {
                fs.rmSync(filePath, { force: true });
                return null;
            }
            if (!this.is_process_alive_impl(parsed.pid)) {
                fs.rmSync(filePath, { force: true });
                fs.rmSync(this.get_tunnel_log_file(port), { force: true });
                return null;
            }
            return {
                port: parsed.port,
                pid: parsed.pid,
                url: parsed.url,
            };
        }
        catch {
            fs.rmSync(filePath, { force: true });
            return null;
        }
    }
    get_binary_path() {
        if (this.binary_path) {
            return this.binary_path;
        }
        const systemBinary = this.binary_resolver('cloudflared');
        if (systemBinary) {
            this.binary_path = systemBinary;
            return systemBinary;
        }
        throw new Error('cloudflared not installed.\n\nInstall cloudflared:\n  macOS:   brew install cloudflared\n  Linux:   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o ~/.local/bin/cloudflared && chmod +x ~/.local/bin/cloudflared\n  Windows: winget install Cloudflare.cloudflared');
    }
    is_available() {
        if (this.binary_path) {
            return true;
        }
        return Boolean(this.binary_resolver('cloudflared'));
    }
    get_status() {
        const systemBinary = this.binary_resolver('cloudflared');
        if (systemBinary) {
            return {
                available: true,
                source: 'system',
                path: systemBinary,
                note: 'cloudflared installed',
            };
        }
        return {
            available: false,
            source: null,
            path: null,
            note: 'cloudflared not installed - install it manually before using tunnel',
        };
    }
    async start_tunnel(port) {
        const existing = this.load_tunnel_info(port);
        if (existing) {
            return { url: existing.url, port, existing: true };
        }
        let binaryPath;
        try {
            binaryPath = this.get_binary_path();
        }
        catch (error) {
            return { error: error.message };
        }
        fs.mkdirSync(this.tunnel_dir, { recursive: true });
        const logPath = this.get_tunnel_log_file(port);
        const logFd = fs.openSync(logPath, 'w');
        try {
            const child = this.spawn_impl(binaryPath, ['tunnel', '--url', `http://localhost:${port}`], {
                detached: true,
                stdio: ['ignore', 'ignore', logFd],
            });
            child.unref?.();
            const deadline = Date.now() + 15_000;
            while (Date.now() < deadline) {
                const pid = child.pid;
                if (typeof pid === 'number' && !this.is_process_alive_impl(pid)) {
                    const content = fs.existsSync(logPath)
                        ? fs.readFileSync(logPath, 'utf-8')
                        : '';
                    return {
                        error: `cloudflared exited unexpectedly: ${content.slice(0, 500)}`,
                    };
                }
                const content = fs.existsSync(logPath)
                    ? fs.readFileSync(logPath, 'utf-8')
                    : '';
                const match = content.match(TUNNEL_URL_PATTERN);
                if (match?.[1] && typeof child.pid === 'number') {
                    this.save_tunnel_info(port, child.pid, match[1]);
                    return { url: match[1], port };
                }
                await this.sleep_impl(200);
            }
            if (typeof child.pid === 'number') {
                await this.kill_process_impl(child.pid);
            }
            return { error: 'Timed out waiting for cloudflare tunnel URL (15s)' };
        }
        finally {
            fs.closeSync(logFd);
        }
    }
    list_tunnels() {
        const tunnels = [];
        if (!fs.existsSync(this.tunnel_dir)) {
            return { tunnels, count: 0 };
        }
        for (const entry of fs.readdirSync(this.tunnel_dir)) {
            if (!entry.endsWith('.json')) {
                continue;
            }
            const port = Number.parseInt(path.basename(entry, '.json'), 10);
            if (!Number.isFinite(port)) {
                continue;
            }
            const info = this.load_tunnel_info(port);
            if (info) {
                tunnels.push({ port: info.port, url: info.url });
            }
        }
        return { tunnels, count: tunnels.length };
    }
    async stop_tunnel(port) {
        const info = this.load_tunnel_info(port);
        if (!info) {
            return { error: `No tunnel running on port ${port}` };
        }
        await this.kill_process_impl(info.pid);
        fs.rmSync(this.get_tunnel_file(port), { force: true });
        fs.rmSync(this.get_tunnel_log_file(port), { force: true });
        return {
            stopped: port,
            url: info.url,
        };
    }
    async stop_all_tunnels() {
        const stopped = [];
        if (!fs.existsSync(this.tunnel_dir)) {
            return { stopped, count: 0 };
        }
        for (const entry of fs.readdirSync(this.tunnel_dir)) {
            if (!entry.endsWith('.json')) {
                continue;
            }
            const port = Number.parseInt(path.basename(entry, '.json'), 10);
            if (!Number.isFinite(port)) {
                continue;
            }
            const result = await this.stop_tunnel(port);
            if ('stopped' in result) {
                stopped.push(result.stopped);
            }
        }
        return {
            stopped,
            count: stopped.length,
        };
    }
}
const default_is_process_alive = (pid) => {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
};
const default_kill_process = async (pid) => {
    try {
        process.kill(pid, 'SIGTERM');
    }
    catch {
        return false;
    }
    for (let attempt = 0; attempt < 10; attempt += 1) {
        if (!default_is_process_alive(pid)) {
            return true;
        }
        await sleep(100);
    }
    try {
        process.kill(pid, 'SIGKILL');
        return true;
    }
    catch {
        return false;
    }
};
let tunnel_manager = null;
export const get_tunnel_manager = () => {
    if (!tunnel_manager) {
        tunnel_manager = new TunnelManager();
    }
    return tunnel_manager;
};
