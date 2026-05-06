import fs from 'node:fs';
import path from 'node:path';
export const export_to_ipynb = (agent, output_path) => {
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
    fs.writeFileSync(resolved, JSON.stringify(notebook, null, 2), 'utf-8');
    return resolved;
};
export const session_to_python_script = (agent) => {
    const lines = [];
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
