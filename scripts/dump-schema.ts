#!/usr/bin/env -S npx tsx
/*
 * dump-schema — print the JSON Schema rendered for any registered action.
 *
 * The action registry feeds these schemas to the LLM as the input contract
 * (via RegisteredAction.promptDescription). This script calls the same
 * helper (RegisteredAction.getPromptJsonSchema) so the output matches what
 * the model actually sees at runtime — no reimplementation.
 *
 * Usage:
 *   bun run scripts/dump-schema.ts done
 *   bun run scripts/dump-schema.ts scroll
 *   bun run scripts/dump-schema.ts --all
 *   bun run scripts/dump-schema.ts --list
 *
 * (works with `tsx scripts/dump-schema.ts ...` too)
 */
import { Controller } from '../src/controller/service.js';

type ArgvFlags = {
  all: boolean;
  list: boolean;
  names: string[];
};

function parseArgv(argv: string[]): ArgvFlags {
  const flags: ArgvFlags = { all: false, list: false, names: [] };
  for (const arg of argv) {
    if (arg === '--all') {
      flags.all = true;
    } else if (arg === '--list') {
      flags.list = true;
    } else if (arg === '-h' || arg === '--help') {
      printUsageAndExit(0);
    } else if (arg.startsWith('-')) {
      console.error(`unknown flag: ${arg}`);
      printUsageAndExit(2);
    } else {
      flags.names.push(arg);
    }
  }
  return flags;
}

function printUsageAndExit(code: number): never {
  console.error(
    [
      'usage:',
      '  bun run scripts/dump-schema.ts <action_name> [<action_name> ...]',
      '  bun run scripts/dump-schema.ts --all',
      '  bun run scripts/dump-schema.ts --list',
    ].join('\n')
  );
  process.exit(code);
}

function main() {
  const flags = parseArgv(process.argv.slice(2));

  if (!flags.all && !flags.list && flags.names.length === 0) {
    printUsageAndExit(2);
  }

  // Instantiate Controller to register all default actions.
  const controller = new Controller();
  const actions = controller.registry.get_all_actions();

  if (flags.list) {
    for (const name of [...actions.keys()].sort()) {
      console.log(name);
    }
    return;
  }

  const targets = flags.all
    ? [...actions.keys()].sort()
    : flags.names;

  const missing = targets.filter((n) => !actions.has(n));
  if (missing.length > 0) {
    console.error(`unknown action(s): ${missing.join(', ')}`);
    console.error(`run with --list to see available actions`);
    process.exit(1);
  }

  const out: Record<string, unknown> = {};
  for (const name of targets) {
    const action = actions.get(name)!;
    out[name] = {
      description: action.description,
      schema: action.getPromptJsonSchema(),
    };
  }

  // Single action → unwrap so output is more focused.
  if (!flags.all && targets.length === 1) {
    console.log(JSON.stringify(out[targets[0]!], null, 2));
    return;
  }

  console.log(JSON.stringify(out, null, 2));
}

main();
