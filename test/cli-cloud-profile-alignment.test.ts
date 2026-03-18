import { describe, expect, it, vi } from 'vitest';
import { runProfileCommand } from '../src/cli.js';

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

describe('cli cloud profile alignment', () => {
  it('lists and gets local Chrome profiles by default', async () => {
    const stdout = createWritable();
    const stderr = createWritable();
    const profiles = [
      { directory: 'Default', name: 'Personal', email: 'person@example.com' },
      { directory: 'Profile 1', name: 'Work', email: 'work@example.com' },
    ];

    expect(
      await runProfileCommand(['list'], {
        profile_lister: () => profiles,
        stdout: stdout.stream,
        stderr: stderr.stream,
      })
    ).toBe(0);
    expect(
      await runProfileCommand(['get', 'Profile 1'], {
        profile_lister: () => profiles,
        stdout: stdout.stream,
        stderr: stderr.stream,
      })
    ).toBe(0);

    expect(stdout.read()).toContain('Local Chrome profiles:');
    expect(stdout.read()).toContain('Profile 1: Work (work@example.com)');
    expect(stderr.read()).toBe('');
  });

  it('supports remote cloud profile lifecycle commands', async () => {
    const stdout = createWritable();
    const stderr = createWritable();
    const client = {
      list_profiles: vi.fn(async () => ({
        items: [
          {
            id: 'profile-1',
            name: 'Primary',
            createdAt: '2026-03-18T10:00:00Z',
            updatedAt: '2026-03-18T10:00:00Z',
          },
        ],
      })),
      get_profile: vi.fn(async () => ({
        id: 'profile-1',
        name: 'Primary',
        createdAt: '2026-03-18T10:00:00Z',
        updatedAt: '2026-03-18T10:00:00Z',
      })),
      create_profile: vi.fn(async () => ({
        id: 'profile-2',
        name: 'Secondary',
        createdAt: '2026-03-18T10:00:00Z',
        updatedAt: '2026-03-18T10:00:00Z',
      })),
      update_profile: vi.fn(async () => ({
        id: 'profile-2',
        name: 'Renamed',
        createdAt: '2026-03-18T10:00:00Z',
        updatedAt: '2026-03-18T10:05:00Z',
      })),
      delete_profile: vi.fn(async () => {}),
    };

    expect(
      await runProfileCommand(['list', '--remote'], {
        client: client as any,
        stdout: stdout.stream,
        stderr: stderr.stream,
      })
    ).toBe(0);
    expect(
      await runProfileCommand(['get', 'profile-1', '--remote'], {
        client: client as any,
        stdout: stdout.stream,
        stderr: stderr.stream,
      })
    ).toBe(0);
    expect(
      await runProfileCommand(['create', '--remote', '--name', 'Secondary'], {
        client: client as any,
        stdout: stdout.stream,
        stderr: stderr.stream,
      })
    ).toBe(0);
    expect(
      await runProfileCommand(
        ['update', 'profile-2', '--remote', '--name', 'Renamed'],
        {
          client: client as any,
          stdout: stdout.stream,
          stderr: stderr.stream,
        }
      )
    ).toBe(0);
    expect(
      await runProfileCommand(['delete', 'profile-2', '--remote'], {
        client: client as any,
        stdout: stdout.stream,
        stderr: stderr.stream,
      })
    ).toBe(0);

    expect(client.list_profiles).toHaveBeenCalledWith({ pageSize: 20 });
    expect(client.create_profile).toHaveBeenCalledWith({ name: 'Secondary' });
    expect(client.update_profile).toHaveBeenCalledWith('profile-2', {
      name: 'Renamed',
    });
    expect(client.delete_profile).toHaveBeenCalledWith('profile-2');
    expect(stdout.read()).toContain('Cloud profiles (1):');
    expect(stdout.read()).toContain('Created cloud profile: profile-2');
    expect(stdout.read()).toContain('Updated cloud profile: profile-2');
    expect(stdout.read()).toContain('Deleted cloud profile: profile-2');
    expect(stderr.read()).toBe('');
  });

  it('lists local profile cookies by domain and syncs them to cloud profiles', async () => {
    const stdout = createWritable();
    const stderr = createWritable();
    const profiles = [
      { directory: 'Default', name: 'Personal', email: 'person@example.com' },
    ];
    const localSessionFactory = vi.fn(() => ({
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
      get_cookies: vi.fn(async () => [
        { name: 'sid', value: '1', domain: '.youtube.com', path: '/' },
        { name: 'prefs', value: '2', domain: '.youtube.com', path: '/' },
        { name: 'studio', value: '3', domain: '.studio.youtube.com', path: '/' },
        { name: 'trap', value: '4', domain: '.notyoutube.com', path: '/' },
        { name: 'other', value: '3', domain: '.example.com', path: '/' },
      ]),
    }));
    const remoteAddCookies = vi.fn(async () => {});
    const remoteSessionFactory = vi.fn(() => ({
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
      browser_context: {
        addCookies: remoteAddCookies,
      },
    }));
    const cloudClient = {
      create_browser: vi.fn(async () => ({
        id: 'browser-1',
        cdpUrl: 'wss://cloud.example/devtools/browser/1',
      })),
      stop_browser: vi.fn(async () => {}),
    };
    const client = {
      create_profile: vi.fn(async () => ({
        id: 'profile-cloud-1',
        name: 'Chrome - Personal (youtube.com)',
        createdAt: '2026-03-18T10:00:00Z',
        updatedAt: '2026-03-18T10:00:00Z',
      })),
      delete_profile: vi.fn(async () => {}),
      list_profiles: vi.fn(),
      get_profile: vi.fn(),
      update_profile: vi.fn(),
    };

    expect(
      await runProfileCommand(['cookies', 'Default'], {
        profile_lister: () => profiles,
        local_session_factory: localSessionFactory as any,
        client: client as any,
        stdout: stdout.stream,
        stderr: stderr.stream,
      })
    ).toBe(0);

    expect(
      await runProfileCommand(
        ['sync', '--from', 'Default', '--domain', 'youtube.com', '--json'],
        {
          profile_lister: () => profiles,
          local_session_factory: localSessionFactory as any,
          remote_session_factory: remoteSessionFactory as any,
          cloud_browser_client_factory: () => cloudClient as any,
          client: client as any,
          stdout: stdout.stream,
          stderr: stderr.stream,
        }
      )
    ).toBe(0);

    expect(stdout.read()).toContain('Cookies by domain (5 total):');
    expect(stdout.read()).toContain('youtube.com: 2');
    expect(stdout.read()).toContain('"profile_id": "profile-cloud-1"');
    expect(client.create_profile).toHaveBeenCalledWith({
      name: 'Chrome - Personal (youtube.com)',
    });
    expect(cloudClient.create_browser).toHaveBeenCalledWith({
      profile_id: 'profile-cloud-1',
    });
    expect(remoteAddCookies).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'sid' }),
      expect.objectContaining({ name: 'prefs' }),
      expect.objectContaining({ name: 'studio' }),
    ]);
    expect(remoteAddCookies).not.toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: 'trap' })])
    );
  });

  it('supports inline profile flags and rejects unknown options', async () => {
    const stdout = createWritable();
    const stderr = createWritable();
    const profiles = [
      { directory: 'Default', name: 'Personal', email: 'person@example.com' },
    ];
    const localSessionFactory = vi.fn(() => ({
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
      get_cookies: vi.fn(async () => [
        { name: 'sid', value: '1', domain: '.youtube.com', path: '/' },
      ]),
    }));
    const remoteAddCookies = vi.fn(async () => {});
    const remoteSessionFactory = vi.fn(() => ({
      start: vi.fn(async () => {}),
      stop: vi.fn(async () => {}),
      browser_context: {
        addCookies: remoteAddCookies,
      },
    }));
    const cloudClient = {
      create_browser: vi.fn(async () => ({
        id: 'browser-inline',
        cdpUrl: 'wss://cloud.example/devtools/browser/inline',
      })),
      stop_browser: vi.fn(async () => {}),
    };
    const client = {
      create_profile: vi.fn(async () => ({
        id: 'profile-inline',
        name: 'Chrome - Personal (youtube.com)',
        createdAt: '2026-03-18T10:00:00Z',
        updatedAt: '2026-03-18T10:00:00Z',
      })),
      delete_profile: vi.fn(async () => {}),
      list_profiles: vi.fn(),
      get_profile: vi.fn(),
      update_profile: vi.fn(),
    };

    expect(
      await runProfileCommand(
        ['sync', '--from=Default', '--domain=youtube.com', '--json'],
        {
          profile_lister: () => profiles,
          local_session_factory: localSessionFactory as any,
          remote_session_factory: remoteSessionFactory as any,
          cloud_browser_client_factory: () => cloudClient as any,
          client: client as any,
          stdout: stdout.stream,
          stderr: stderr.stream,
        }
      )
    ).toBe(0);
    expect(client.create_profile).toHaveBeenCalledWith({
      name: 'Chrome - Personal (youtube.com)',
    });
    expect(stdout.read()).toContain('"profile_id": "profile-inline"');

    expect(
      await runProfileCommand(['sync', '--fromm', 'Default'], {
        profile_lister: () => profiles,
        local_session_factory: localSessionFactory as any,
        remote_session_factory: remoteSessionFactory as any,
        cloud_browser_client_factory: () => cloudClient as any,
        client: client as any,
        stdout: stdout.stream,
        stderr: stderr.stream,
      })
    ).toBe(1);
    expect(stderr.read()).toContain('Unknown option: --fromm');
  });

  it('rejects missing profile ids instead of treating flags as ids', async () => {
    const stdout = createWritable();
    const stderr = createWritable();
    const client = {
      list_profiles: vi.fn(),
      get_profile: vi.fn(),
      create_profile: vi.fn(),
      update_profile: vi.fn(),
      delete_profile: vi.fn(),
    };

    expect(
      await runProfileCommand(['get', '--remote'], {
        client: client as any,
        stdout: stdout.stream,
        stderr: stderr.stream,
      })
    ).toBe(1);
    expect(client.get_profile).not.toHaveBeenCalled();
    expect(stderr.read()).toContain(
      'Usage: browser-use profile get <profile-id> [--remote]'
    );
  });

  it('rejects unexpected extra profile arguments', async () => {
    const stdout = createWritable();
    const stderr = createWritable();
    const profiles = [
      { directory: 'Default', name: 'Personal', email: 'person@example.com' },
    ];
    const client = {
      list_profiles: vi.fn(),
      get_profile: vi.fn(),
      create_profile: vi.fn(),
      update_profile: vi.fn(),
      delete_profile: vi.fn(),
    };

    expect(
      await runProfileCommand(['sync', '--from', 'Default', 'stray'], {
        profile_lister: () => profiles,
        client: client as any,
        stdout: stdout.stream,
        stderr: stderr.stream,
      })
    ).toBe(1);
    expect(client.create_profile).not.toHaveBeenCalled();
    expect(stderr.read()).toContain(
      'Usage: browser-use profile sync --from <profile-id> [--name <name>] [--domain <domain>] [--json]'
    );
  });

  it('rejects known profile flags that do not apply to the selected subcommand', async () => {
    const stdout = createWritable();
    const stderr = createWritable();
    const client = {
      list_profiles: vi.fn(),
      get_profile: vi.fn(),
      create_profile: vi.fn(),
      update_profile: vi.fn(),
      delete_profile: vi.fn(),
    };

    expect(
      await runProfileCommand(['get', 'profile-1', '--name', 'Renamed'], {
        client: client as any,
        stdout: stdout.stream,
        stderr: stderr.stream,
      })
    ).toBe(1);
    expect(client.get_profile).not.toHaveBeenCalled();
    expect(stderr.read()).toContain(
      'Usage: browser-use profile get <profile-id> [--remote]'
    );
  });
});
