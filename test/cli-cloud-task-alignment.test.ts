import { describe, expect, it, vi } from 'vitest';
import { runTaskCommand } from '../src/cli.js';

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

describe('cli cloud task alignment', () => {
  it('lists tasks with filters and human-readable output', async () => {
    const stdout = createWritable();
    const stderr = createWritable();
    const client = {
      list_tasks: vi.fn(async () => ({
        items: [
          {
            id: 'task-12345678',
            status: 'finished',
            task: 'Collect profile details from the page',
          },
        ],
      })),
      get_task: vi.fn(),
      update_task: vi.fn(),
      get_task_logs: vi.fn(),
    };

    const exitCode = await runTaskCommand(['list', '--limit', '5', '--status', 'finished'], {
      client: client as any,
      stdout: stdout.stream,
      stderr: stderr.stream,
    });

    expect(exitCode).toBe(0);
    expect(client.list_tasks).toHaveBeenCalledWith({
      pageSize: 5,
      filterBy: 'finished',
      sessionId: null,
    });
    expect(stdout.read()).toContain('Tasks (1):');
    expect(stdout.read()).toContain('[finished]');
    expect(stderr.read()).toBe('');
  });

  it('renders task status, stop, and logs commands', async () => {
    const stdout = createWritable();
    const stderr = createWritable();
    const client = {
      list_tasks: vi.fn(),
      get_task: vi.fn(async () => ({
        id: 'task-12345678',
        status: 'finished',
        task: 'Collect profile details from the page',
        startedAt: '2026-03-18T10:00:00Z',
        finishedAt: '2026-03-18T10:00:05Z',
        output: 'done',
        steps: [
          {
            number: 1,
            memory: 'Opened the profile page and confirmed key fields.',
            url: 'https://example.com/profile',
            actions: ['open', 'extract'],
          },
        ],
      })),
      update_task: vi.fn(async () => ({ id: 'task-12345678' })),
      get_task_logs: vi.fn(async () => ({
        downloadUrl: 'https://files.browser-use.test/logs/task-12345678',
      })),
    };

    expect(
      await runTaskCommand(['status', 'task-12345678', '--verbose'], {
        client: client as any,
        stdout: stdout.stream,
        stderr: stderr.stream,
      })
    ).toBe(0);
    expect(
      await runTaskCommand(['stop', 'task-12345678'], {
        client: client as any,
        stdout: stdout.stream,
        stderr: stderr.stream,
      })
    ).toBe(0);
    expect(
      await runTaskCommand(['logs', 'task-12345678'], {
        client: client as any,
        stdout: stdout.stream,
        stderr: stderr.stream,
      })
    ).toBe(0);

    const output = stdout.read();
    expect(output).toContain('[finished]');
    expect(output).toContain('Reasoning: Opened the profile page');
    expect(output).toContain('Output: done');
    expect(output).toContain('Stopped task: task-12345678');
    expect(output).toContain('Download logs: https://files.browser-use.test/logs/task-12345678');
    expect(stderr.read()).toBe('');
  });

  it('supports JSON output for task list', async () => {
    const stdout = createWritable();
    const stderr = createWritable();
    const client = {
      list_tasks: vi.fn(async () => ({
        items: [{ id: 'task-1', status: 'started', task: 'Run task' }],
      })),
      get_task: vi.fn(),
      update_task: vi.fn(),
      get_task_logs: vi.fn(),
    };

    const exitCode = await runTaskCommand(['list', '--json'], {
      client: client as any,
      stdout: stdout.stream,
      stderr: stderr.stream,
    });

    expect(exitCode).toBe(0);
    expect(stdout.read()).toContain('"id": "task-1"');
    expect(stderr.read()).toBe('');
  });
});
