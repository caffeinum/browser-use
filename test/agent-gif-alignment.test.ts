import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCanvas } from 'canvas';
import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_4PX_SCREENSHOT } from '../src/browser/views.js';
import {
  create_history_gif,
  is_valid_gif_screenshot_candidate,
} from '../src/agent/gif.js';

describe('agent gif alignment', () => {
  it('rejects placeholder screenshots', () => {
    expect(
      is_valid_gif_screenshot_candidate(
        PLACEHOLDER_4PX_SCREENSHOT,
        'https://example.com'
      )
    ).toBe(false);
  });

  it('rejects screenshots captured on new-tab pages', () => {
    expect(
      is_valid_gif_screenshot_candidate('base64-image', 'chrome://newtab/')
    ).toBe(false);
    expect(
      is_valid_gif_screenshot_candidate('base64-image', 'about:blank')
    ).toBe(false);
  });

  it('accepts non-placeholder screenshots on regular pages', () => {
    expect(
      is_valid_gif_screenshot_candidate('base64-image', 'https://example.com')
    ).toBe(true);
  });

  it('writes generated GIFs as private files', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-use-gif-'));
    try {
      const outputDir = path.join(tempDir, 'nested');
      const outputPath = path.join(outputDir, 'history.gif');
      const canvas = createCanvas(2, 2);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 2, 2);
      const png1x1 = canvas.toBuffer('image/png').toString('base64');
      const history = {
        history: [
          {
            state: { url: 'https://example.com' },
            model_output: null,
          },
        ],
        screenshots: () => [png1x1],
      };

      await create_history_gif('task', history as any, {
        output_path: outputPath,
        show_task: false,
        show_goals: false,
        show_logo: false,
      });

      expect(fs.existsSync(outputPath)).toBe(true);
      if (process.platform !== 'win32') {
        expect(fs.statSync(outputDir).mode & 0o777).toBe(0o700);
        expect(fs.statSync(outputPath).mode & 0o777).toBe(0o600);
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
