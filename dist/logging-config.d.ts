import { Writable } from 'node:stream';
export type LogLevel = 'debug' | 'info' | 'result' | 'warning' | 'error';
interface SetupLoggingOptions {
    stream?: Writable;
    logLevel?: LogLevel;
    forceSetup?: boolean;
    debugLogFile?: string | null;
    infoLogFile?: string | null;
}
export declare class Logger {
    private readonly name;
    constructor(name: string);
    private shouldLog;
    get level(): LogLevel;
    private emit;
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    result(message: string, ...args: unknown[]): void;
    warning(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
    child(suffix: string): Logger;
}
export declare const createLogger: (name: string) => Logger;
export declare const setupLogging: (options?: SetupLoggingOptions) => Logger;
export declare const logger: Logger;
export {};
