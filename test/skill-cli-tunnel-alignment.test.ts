import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runTunnelCommand } from '../src/cli.js';
import { TunnelManager } from '../src/skill-cli/tunnel.js';

const createWritable = () => {
  let buffer = '';
  return {
    stream: {
      write(chunk: string) {
        buffer += chunk;
      },
    },
    read() {
      return buffer;
    },
  };
};

describe('skill-cli tunnel alignment', () => {
  it('routes tunnel CLI lifecycle commands through the manager', async () => {
    const stdout = createWritable();
    const stderr = createWritable();
    const manager = {
      start_tunnel: vi.fn(async () => ({
        port: 3000,
        url: 'https://demo.trycloudflare.com',
      })),
      list_tunnels: vi.fn(() => ({
        tunnels: [{ port: 3000, url: 'https://demo.trycloudflare.com' }],
        count: 1,
      })),
      stop_tunnel: vi.fn(async () => ({
        stopped: 3000,
        url: 'https://demo.trycloudflare.com',
      })),
      stop_all_tunnels: vi.fn(async () => ({
        stopped: [3000],
        count: 1,
      })),
    };

    expect(
      await runTunnelCommand(['3000'], {
        manager,
        stdout: stdout.stream,
        stderr: stderr.stream,
      })
    ).toBe(0);
    expect(
      await runTunnelCommand(['list'], {
        manager,
        stdout: stdout.stream,
        stderr: stderr.stream,
      })
    ).toBe(0);
    expect(
      await runTunnelCommand(['stop', '3000'], {
        manager,
        stdout: stdout.stream,
        stderr: stderr.stream,
      })
    ).toBe(0);
    expect(
      await runTunnelCommand(['stop', '--all'], {
        manager,
        stdout: stdout.stream,
        stderr: stderr.stream,
      })
    ).toBe(0);

    expect(manager.start_tunnel).toHaveBeenCalledWith(3000);
    expect(manager.list_tunnels).toHaveBeenCalledTimes(1);
    expect(manager.stop_tunnel).toHaveBeenCalledWith(3000);
    expect(manager.stop_all_tunnels).toHaveBeenCalledTimes(1);
    expect(stdout.read()).toContain('Tunnel started: http://localhost:3000');
    expect(stdout.read()).toContain('3000: https://demo.trycloudflare.com');
    expect(stdout.read()).toContain('Stopped tunnel on port 3000');
    expect(stdout.read()).toContain('Stopped 1 tunnel(s): 3000');
    expect(stderr.read()).toBe('');
  });

  it('returns JSON output and propagates manager errors', async () => {
    const stdout = createWritable();
    const stderr = createWritable();
    const manager = {
      start_tunnel: vi.fn(async () => ({
        error: 'cloudflared not installed',
      })),
      list_tunnels: vi.fn(() => ({ tunnels: [], count: 0 })),
      stop_tunnel: vi.fn(),
      stop_all_tunnels: vi.fn(),
    };

    expect(
      await runTunnelCommand(['list'], {
        manager,
        stdout: stdout.stream,
        stderr: stderr.stream,
        json_output: true,
      })
    ).toBe(0);
    expect(
      await runTunnelCommand(['8080'], {
        manager,
        stdout: stdout.stream,
        stderr: stderr.stream,
      })
    ).toBe(1);

    expect(stdout.read()).toContain('"count": 0');
    expect(stderr.read()).toContain('cloudflared not installed');
  });

  it('drops stale persisted tunnels when the process is no longer alive', async () => {
    const tunnelDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'browser-use-tunnel-')
    );
    fs.writeFileSync(
      path.join(tunnelDir, '3000.json'),
      JSON.stringify({
        port: 3000,
        pid: 12345,
        url: 'https://stale.trycloudflare.com',
      }),
      'utf-8'
    );

    try {
      const manager = new TunnelManager({
        tunnel_dir: tunnelDir,
        is_process_alive: () => false,
      });
      const result = manager.list_tunnels();

      expect(result).toEqual({ tunnels: [], count: 0 });
      expect(fs.existsSync(path.join(tunnelDir, '3000.json'))).toBe(false);
    } finally {
      fs.rmSync(tunnelDir, { recursive: true, force: true });
    }
  });
});
