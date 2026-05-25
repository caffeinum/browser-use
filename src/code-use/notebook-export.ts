import fs from 'node:fs';
import path from 'node:path';
import type { CodeAgent } from './service.js';

const chmodPrivateFile = (filePath: string) => {
  if (process.platform !== 'win32') {
    fs.chmodSync(filePath, 0o600);
  }
};

export const export_to_ipynb = (agent: CodeAgent, output_path: string) => {
  const notebook = {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: {
        display_name: 'Node.js',
        language: 'javascript',
        name: 'javascript',
      },
    },
    cells: agent.session.cells.map((cell) => {
      if (cell.cell_type === 'markdown') {
        return {
          cell_type: 'markdown',
          metadata: {},
          source: cell.source.split('\n').map((entry) => `${entry}\n`),
        };
      }
      return {
        cell_type: 'code',
        metadata: {},
        source: cell.source.split('\n').map((entry) => `${entry}\n`),
        execution_count: cell.execution_count,
        outputs: cell.output
          ? [
              {
                output_type: 'stream',
                name: 'stdout',
                text: `${cell.output}\n`,
              },
            ]
          : [],
      };
    }),
  };

  const resolved = path.resolve(output_path);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, JSON.stringify(notebook, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });
  chmodPrivateFile(resolved);
  return resolved;
};

export const session_to_python_script = (agent: CodeAgent) => {
  const lines: string[] = [];
  lines.push('# Generated from browser-use code-use session');
  lines.push('');
  for (const cell of agent.session.cells) {
    if (cell.cell_type !== 'code') {
      continue;
    }
    lines.push(cell.source);
    lines.push('');
  }
  return lines.join('\n');
};
