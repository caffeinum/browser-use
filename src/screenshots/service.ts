import fs from 'node:fs';
import path from 'node:path';

const decodeBase64 = (data: string) => Buffer.from(data, 'base64');

const chmodPrivatePath = (targetPath: string, mode: number) => {
  if (process.platform === 'win32') {
    return;
  }
  try {
    fs.chmodSync(targetPath, mode);
  } catch {
    /* best effort */
  }
};

const createPrivateDirectory = (dirPath: string) => {
  fs.mkdirSync(dirPath, { recursive: true, mode: 0o700 });
  chmodPrivatePath(dirPath, 0o700);
};

const chmodPrivateFile = async (filePath: string) => {
  if (process.platform !== 'win32') {
    await fs.promises.chmod(filePath, 0o600);
  }
};

export class ScreenshotService {
  private screenshotsDir: string;

  constructor(agentDirectory: string) {
    this.screenshotsDir = path.join(agentDirectory, 'screenshots');
    createPrivateDirectory(this.screenshotsDir);
  }

  async store_screenshot(screenshot_b64: string, step_number: number) {
    const filename = `step_${step_number}.png`;
    const filepath = path.join(this.screenshotsDir, filename);
    await fs.promises.writeFile(filepath, decodeBase64(screenshot_b64), {
      mode: 0o600,
    });
    await chmodPrivateFile(filepath);
    return filepath;
  }

  async get_screenshot(screenshot_path: string) {
    if (!screenshot_path) {
      return null;
    }
    try {
      const data = await fs.promises.readFile(screenshot_path);
      return data.toString('base64');
    } catch {
      return null;
    }
  }
}
