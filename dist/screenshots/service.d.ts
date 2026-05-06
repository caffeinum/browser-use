export declare class ScreenshotService {
    private screenshotsDir;
    constructor(agentDirectory: string);
    store_screenshot(screenshot_b64: string, step_number: number): Promise<string>;
    get_screenshot(screenshot_path: string): Promise<string | null>;
}
