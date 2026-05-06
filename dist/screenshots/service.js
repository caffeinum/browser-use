import fs from 'node:fs';
import path from 'node:path';
const decodeBase64 = (data) => Buffer.from(data, 'base64');
export class ScreenshotService {
    screenshotsDir;
    constructor(agentDirectory) {
        this.screenshotsDir = path.join(agentDirectory, 'screenshots');
        fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }
    async store_screenshot(screenshot_b64, step_number) {
        const filename = `step_${step_number}.png`;
        const filepath = path.join(this.screenshotsDir, filename);
        await fs.promises.writeFile(filepath, decodeBase64(screenshot_b64));
        return filepath;
    }
    async get_screenshot(screenshot_path) {
        if (!screenshot_path) {
            return null;
        }
        try {
            const data = await fs.promises.readFile(screenshot_path);
            return data.toString('base64');
        }
        catch {
            return null;
        }
    }
}
