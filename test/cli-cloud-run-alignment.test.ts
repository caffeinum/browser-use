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
});
