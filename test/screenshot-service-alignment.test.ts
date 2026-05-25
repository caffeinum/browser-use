import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ScreenshotService } from '../src/screenshots/service.js';

describe('ScreenshotService file permissions', () => {
  it('stores screenshots in a private directory as private files', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-use-ssvc-'));
    try {
      const service = new ScreenshotService(tempDir);
      const screenshotPath = await service.store_screenshot(
        Buffer.from('fake-png').toString('base64'),
        3
      );

      expect(fs.existsSync(screenshotPath)).toBe(true);
      expect(await service.get_screenshot(screenshotPath)).toBe(
        Buffer.from('fake-png').toString('base64')
      );
      if (process.platform !== 'win32') {
        expect(fs.statSync(path.dirname(screenshotPath)).mode & 0o777).toBe(
          0o700
        );
        expect(fs.statSync(screenshotPath).mode & 0o777).toBe(0o600);
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
