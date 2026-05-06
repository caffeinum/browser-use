/**
 * DVD Screensaver Loading Animation
 *
 * Displays a fun DVD logo bouncing animation while waiting for browser operations.
 * Inspired by the classic DVD screensaver.
 */
/**
 * DVD Screensaver Animation Controller
 */
export declare class DVDScreensaver {
    private isRunning;
    private intervalId;
    private width;
    private height;
    private x;
    private y;
    private dx;
    private dy;
    private logoWidth;
    private logoHeight;
    private colors;
    private currentColorIndex;
    private cornerHits;
    private frameCount;
    private message;
    constructor(message?: string);
    /**
     * Start the animation
     */
    start(fps?: number): void;
    /**
     * Stop the animation
     */
    stop(): void;
    /**
     * Update logo position
     */
    private update;
    /**
     * Change logo color
     */
    private changeColor;
    /**
     * Render the current frame
     */
    private render;
    /**
     * Get character for logo at specific position
     */
    private getLogoChar;
    /**
     * Clear screen
     */
    private clear;
}
/**
 * Show DVD screensaver loading animation
 * Returns a function to stop the animation
 *
 * @param message - Message to display
 * @param fps - Frames per second (default: 10)
 * @returns Function to stop the animation
 *
 * @example
 * const stopAnimation = showDVDScreensaver('Loading browser...');
 * await someAsyncOperation();
 * stopAnimation();
 */
export declare function showDVDScreensaver(message?: string, fps?: number): () => void;
/**
 * Run an async operation with DVD screensaver animation
 *
 * @param operation - Async operation to run
 * @param message - Message to display
 * @returns Result of the operation
 *
 * @example
 * const result = await withDVDScreensaver(
 *   async () => await longRunningOperation(),
 *   'Processing...'
 * );
 */
export declare function withDVDScreensaver<T>(operation: () => Promise<T>, message?: string): Promise<T>;
/**
 * Simple spinner animation (alternative to DVD screensaver)
 */
export declare class SpinnerAnimation {
    private isRunning;
    private intervalId;
    private frames;
    private currentFrame;
    private message;
    constructor(message?: string);
    start(fps?: number): void;
    stop(): void;
    private render;
}
/**
 * Show simple spinner animation
 */
export declare function showSpinner(message?: string, fps?: number): () => void;
