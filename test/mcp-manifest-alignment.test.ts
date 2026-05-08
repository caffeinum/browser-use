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

describe('MCP manifest alignment', () => {
  it('keeps the DXT manifest version aligned with package.json', () => {
    const packageJson = readJson('package.json');
    const manifest = readJson('src/mcp/manifest.json');

    expect(manifest.version).toBe(packageJson.version);
  });
});
