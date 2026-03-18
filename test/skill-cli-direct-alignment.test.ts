import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  clear_direct_state,
  load_direct_state,
  run_direct_command,
  save_direct_state,
} from '../src/skill-cli/direct.js';

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

describe('skill-cli direct alignment', () => {
  it('launches a local browser on first open and persists direct-mode state', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-use-direct-'));
    const stateFile = path.join(tempDir, 'state.json');
    const stdout = createWritable();
    const stderr = createWritable();
    const navigateSpy = vi.fn(async () => {});
    const session = {
      start: vi.fn(async () => {}),
      navigate_to: navigateSpy,
      get_current_page: vi.fn(async () => ({
        url: () => 'https://example.com',
      })),
      event_bus: { stop: vi.fn(async () => {}) },
      detach_all_watchdogs: vi.fn(),
    };
    const localLauncher = vi.fn(async () => ({
      cdp_url: 'http://127.0.0.1:9222',
      browser_pid: 321,
      user_data_dir: '/tmp/browser-use-direct-profile',
    }));

    try {
      const exitCode = await run_direct_command(['open', 'example.com'], {
        state_file: stateFile,
        stdout: stdout.stream,
        stderr: stderr.stream,
        local_launcher: localLauncher,
        session_factory: () => session as any,
      });

      expect(exitCode).toBe(0);
      expect(localLauncher).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith('https://example.com');
      expect(stdout.read()).toContain('Navigated to: https://example.com');
      expect(stderr.read()).toBe('');
      expect(load_direct_state(stateFile)).toMatchObject({
        mode: 'local',
        cdp_url: 'http://127.0.0.1:9222',
        browser_pid: 321,
        active_url: 'https://example.com',
      });
    } finally {
      clear_direct_state(stateFile);
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('reuses saved direct-mode state for click-by-index commands', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-use-direct-'));
    const stateFile = path.join(tempDir, 'state.json');
    const stdout = createWritable();
    const stderr = createWritable();
    const clickSpy = vi.fn(async () => {});
    const localLauncher = vi.fn(async () => ({
      cdp_url: 'http://127.0.0.1:9222',
    }));

    save_direct_state(
      {
        mode: 'local',
        cdp_url: 'http://127.0.0.1:9222',
        active_url: 'https://example.com',
      },
      stateFile
    );

    const session = {
      start: vi.fn(async () => {}),
      tabs: [{ target_id: 'target-1', url: 'https://example.com' }],
      switch_to_tab: vi.fn(async () => {}),
      get_dom_element_by_index: vi.fn(async () => ({ index: 7 })),
      _click_element_node: clickSpy,
      get_current_page: vi.fn(async () => ({
        url: () => 'https://example.com',
      })),
      event_bus: { stop: vi.fn(async () => {}) },
      detach_all_watchdogs: vi.fn(),
    };

    try {
      const exitCode = await run_direct_command(['click', '7'], {
        state_file: stateFile,
        stdout: stdout.stream,
        stderr: stderr.stream,
        local_launcher: localLauncher,
        session_factory: () => session as any,
      });

      expect(exitCode).toBe(0);
      expect(localLauncher).not.toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalledWith({ index: 7 });
      expect(stdout.read()).toContain('Clicked element [7]');
      expect(stderr.read()).toBe('');
    } finally {
      clear_direct_state(stateFile);
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('stops cloud sessions on close and clears persisted state', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-use-direct-'));
    const stateFile = path.join(tempDir, 'state.json');
    const stdout = createWritable();
    const stderr = createWritable();
    const stopBrowserSpy = vi.fn(async () => {});

    save_direct_state(
      {
        mode: 'remote',
        cdp_url: 'wss://cloud.example/devtools/browser/test',
        session_id: 'session-123',
      },
      stateFile
    );

    try {
      const exitCode = await run_direct_command(['close'], {
        state_file: stateFile,
        stdout: stdout.stream,
        stderr: stderr.stream,
        cloud_client_factory: () =>
          ({
            create_browser: vi.fn(),
            stop_browser: stopBrowserSpy,
          }) as any,
      });

      expect(exitCode).toBe(0);
      expect(stopBrowserSpy).toHaveBeenCalledWith('session-123');
      expect(stdout.read()).toContain('Browser closed');
      expect(stderr.read()).toBe('');
      expect(fs.existsSync(stateFile)).toBe(false);
    } finally {
      clear_direct_state(stateFile);
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('supports advanced direct-mode browser controls', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-use-direct-'));
    const stateFile = path.join(tempDir, 'state.json');
    const stdout = createWritable();
    const stderr = createWritable();
    const waitForFunction = vi.fn(async () => {});
    const locator = {
      hover: vi.fn(async () => {}),
      dblclick: vi.fn(async () => {}),
      click: vi.fn(async () => {}),
    };
    const session = {
      start: vi.fn(async () => {}),
      tabs: [{ target_id: 'target-1', url: 'https://example.com' }],
      active_tab: { target_id: 'target-1', url: 'https://example.com' },
      switch_to_tab: vi.fn(async () => {}),
      close_tab: vi.fn(async () => {}),
      go_forward: vi.fn(async () => {}),
      wait_for_element: vi.fn(async () => {}),
      select_dropdown_option: vi.fn(async () => ['Option A']),
      get_dom_element_by_index: vi.fn(async () => ({ index: 4 })),
      get_locate_element: vi.fn(async () => locator),
      get_current_page: vi.fn(async () => ({
        url: () => 'https://example.com',
        waitForFunction,
      })),
      event_bus: { stop: vi.fn(async () => {}) },
      detach_all_watchdogs: vi.fn(),
    };

    save_direct_state(
      {
        mode: 'local',
        cdp_url: 'http://127.0.0.1:9222',
        active_url: 'https://example.com',
      },
      stateFile
    );

    try {
      expect(
        await run_direct_command(['forward'], {
          state_file: stateFile,
          stdout: stdout.stream,
          stderr: stderr.stream,
          session_factory: () => session as any,
        })
      ).toBe(0);
      expect(
        await run_direct_command(['switch', '1'], {
          state_file: stateFile,
          stdout: stdout.stream,
          stderr: stderr.stream,
          session_factory: () => session as any,
        })
      ).toBe(0);
      expect(
        await run_direct_command(['close-tab'], {
          state_file: stateFile,
          stdout: stdout.stream,
          stderr: stderr.stream,
          session_factory: () => session as any,
        })
      ).toBe(0);
      expect(
        await run_direct_command(['select', '4', 'Option A'], {
          state_file: stateFile,
          stdout: stdout.stream,
          stderr: stderr.stream,
          session_factory: () => session as any,
        })
      ).toBe(0);
      expect(
        await run_direct_command(['wait', 'selector', '#app', '2500'], {
          state_file: stateFile,
          stdout: stdout.stream,
          stderr: stderr.stream,
          session_factory: () => session as any,
        })
      ).toBe(0);
      expect(
        await run_direct_command(['wait', 'text', 'Ready'], {
          state_file: stateFile,
          stdout: stdout.stream,
          stderr: stderr.stream,
          session_factory: () => session as any,
        })
      ).toBe(0);
      expect(
        await run_direct_command(['hover', '4'], {
          state_file: stateFile,
          stdout: stdout.stream,
          stderr: stderr.stream,
          session_factory: () => session as any,
        })
      ).toBe(0);
      expect(
        await run_direct_command(['dblclick', '4'], {
          state_file: stateFile,
          stdout: stdout.stream,
          stderr: stderr.stream,
          session_factory: () => session as any,
        })
      ).toBe(0);
      expect(
        await run_direct_command(['rightclick', '4'], {
          state_file: stateFile,
          stdout: stdout.stream,
          stderr: stderr.stream,
          session_factory: () => session as any,
        })
      ).toBe(0);

      expect(session.go_forward).toHaveBeenCalledTimes(1);
      expect(session.switch_to_tab).toHaveBeenCalledWith(1);
      expect(session.close_tab).toHaveBeenCalledWith('target-1');
      expect(session.select_dropdown_option).toHaveBeenCalledWith(
        { index: 4 },
        'Option A'
      );
      expect(session.wait_for_element).toHaveBeenCalledWith('#app', 2500);
      expect(waitForFunction).toHaveBeenCalledTimes(1);
      expect(locator.hover).toHaveBeenCalledWith({ timeout: 5000 });
      expect(locator.dblclick).toHaveBeenCalledWith({ timeout: 5000 });
      expect(locator.click).toHaveBeenCalledWith({
        button: 'right',
        timeout: 5000,
      });
      expect(stderr.read()).toBe('');
    } finally {
      clear_direct_state(stateFile);
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
