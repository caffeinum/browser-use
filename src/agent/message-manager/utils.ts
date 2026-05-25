import fs from 'node:fs';
import path from 'node:path';
import { Message } from '../../llm/messages.js';

const chmodPrivateFile = (filePath: string) => {
  if (process.platform !== 'win32') {
    fs.chmodSync(filePath, 0o600);
  }
};

const ensurePrivateDirectoryIfCreated = async (dirPath: string) => {
  const existed = fs.existsSync(dirPath);
  await fs.promises.mkdir(dirPath, { recursive: true, mode: 0o700 });
  if (!existed && process.platform !== 'win32') {
    await fs.promises.chmod(dirPath, 0o700);
  }
};

const serializeResponse = (response: unknown) => {
  if (!response) {
    return '';
  }

  if (typeof (response as any).model_dump_json === 'function') {
    try {
      const raw = (response as any).model_dump_json({ exclude_unset: true });
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      /* fall through */
    }
  }

  try {
    return JSON.stringify(response, null, 2);
  } catch {
    return String(response);
  }
};

const formatConversation = (messages: Message[], response: unknown) => {
  const lines: string[] = [];
  messages.forEach((message) => {
    lines.push(` ${message.role} `);
    lines.push(
      typeof (message as any).text === 'function'
        ? (message as any).text()
        : ((message as any).text ?? '')
    );
    lines.push('');
  });
  lines.push(serializeResponse(response));
  return lines.join('\n');
};

export const saveConversation = async (
  inputMessages: Message[],
  response: unknown,
  target: string,
  encoding: BufferEncoding = 'utf-8'
) => {
  const targetPath = path.resolve(target);
  await ensurePrivateDirectoryIfCreated(path.dirname(targetPath));
  const payload = formatConversation(inputMessages, response);
  await fs.promises.writeFile(targetPath, payload, { encoding, mode: 0o600 });
  chmodPrivateFile(targetPath);
};
