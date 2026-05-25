import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { saveConversation } from '../src/agent/message-manager/utils.js';
import { SystemMessage, UserMessage } from '../src/llm/messages.js';

describe('message-manager utils alignment', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('formats saved conversations without RESPONSE header (python c011 parity)', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-use-msg-'));
    tempDirs.push(tempDir);
    const targetPath = path.join(tempDir, 'conversation.txt');

    await saveConversation(
      [new SystemMessage('system instructions'), new UserMessage('hello')],
      {
        model_dump_json: () => JSON.stringify({ ok: true, value: 1 }),
      },
      targetPath
    );

    const content = fs.readFileSync(targetPath, 'utf-8');
    expect(content).toContain(' system ');
    expect(content).toContain(' user ');
    expect(content).toContain('"ok": true');
    expect(content).not.toContain(' RESPONSE');
    if (process.platform !== 'win32') {
      expect(fs.statSync(targetPath).mode & 0o777).toBe(0o600);
    }
  });
});
