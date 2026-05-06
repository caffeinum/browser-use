/**
 * Playwright Global Singleton Manager
 *
 * Manages Playwright instances at the event loop level to prevent
 * duplicate instantiation and ensure proper resource cleanup.
 *
 * This is important because:
 * 1. Playwright instances are heavy and should be reused
 * 2. Multiple instances can cause port conflicts
 * 3. Proper cleanup prevents resource leaks
 */
/**
 * Get or create a Playwright instance for the current event loop
 * Uses singleton pattern to prevent duplicate instances
 */
export declare function getPlaywrightInstance(options?: {
    browserType?: 'chromium' | 'firefox' | 'webkit';
    forceNew?: boolean;
}): Promise<any>;
/**
 * Release a Playwright instance reference
 * Decrements reference count and cleans up if no more references
 */
export declare function releasePlaywrightInstance(browserType?: 'chromium' | 'firefox' | 'webkit'): Promise<void>;
/**
 * Force cleanup of all Playwright instances
 * Should be called on process exit
 */
export declare function cleanupAllPlaywrightInstances(): Promise<void>;
/**
 * Register a cleanup handler to be called on shutdown
 */
export declare function registerCleanupHandler(handler: () => Promise<void>): void;
/**
 * Unregister a cleanup handler
 */
export declare function unregisterCleanupHandler(handler: () => Promise<void>): void;
/**
 * Get statistics about Playwright instances
 */
export declare function getPlaywrightStats(): {
    totalInstances: number;
    instances: Array<{
        key: string;
        refs: number;
    }>;
};
