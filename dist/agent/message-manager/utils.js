import fs from 'node:fs';
import path from 'node:path';
const serializeResponse = (response) => {
    if (!response) {
        return '';
    }
    if (typeof response.model_dump_json === 'function') {
        try {
            const raw = response.model_dump_json({ exclude_unset: true });
            return JSON.stringify(JSON.parse(raw), null, 2);
        }
        catch {
            /* fall through */
        }
    }
    try {
        return JSON.stringify(response, null, 2);
    }
    catch {
        return String(response);
    }
};
const formatConversation = (messages, response) => {
    const lines = [];
    messages.forEach((message) => {
        lines.push(` ${message.role} `);
        lines.push(typeof message.text === 'function'
            ? message.text()
            : (message.text ?? ''));
        lines.push('');
    });
    lines.push(serializeResponse(response));
    return lines.join('\n');
};
export const saveConversation = async (inputMessages, response, target, encoding = 'utf-8') => {
    const targetPath = path.resolve(target);
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    const payload = formatConversation(inputMessages, response);
    await fs.promises.writeFile(targetPath, payload, { encoding });
};
