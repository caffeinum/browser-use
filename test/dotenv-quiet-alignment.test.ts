import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const originalCwd = process.cwd();
const tempDirs: string[] = [];

const makeTempEnvCwd = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-use-dotenv-'));
  tempDirs.push(dir);
  fs.writeFileSync(path.join(dir, '.env'), 'BROWSER_USE_DOTENV_TEST=1\n');
  return dir;
};

describe('dotenv loading', () => {
  afterEach(() => {
    process.chdir(originalCwd);
    delete process.env.BROWSER_USE_DOTENV_TEST;
    vi.restoreAllMocks();
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not write dotenv banners when importing runtime modules', async () => {
    const tempDir = makeTempEnvCwd();
    process.chdir(tempDir);
    vi.resetModules();

    const stdoutWrite = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    const stderrWrite = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);

    await import('../src/config.js');
    await import('../src/utils.js');
    await import('../src/observability.js');

    const output = [
      ...stdoutWrite.mock.calls.flat(),
      ...stderrWrite.mock.calls.flat(),
    ]
      .map((chunk) => String(chunk))
      .join('');

    expect(output).not.toContain('[dotenv@');
    expect(process.env.BROWSER_USE_DOTENV_TEST).toBe('1');
  });
});
