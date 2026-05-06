/**
 * DVD Screensaver Loading Animation
 *
 * Displays a fun DVD logo bouncing animation while waiting for browser operations.
 * Inspired by the classic DVD screensaver.
 */
import { createLogger } from '../logging-config.js';
const logger = createLogger('browser_use.dvd_screensaver');
/**
 * DVD Screensaver Animation Controller
 */
export class DVDScreensaver {
    isRunning = false;
    intervalId = null;
    width = 80;
    height = 20;
    x = 0;
    y = 0;
    dx = 1;
    dy = 1;
    logoWidth = 10;
    logoHeight = 3;
    colors = [
        '\x1b[31m',
        '\x1b[32m',
        '\x1b[33m',
        '\x1b[34m',
        '\x1b[35m',
        '\x1b[36m',
    ];
    currentColorIndex = 0;
    cornerHits = 0;
    frameCount = 0;
    message;
    constructor(message = 'Loading...') {
        this.message = message;
        this.x = Math.floor(Math.random() * (this.width - this.logoWidth));
        this.y = Math.floor(Math.random() * (this.height - this.logoHeight));
    }
    /**
     * Start the animation
     */
    start(fps = 10) {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        // Hide cursor
        process.stderr.write('\x1b[?25l');
        // Clear screen
        this.clear();
        this.intervalId = setInterval(() => {
            this.update();
            this.render();
        }, 1000 / fps);
    }
    /**
     * Stop the animation
     */
    stop() {
        if (!this.isRunning) {
            return;
        }
        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        // Clear screen one last time
        this.clear();
        // Show cursor
        process.stderr.write('\x1b[?25h');
        // Log corner hits if any
        if (this.cornerHits > 0) {
            logger.debug(`DVD logo hit corner ${this.cornerHits} time(s)! 🎯`);
        }
    }
    /**
     * Update logo position
     */
    update() {
        this.frameCount++;
        // Update position
        this.x += this.dx;
        this.y += this.dy;
        let hitCorner = false;
        // Check horizontal bounds
        if (this.x <= 0 || this.x >= this.width - this.logoWidth) {
            this.dx = -this.dx;
            this.x = Math.max(0, Math.min(this.x, this.width - this.logoWidth));
            this.changeColor();
            // Check if hit corner
            if (this.y <= 0 || this.y >= this.height - this.logoHeight) {
                hitCorner = true;
            }
        }
        // Check vertical bounds
        if (this.y <= 0 || this.y >= this.height - this.logoHeight) {
            this.dy = -this.dy;
            this.y = Math.max(0, Math.min(this.y, this.height - this.logoHeight));
            this.changeColor();
            // Check if hit corner
            if (this.x <= 0 || this.x >= this.width - this.logoWidth) {
                hitCorner = true;
            }
        }
        if (hitCorner) {
            this.cornerHits++;
        }
    }
    /**
     * Change logo color
     */
    changeColor() {
        this.currentColorIndex = (this.currentColorIndex + 1) % this.colors.length;
    }
    /**
     * Render the current frame
     */
    render() {
        // Move cursor to top-left
        process.stderr.write('\x1b[H');
        const color = this.colors[this.currentColorIndex];
        const reset = '\x1b[0m';
        // Build frame
        const frame = [];
        // Draw border and content
        for (let row = 0; row < this.height; row++) {
            let line = '';
            for (let col = 0; col < this.width; col++) {
                // Check if this position is part of the logo
                if (row >= this.y &&
                    row < this.y + this.logoHeight &&
                    col >= this.x &&
                    col < this.x + this.logoWidth) {
                    // Draw logo
                    const logoRow = row - this.y;
                    const logoCol = col - this.x;
                    line += color + this.getLogoChar(logoRow, logoCol) + reset;
                }
                else if (row === 0 ||
                    row === this.height - 1 ||
                    col === 0 ||
                    col === this.width - 1) {
                    // Draw border
                    line += '·';
                }
                else {
                    line += ' ';
                }
            }
            frame.push(line);
        }
        // Add status message
        const statusLine = `\n${this.message} (Frame: ${this.frameCount}, Corner hits: ${this.cornerHits})`;
        // Write frame to stderr
        process.stderr.write(frame.join('\n') + statusLine);
    }
    /**
     * Get character for logo at specific position
     */
    getLogoChar(row, col) {
        // Simple "DVD" text logo
        if (row === 1) {
            const text = '   DVD   ';
            return col < text.length ? text[col] : ' ';
        }
        return '▓';
    }
    /**
     * Clear screen
     */
    clear() {
        process.stderr.write('\x1b[2J\x1b[H');
    }
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
export function showDVDScreensaver(message = 'Loading...', fps = 10) {
    const screensaver = new DVDScreensaver(message);
    screensaver.start(fps);
    return () => {
        screensaver.stop();
    };
}
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
export async function withDVDScreensaver(operation, message = 'Loading...') {
    const stopAnimation = showDVDScreensaver(message);
    try {
        const result = await operation();
        return result;
    }
    finally {
        stopAnimation();
    }
}
/**
 * Simple spinner animation (alternative to DVD screensaver)
 */
export class SpinnerAnimation {
    isRunning = false;
    intervalId = null;
    frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    currentFrame = 0;
    message;
    constructor(message = 'Loading...') {
        this.message = message;
    }
    start(fps = 10) {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        process.stderr.write('\x1b[?25l'); // Hide cursor
        this.intervalId = setInterval(() => {
            this.render();
            this.currentFrame = (this.currentFrame + 1) % this.frames.length;
        }, 1000 / fps);
    }
    stop() {
        if (!this.isRunning) {
            return;
        }
        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        // Clear line and show cursor
        process.stderr.write('\r\x1b[K');
        process.stderr.write('\x1b[?25h');
    }
    render() {
        const frame = this.frames[this.currentFrame];
        process.stderr.write(`\r${frame} ${this.message}`);
    }
}
/**
 * Show simple spinner animation
 */
export function showSpinner(message = 'Loading...', fps = 10) {
    const spinner = new SpinnerAnimation(message);
    spinner.start(fps);
    return () => {
        spinner.stop();
    };
}
