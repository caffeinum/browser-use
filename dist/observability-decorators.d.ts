/**
 * Observability Decorators and Utilities
 *
 * Provides debugging and performance tracking capabilities
 * for browser automation operations.
 *
 * Note: TypeScript decorators work differently than Python.
 * These are implemented as wrapper functions that can be used
 * in a similar way to decorators.
 */
import { createLogger } from './logging-config.js';
/**
 * Debug observation configuration
 */
export interface ObserveDebugOptions {
    /** Enable detailed logging */
    verbose?: boolean;
    /** Log function arguments */
    logArgs?: boolean;
    /** Log return values */
    logResult?: boolean;
    /** Log execution time */
    logTime?: boolean;
    /** Custom logger instance */
    logger?: ReturnType<typeof createLogger>;
}
/**
 * Observe and debug async function execution
 * Wraps an async function to add logging and debugging capabilities
 *
 * @example
 * const debuggedFn = observeDebug(myAsyncFn, { verbose: true, logArgs: true });
 * await debuggedFn(arg1, arg2);
 */
export declare function observeDebug<T extends (...args: any[]) => Promise<any>>(fn: T, options?: ObserveDebugOptions): T;
/**
 * Method decorator for observing debug (TypeScript experimental decorators)
 * This requires "experimentalDecorators": true in tsconfig.json
 *
 * @example
 * class MyClass {
 *   @observeDebugMethod({ verbose: true })
 *   async myMethod(arg: string) {
 *     // method implementation
 *   }
 * }
 */
export declare function observeDebugMethod(options?: ObserveDebugOptions): (target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
/**
 * Performance tracking for async functions
 * Combines time execution tracking with debug observation
 *
 * @example
 * const trackedFn = trackPerformance(myAsyncFn, 'MyOperation');
 * await trackedFn(arg1, arg2);
 */
export declare function trackPerformance<T extends (...args: any[]) => Promise<any>>(fn: T, operationName?: string): T;
/**
 * Comprehensive observability wrapper
 * Combines debugging, performance tracking, and error handling
 *
 * @example
 * const observedFn = withObservability(myAsyncFn, {
 *   name: 'CriticalOperation',
 *   debug: true,
 *   trackPerformance: true,
 *   onError: (error) => console.error('Operation failed:', error)
 * });
 */
export declare function withObservability<T extends (...args: any[]) => Promise<any>>(fn: T, options?: {
    name?: string;
    debug?: boolean;
    debugOptions?: ObserveDebugOptions;
    trackPerformance?: boolean;
    onError?: (error: Error) => void;
    onSuccess?: (result: any) => void;
}): T;
/**
 * Create a debug trace for a series of operations
 * Useful for tracking complex workflows
 */
type TraceOperation = {
    name: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    status: 'pending' | 'success' | 'error';
    error?: Error;
};
export declare class OperationTrace {
    private operations;
    private logger;
    private traceName;
    constructor(traceName: string, customLogger?: ReturnType<typeof createLogger>);
    /**
     * Start tracking an operation
     */
    startOperation(name: string): void;
    /**
     * Mark an operation as completed successfully
     */
    completeOperation(name: string): void;
    /**
     * Mark an operation as failed
     */
    failOperation(name: string, error: Error): void;
    /**
     * Get trace summary
     */
    getSummary(): {
        traceName: string;
        totalOperations: number;
        successCount: number;
        errorCount: number;
        pendingCount: number;
        totalDuration: number;
        operations: TraceOperation[];
    };
    /**
     * Log trace summary
     */
    logSummary(): void;
}
/**
 * Simple performance counter for tracking operation metrics
 */
export declare class PerformanceCounter {
    private counters;
    private logger;
    constructor(customLogger?: ReturnType<typeof createLogger>);
    /**
     * Record an operation execution
     */
    record(operationName: string, durationMs: number): void;
    /**
     * Get statistics for an operation
     */
    getStats(operationName: string): {
        count: number;
        avgTime: number;
        minTime: number;
        maxTime: number;
        totalTime: number;
    } | null;
    /**
     * Get all statistics
     */
    getAllStats(): Map<string, ReturnType<PerformanceCounter['getStats']>>;
    /**
     * Log statistics summary
     */
    logSummary(): void;
    /**
     * Reset all counters
     */
    reset(): void;
}
export {};
