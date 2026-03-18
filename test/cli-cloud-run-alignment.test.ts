import { describe, expect, it, vi } from 'vitest';
import { runCloudTaskCommand } from '../src/cli.js';

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

describe('cli cloud run alignment', () => {
  it('starts a remote cloud task without waiting', async () => {
    const stdout = createWritable();
    const stderr = createWritable();
    const client = {
      create_session: vi.fn(async () => ({
        id: 'session-1',
      })),
      create_task: vi.fn(async () => ({
        id: 'task-1',
        sessionId: 'session-1',
      })),
      get_task: vi.fn(),
      update_session: vi.fn(),
    };

    const exitCode = await runCloudTaskCommand(
      [
        '--remote',
        '--profile',
        'profile-1',
        '--proxy-country',
        'us',
        '--llm',
        'gpt-4o',
        'Collect',
        'data',
      ],
      {
        client: client as any,
        stdout: stdout.stream,
        stderr: stderr.stream,
      }
    );

    expect(exitCode).toBe(0);
    expect(client.create_session).toHaveBeenCalledWith({
      profileId: 'profile-1',
      proxyCountryCode: 'us',
      startUrl: null,
    });
    expect(client.create_task).toHaveBeenCalledWith(
      expect.objectContaining({
        task: 'Collect data',
        llm: 'gpt-4o',
        sessionId: 'session-1',
      })
    );
    expect(stdout.read()).toContain('Task started: task-1');
    expect(stderr.read()).toBe('');
  });

  it('parses inline cloud run flag values', async () => {
    const stdout = createWritable();
    const stderr = createWritable();
    const client = {
      create_session: vi.fn(async () => ({
        id: 'session-4',
      })),
      create_task: vi.fn(async () => ({
        id: 'task-4',
        sessionId: 'session-4',
      })),
      get_task: vi.fn(),
      update_session: vi.fn(),
    };

    const exitCode = await runCloudTaskCommand(
      [
        '--remote',
        '--profile=profile-inline',
        '--proxy-country=us',
        '--llm=gpt-4o',
        'Collect',
        'inline',
        'flags',
      ],
      {
        client: client as any,
        stdout: stdout.stream,
        stderr: stderr.stream,
      }
    );

    expect(exitCode).toBe(0);
    expect(client.create_session).toHaveBeenCalledWith({
      profileId: 'profile-inline',
      proxyCountryCode: 'us',
      startUrl: null,
    });
    expect(client.create_task).toHaveBeenCalledWith(
      expect.objectContaining({
        task: 'Collect inline flags',
        llm: 'gpt-4o',
        sessionId: 'session-4',
      })
    );
    expect(stdout.read()).toContain('Task started: task-4');
    expect(stderr.read()).toBe('');
  });

  it('waits for task completion and streams status changes', async () => {
    const stdout = createWritable();
    const stderr = createWritable();
    const client = {
      create_session: vi.fn(),
      create_task: vi.fn(async () => ({
        id: 'task-2',
        sessionId: 'session-2',
      })),
      get_task: vi
        .fn()
        .mockResolvedValueOnce({
          id: 'task-2',
          status: 'started',
          output: null,
        })
        .mockResolvedValueOnce({
          id: 'task-2',
          status: 'finished',
          output: 'done',
        }),
      update_session: vi.fn(),
    };

    const exitCode = await runCloudTaskCommand(
      ['--remote', '--wait', '--stream', 'Finish', 'task'],
      {
        client: client as any,
        stdout: stdout.stream,
        stderr: stderr.stream,
        sleep_impl: async () => {},
      }
    );

    expect(exitCode).toBe(0);
    expect(client.get_task).toHaveBeenCalledTimes(2);
    expect(stdout.read()).toContain('Status: started');
    expect(stdout.read()).toContain('Task finished: task-2');
    expect(stdout.read()).toContain('done');
    expect(stderr.read()).toBe('');
  });

  it('returns a non-zero exit code when the remote task fails', async () => {
    const stdout = createWritable();
    const stderr = createWritable();
    const client = {
      create_session: vi.fn(),
      create_task: vi.fn(async () => ({
        id: 'task-3',
        sessionId: 'session-3',
      })),
      get_task: vi.fn(async () => ({
        id: 'task-3',
        status: 'failed',
        output: 'boom',
      })),
      update_session: vi.fn(),
    };

    const exitCode = await runCloudTaskCommand(
      ['--remote', '--wait', 'Fail', 'task'],
      {
        client: client as any,
        stdout: stdout.stream,
        stderr: stderr.stream,
        sleep_impl: async () => {},
      }
    );

    expect(exitCode).toBe(1);
    expect(stdout.read()).toContain('Task failed: task-3');
    expect(stdout.read()).toContain('boom');
    expect(stderr.read()).toBe('');
  });

  it('stops auto-created sessions when task creation fails', async () => {
    const stdout = createWritable();
    const stderr = createWritable();
    const client = {
      create_session: vi.fn(async () => ({
        id: 'session-cleanup',
      })),
      create_task: vi.fn(async () => {
        throw new Error('create task failed');
      }),
      get_task: vi.fn(),
      update_session: vi.fn(async () => ({
        id: 'session-cleanup',
        status: 'stopped',
      })),
    };

    const exitCode = await runCloudTaskCommand(
      ['--remote', '--profile', 'profile-1', 'Broken', 'task'],
      {
        client: client as any,
        stdout: stdout.stream,
        stderr: stderr.stream,
      }
    );

    expect(exitCode).toBe(1);
    expect(client.update_session).toHaveBeenCalledWith(
      'session-cleanup',
      'stop'
    );
    expect(stderr.read()).toContain('create task failed');
  });

  it('rejects unknown cloud run flags', async () => {
    const stdout = createWritable();
    const stderr = createWritable();
    const client = {
      create_session: vi.fn(),
      create_task: vi.fn(),
      get_task: vi.fn(),
      update_session: vi.fn(),
    };

    const exitCode = await runCloudTaskCommand(
      ['--remote', '--waait', 'Collect', 'data'],
      {
        client: client as any,
        stdout: stdout.stream,
        stderr: stderr.stream,
      }
    );

    expect(exitCode).toBe(1);
    expect(client.create_task).not.toHaveBeenCalled();
    expect(stderr.read()).toContain('Unknown option: --waait');
  });

  it('requires an explicit --remote flag before creating cloud tasks', async () => {
    const stdout = createWritable();
    const stderr = createWritable();
    const client = {
      create_session: vi.fn(),
      create_task: vi.fn(),
      get_task: vi.fn(),
      update_session: vi.fn(),
    };

    const exitCode = await runCloudTaskCommand(['--wait', 'Finish', 'task'], {
      client: client as any,
      stdout: stdout.stream,
      stderr: stderr.stream,
    });

    expect(exitCode).toBe(1);
    expect(client.create_task).not.toHaveBeenCalled();
    expect(stderr.read()).toContain('Usage: browser-use run --remote <task>');
  });

  it('rejects missing values instead of consuming the next cloud flag', async () => {
    const stdout = createWritable();
    const stderr = createWritable();
    const client = {
      create_session: vi.fn(),
      create_task: vi.fn(),
      get_task: vi.fn(),
      update_session: vi.fn(),
    };

    const exitCode = await runCloudTaskCommand(
      ['--remote', '--llm', '--wait', 'Finish', 'task'],
      {
        client: client as any,
        stdout: stdout.stream,
        stderr: stderr.stream,
      }
    );

    expect(exitCode).toBe(1);
    expect(client.create_task).not.toHaveBeenCalled();
    expect(stderr.read()).toContain('Missing value for option: --llm');
  });

  it('rejects malformed metadata pairs instead of dropping them silently', async () => {
    const stdout = createWritable();
    const stderr = createWritable();
    const client = {
      create_session: vi.fn(),
      create_task: vi.fn(),
      get_task: vi.fn(),
      update_session: vi.fn(),
    };

    const exitCode = await runCloudTaskCommand(
      ['--remote', '--metadata', 'trace_id', 'Collect', 'data'],
      {
        client: client as any,
        stdout: stdout.stream,
        stderr: stderr.stream,
      }
    );

    expect(exitCode).toBe(1);
    expect(client.create_task).not.toHaveBeenCalled();
    expect(stderr.read()).toContain(
      'Invalid value for --metadata: expected KEY=VALUE'
    );
  });

  it('allows task text that starts with dashes after --', async () => {
    const stdout = createWritable();
    const stderr = createWritable();
    const client = {
      create_session: vi.fn(),
      create_task: vi.fn(async () => ({
        id: 'task-dash',
        sessionId: null,
      })),
      get_task: vi.fn(),
      update_session: vi.fn(),
    };

    const exitCode = await runCloudTaskCommand(
      ['--remote', '--', '--wait', 'for', 'selector'],
      {
        client: client as any,
        stdout: stdout.stream,
        stderr: stderr.stream,
      }
    );

    expect(exitCode).toBe(0);
    expect(client.create_task).toHaveBeenCalledWith(
      expect.objectContaining({
        task: '--wait for selector',
      })
    );
    expect(stdout.read()).toContain('Task started: task-dash');
    expect(stderr.read()).toBe('');
  });
});
