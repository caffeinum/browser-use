import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

const readJson = (relativePath: string) =>
  JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));

const isRemoteUrl = (value: string) => /^https?:\/\//.test(value);

describe('MCP manifest alignment', () => {
  it('keeps the DXT manifest version aligned with package.json', () => {
    const packageJson = readJson('package.json');
    const manifest = readJson('src/mcp/manifest.json');

    expect(manifest.version).toBe(packageJson.version);
  });

  it('does not reference missing local asset files', () => {
    const manifest = readJson('src/mcp/manifest.json');
    const assetPaths: string[] = [];

    if (typeof manifest.icon === 'string' && !isRemoteUrl(manifest.icon)) {
      assetPaths.push(manifest.icon);
    }

    if (Array.isArray(manifest.icons)) {
      for (const icon of manifest.icons) {
        if (icon && typeof icon.src === 'string' && !isRemoteUrl(icon.src)) {
          assetPaths.push(icon.src);
        }
      }
    }

    if (Array.isArray(manifest.screenshots)) {
      for (const screenshot of manifest.screenshots) {
        if (typeof screenshot === 'string' && !isRemoteUrl(screenshot)) {
          assetPaths.push(screenshot);
        }
      }
    }

    for (const assetPath of assetPaths) {
      expect(fs.existsSync(path.join(repoRoot, 'src/mcp', assetPath))).toBe(
        true
      );
    }
  });
});
