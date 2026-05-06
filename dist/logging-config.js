import fs from 'node:fs';
import path from 'node:path';
const LEVEL_PRIORITY = {
    debug: 10,
    info: 20,
    result: 25,
    warning: 30,
    error: 40,
};
let configured = false;
let consoleLevel = process.env.BROWSER_USE_LOGGING_LEVEL || 'info';
let consoleStream = process.stderr;
let debugLogStream = null;
let infoLogStream = null;
const normalizeLogLevel = (candidate, fallback) => {
    if (!candidate) {
        return fallback;
    }
    const normalized = candidate.toLowerCase();
    return normalized in LEVEL_PRIORITY ? normalized : fallback;
};
const formatMessage = (level, name, message) => {
    if (level === 'result') {
        return message;
    }
    const paddedLevel = level.toUpperCase().padEnd(7, ' ');
    return `${paddedLevel} [${name}] ${message}`;
};
const formatFileMessage = (level, name, message) => `${new Date().toISOString()} ${formatMessage(level, name, message)}`;
const writePayload = (stream, level, payload) => {
    if ('write' in stream) {
        stream.write(`${payload}\n`);
        return;
    }
    switch (level) {
        case 'error':
            console.error(payload);
            break;
        case 'warning':
            console.warn(payload);
            break;
        default:
            console.log(payload);
            break;
    }
};
const ensureFilePathReady = (filePath) => {
    fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
};
const closeFileStreams = () => {
    if (debugLogStream) {
        debugLogStream.end();
        debugLogStream = null;
    }
    if (infoLogStream) {
        infoLogStream.end();
        infoLogStream = null;
    }
};
export class Logger {
    name;
    constructor(name) {
        this.name = name;
    }
    shouldLog(level, threshold) {
        return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[threshold];
    }
    get level() {
        return consoleLevel;
    }
    emit(level, message, ...args) {
        const argsPayload = args.length
            ? args
                .map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
                .join(' ')
            : '';
        const formatted = formatMessage(level, this.name, message);
        const payload = argsPayload ? `${formatted} ${argsPayload}` : formatted;
        if (this.shouldLog(level, consoleLevel)) {
            writePayload(consoleStream, level, payload);
        }
        if (debugLogStream && this.shouldLog(level, 'debug')) {
            const filePayload = formatFileMessage(level, this.name, message);
            debugLogStream.write(`${argsPayload ? `${filePayload} ${argsPayload}` : filePayload}\n`);
        }
        if (infoLogStream && this.shouldLog(level, 'info')) {
            const filePayload = formatFileMessage(level, this.name, message);
            infoLogStream.write(`${argsPayload ? `${filePayload} ${argsPayload}` : filePayload}\n`);
        }
    }
    debug(message, ...args) {
        this.emit('debug', message, ...args);
    }
    info(message, ...args) {
        this.emit('info', message, ...args);
    }
    result(message, ...args) {
        this.emit('result', message, ...args);
    }
    warning(message, ...args) {
        this.emit('warning', message, ...args);
    }
    // Alias for compatibility
    warn(message, ...args) {
        this.warning(message, ...args);
    }
    error(message, ...args) {
        this.emit('error', message, ...args);
    }
    child(suffix) {
        return new Logger(`${this.name}.${suffix}`);
    }
}
export const createLogger = (name) => new Logger(name);
export const setupLogging = (options = {}) => {
    if (configured && !options.forceSetup) {
        return createLogger('browser_use');
    }
    closeFileStreams();
    consoleLevel = normalizeLogLevel(options.logLevel ?? process.env.BROWSER_USE_LOGGING_LEVEL, 'info');
    consoleStream = options.stream || process.stderr;
    const debugLogFile = options.debugLogFile ?? process.env.BROWSER_USE_DEBUG_LOG_FILE ?? null;
    if (debugLogFile && debugLogFile.trim().length > 0) {
        ensureFilePathReady(debugLogFile);
        debugLogStream = fs.createWriteStream(path.resolve(debugLogFile), {
            flags: 'a',
            encoding: 'utf-8',
        });
    }
    const infoLogFile = options.infoLogFile ?? process.env.BROWSER_USE_INFO_LOG_FILE ?? null;
    if (infoLogFile && infoLogFile.trim().length > 0) {
        ensureFilePathReady(infoLogFile);
        infoLogStream = fs.createWriteStream(path.resolve(infoLogFile), {
            flags: 'a',
            encoding: 'utf-8',
        });
    }
    configured = true;
    return createLogger('browser_use');
};
setupLogging();
export const logger = createLogger('browser_use');
