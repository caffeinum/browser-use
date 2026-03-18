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
      { directory: 'Default', name: 'Personal' },
      { directory: 'Profile 1', name: 'Work' },
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
    expect(stdout.read()).toContain('Profile 1: Work');
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
      await runProfileCommand(['delete', 'profile-2', '--remote'], {
        client: client as any,
        stdout: stdout.stream,
        stderr: stderr.stream,
      })
    ).toBe(0);

    expect(client.list_profiles).toHaveBeenCalledWith({ pageSize: 20 });
    expect(client.create_profile).toHaveBeenCalledWith({ name: 'Secondary' });
    expect(client.delete_profile).toHaveBeenCalledWith('profile-2');
    expect(stdout.read()).toContain('Cloud profiles (1):');
    expect(stdout.read()).toContain('Created cloud profile: profile-2');
    expect(stdout.read()).toContain('Deleted cloud profile: profile-2');
    expect(stderr.read()).toBe('');
  });
});
