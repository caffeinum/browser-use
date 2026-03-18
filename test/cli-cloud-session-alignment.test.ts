import { describe, expect, it, vi } from 'vitest';
import { runSessionCommand } from '../src/cli.js';

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

describe('cli cloud session alignment', () => {
  it('lists and gets sessions', async () => {
    const stdout = createWritable();
    const stderr = createWritable();
    const client = {
      list_sessions: vi.fn(async () => ({
        items: [
          {
            id: 'session-12345678',
            status: 'active',
            startedAt: '2026-03-18T10:00:00Z',
            finishedAt: null,
          },
        ],
      })),
      get_session: vi.fn(async () => ({
        id: 'session-12345678',
        status: 'active',
        startedAt: '2026-03-18T10:00:00Z',
        finishedAt: null,
        liveUrl: 'https://live.browser-use.test/session-1',
      })),
      update_session: vi.fn(),
      create_session: vi.fn(),
      create_session_public_share: vi.fn(),
      delete_session_public_share: vi.fn(),
    };

    expect(
      await runSessionCommand(['list', '--limit', '5'], {
        client: client as any,
        stdout: stdout.stream,
        stderr: stderr.stream,
      })
    ).toBe(0);
    expect(
      await runSessionCommand(['get', 'session-12345678'], {
        client: client as any,
        stdout: stdout.stream,
        stderr: stderr.stream,
      })
    ).toBe(0);

    expect(client.list_sessions).toHaveBeenCalledWith({
      pageSize: 5,
      filterBy: null,
    });
    expect(stdout.read()).toContain('Sessions (1):');
    expect(stdout.read()).toContain('Live URL: https://live.browser-use.test/session-1');
    expect(stderr.read()).toBe('');
  });

  it('supports session stop, create, and share commands', async () => {
    const stdout = createWritable();
    const stderr = createWritable();
    const client = {
      list_sessions: vi.fn(async () => ({
        items: [
          { id: 'session-a', status: 'active', startedAt: '2026-03-18T10:00:00Z' },
          { id: 'session-b', status: 'active', startedAt: '2026-03-18T10:00:00Z' },
        ],
      })),
      get_session: vi.fn(),
      update_session: vi.fn(async () => ({ id: 'session-a' })),
      create_session: vi.fn(async () => ({
        id: 'session-new',
        status: 'active',
        startedAt: '2026-03-18T10:00:00Z',
        liveUrl: 'https://live.browser-use.test/session-new',
      })),
      create_session_public_share: vi.fn(async () => ({
        shareUrl: 'https://share.browser-use.test/session-new',
        shareToken: 'share-token',
        viewCount: 0,
      })),
      delete_session_public_share: vi.fn(async () => {}),
    };

    expect(
      await runSessionCommand(['stop', '--all'], {
        client: client as any,
        stdout: stdout.stream,
        stderr: stderr.stream,
      })
    ).toBe(0);
    expect(
      await runSessionCommand(
        ['create', '--profile', 'profile-1', '--proxy-country', 'us', '--screen-size', '1440x900'],
        {
          client: client as any,
          stdout: stdout.stream,
          stderr: stderr.stream,
        }
      )
    ).toBe(0);
    expect(
      await runSessionCommand(['share', 'session-new'], {
        client: client as any,
        stdout: stdout.stream,
        stderr: stderr.stream,
      })
    ).toBe(0);
    expect(
      await runSessionCommand(['share', 'session-new', '--delete'], {
        client: client as any,
        stdout: stdout.stream,
        stderr: stderr.stream,
      })
    ).toBe(0);

    expect(client.update_session).toHaveBeenCalledTimes(2);
    expect(client.create_session).toHaveBeenCalledWith({
      profileId: 'profile-1',
      proxyCountryCode: 'us',
      startUrl: null,
      browserScreenWidth: 1440,
      browserScreenHeight: 900,
    });
    expect(client.create_session_public_share).toHaveBeenCalledWith(
      'session-new'
    );
    expect(client.delete_session_public_share).toHaveBeenCalledWith(
      'session-new'
    );
    expect(stdout.read()).toContain('Stopped 2 session(s):');
    expect(stdout.read()).toContain('Created session: session-new');
    expect(stdout.read()).toContain('Public share URL: https://share.browser-use.test/session-new');
    expect(stdout.read()).toContain('Deleted public share for session: session-new');
    expect(stderr.read()).toBe('');
  });
});
