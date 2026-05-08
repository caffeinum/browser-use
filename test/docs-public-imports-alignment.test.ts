import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

const packageJson = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
);
const exportedSubpaths = new Set(Object.keys(packageJson.exports ?? {}));

const documentedFiles = [
  'README.md',
  ...fs
    .readdirSync(path.join(repoRoot, 'docs'))
    .filter((file) => file.endsWith('.md'))
    .map((file) => path.join('docs', file)),
];

const collectBrowserUseImports = (contents: string) => {
  const specifiers = new Set<string>();
  const importPattern =
    /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"](browser-use(?:\/[^'"]+)?)['"]/g;
  let match: RegExpExecArray | null;

  while ((match = importPattern.exec(contents))) {
    specifiers.add(match[1]!);
  }

  return [...specifiers];
};

describe('documented public imports', () => {
  it('only references package exports that are actually public', () => {
    const missing: string[] = [];

    for (const relativePath of documentedFiles) {
      const contents = fs.readFileSync(
        path.join(repoRoot, relativePath),
        'utf8'
      );
      for (const specifier of collectBrowserUseImports(contents)) {
        if (specifier === packageJson.name) {
          continue;
        }

        const subpath = `./${specifier.slice(`${packageJson.name}/`.length)}`;
        if (!exportedSubpaths.has(subpath)) {
          missing.push(`${relativePath}: ${specifier}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
