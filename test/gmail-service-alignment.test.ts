import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { GmailService } from '../src/integrations/gmail/service.js';

describe('GmailService file permissions', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  const makeTempDir = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-use-gmail-'));
    tempDirs.push(dir);
    return dir;
  };

  it('keeps OAuth token files and config directory private', async () => {
    const configDir = makeTempDir();
    const tokenFile = path.join(configDir, 'gmail_token.json');
    fs.writeFileSync(
      tokenFile,
      JSON.stringify({ access_token: 'existing-token' }),
      'utf-8'
    );

    if (process.platform !== 'win32') {
      fs.chmodSync(configDir, 0o755);
      fs.chmodSync(tokenFile, 0o644);
    }

    const service = new GmailService({ config_dir: configDir });
    await expect(service.authenticate()).resolves.toBe(true);

    if (process.platform !== 'win32') {
      expect(fs.statSync(configDir).mode & 0o777).toBe(0o700);
      expect(fs.statSync(tokenFile).mode & 0o777).toBe(0o600);
    }
  });
});
