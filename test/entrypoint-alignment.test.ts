import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { isMainModule } from '../src/entrypoint.js';

const TEMP_DIRS: string[] = [];

const makeTempDir = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-use-entrypoint-'));
  TEMP_DIRS.push(dir);
  return dir;
};

describe('entrypoint alignment', () => {
  afterEach(() => {
    for (const dir of TEMP_DIRS.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('matches file URLs with encoded characters to filesystem paths', () => {
    const tempDir = makeTempDir();
    const entryPath = path.join(tempDir, 'entry #hash %.mjs');
    fs.writeFileSync(entryPath, '');

    expect(isMainModule(pathToFileURL(entryPath).href, entryPath)).toBe(true);
  });

  it('matches symlinked bin paths to the real entry module', () => {
    const tempDir = makeTempDir();
    const entryPath = path.join(tempDir, 'entry.mjs');
    const binPath = path.join(tempDir, 'browser-use #bin');
    fs.writeFileSync(entryPath, '');

    try {
      fs.symlinkSync(entryPath, binPath, 'file');
    } catch {
      return;
    }

    expect(isMainModule(pathToFileURL(entryPath).href, binPath)).toBe(true);
  });

  it('does not match a different entry path', () => {
    const tempDir = makeTempDir();
    const entryPath = path.join(tempDir, 'entry.mjs');
    const otherPath = path.join(tempDir, 'other.mjs');
    fs.writeFileSync(entryPath, '');
    fs.writeFileSync(otherPath, '');

    expect(isMainModule(pathToFileURL(entryPath).href, otherPath)).toBe(false);
  });

  it('does not match when argv[1] is unavailable', () => {
    const tempDir = makeTempDir();
    const entryPath = path.join(tempDir, 'entry.mjs');
    fs.writeFileSync(entryPath, '');

    expect(isMainModule(pathToFileURL(entryPath).href, undefined)).toBe(false);
  });
});
