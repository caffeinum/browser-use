#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJsonPath = path.join(repoRoot, 'package.json');
const mcpManifestPath = path.join(repoRoot, 'src/mcp/manifest.json');
const semverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

const usage = () => {
  console.error(`Usage:
  pnpm version:bump <version|major|minor|patch|sync>
  pnpm version:major
  pnpm version:minor
  pnpm version:patch
  pnpm version:sync
  pnpm version:check

Examples:
  pnpm version:bump 0.7.4
  pnpm version:bump patch
  pnpm version:patch
  pnpm version:check

Updates:
  package.json
  src/mcp/manifest.json`);
};

const readJson = filePath =>
  JSON.parse(fs.readFileSync(filePath, { encoding: 'utf8' }));

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const replaceJsonVersion = (filePath, currentVersion, nextVersion) => {
  if (currentVersion === nextVersion) {
    return;
  }

  const text = fs.readFileSync(filePath, { encoding: 'utf8' });
  const versionLine = new RegExp(
    `^(\\s*"version"\\s*:\\s*)"${escapeRegExp(currentVersion)}"(\\s*,?)$`,
    'm'
  );
  const updatedText = text.replace(versionLine, `$1"${nextVersion}"$2`);

  if (updatedText === text) {
    throw new Error(`Could not find version ${currentVersion} in ${filePath}.`);
  }

  fs.writeFileSync(filePath, updatedText);
};

const normalizeVersion = value => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.startsWith('v') ? value.slice(1) : value;
  return semverPattern.test(normalized) ? normalized : null;
};

const parseVersion = version => {
  const [major, minor, patch] = version
    .split(/[+-]/, 1)[0]
    .split('.')
    .map(Number);

  return { major, minor, patch };
};

const bumpVersion = (version, bumpType) => {
  const parsed = parseVersion(version);

  if (bumpType === 'major') {
    return `${parsed.major + 1}.0.0`;
  }

  if (bumpType === 'minor') {
    return `${parsed.major}.${parsed.minor + 1}.0`;
  }

  if (bumpType === 'patch') {
    return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
  }

  throw new Error(`Unsupported bump type: ${bumpType}`);
};

const fail = message => {
  console.error(message);
  process.exitCode = 1;
};

const args = process.argv.slice(2);
const flags = new Set(args.filter(arg => arg.startsWith('--')));
const positional = args.filter(arg => !arg.startsWith('--'));
const allowedFlags = new Set(['--check', '--dry-run', '--help']);
const unknownFlags = [...flags].filter(flag => !allowedFlags.has(flag));

if (flags.has('--help')) {
  usage();
  process.exit(0);
}

if (unknownFlags.length > 0) {
  usage();
  fail(`Unknown flag: ${unknownFlags.join(', ')}`);
  process.exit();
}

const packageJson = readJson(packageJsonPath);
const mcpManifest = readJson(mcpManifestPath);
const packageVersion = normalizeVersion(packageJson.version);
const manifestVersion = normalizeVersion(mcpManifest.version);

if (!packageVersion) {
  fail(`package.json has an invalid version: ${packageJson.version}`);
  process.exit();
}

if (!manifestVersion) {
  fail(`src/mcp/manifest.json has an invalid version: ${mcpManifest.version}`);
  process.exit();
}

if (flags.has('--check')) {
  if (positional.length > 0) {
    usage();
    fail('--check does not accept a version argument.');
    process.exit();
  }

  if (packageVersion !== manifestVersion) {
    fail(
      `Version mismatch: package.json is ${packageVersion}, src/mcp/manifest.json is ${manifestVersion}.`
    );
    process.exit();
  }

  console.log(`Versions are aligned at ${packageVersion}.`);
  process.exit(0);
}

if (positional.length !== 1) {
  usage();
  fail('Pass exactly one version, bump type, or sync.');
  process.exit();
}

const requestedVersion = positional[0];
const bumpTypes = new Set(['major', 'minor', 'patch']);
let nextVersion;

if (requestedVersion === 'sync') {
  nextVersion = packageVersion;
} else if (bumpTypes.has(requestedVersion)) {
  if (packageVersion !== manifestVersion) {
    fail(
      `Current versions are not aligned: package.json is ${packageVersion}, src/mcp/manifest.json is ${manifestVersion}. Run "pnpm version:bump <version>" or "pnpm version:sync" first.`
    );
    process.exit();
  }

  nextVersion = bumpVersion(packageVersion, requestedVersion);
} else {
  nextVersion = normalizeVersion(requestedVersion);

  if (!nextVersion) {
    usage();
    fail(`Invalid semver version: ${requestedVersion}`);
    process.exit();
  }
}

if (packageVersion === nextVersion && manifestVersion === nextVersion) {
  console.log(`Versions are already aligned at ${nextVersion}.`);
  process.exit(0);
}

if (flags.has('--dry-run')) {
  console.log(`Would update package.json: ${packageVersion} -> ${nextVersion}`);
  console.log(
    `Would update src/mcp/manifest.json: ${manifestVersion} -> ${nextVersion}`
  );
  process.exit(0);
}

replaceJsonVersion(packageJsonPath, packageJson.version, nextVersion);
replaceJsonVersion(mcpManifestPath, mcpManifest.version, nextVersion);

console.log(`Updated package.json: ${packageVersion} -> ${nextVersion}`);
console.log(
  `Updated src/mcp/manifest.json: ${manifestVersion} -> ${nextVersion}`
);
