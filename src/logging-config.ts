import fs from 'node:fs';
import path from 'node:path';
import { Writable } from 'node:stream';

export type LogLevel = 'debug' | 'info' | 'result' | 'warning' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  result: 25,
  warning: 30,
  error: 40,
};

type SupportedStream = Writable | Console;

interface SetupLoggingOptions {
  stream?: Writable;
  logLevel?: LogLevel;
  forceSetup?: boolean;
  debugLogFile?: string | null;
  infoLogFile?: string | null;
}

let configured = false;
let consoleLevel: LogLevel =
  (process.env.BROWSER_USE_LOGGING_LEVEL as LogLevel) || 'info';
let consoleStream: SupportedStream = process.stderr;
let debugLogStream: fs.WriteStream | null = null;
let infoLogStream: fs.WriteStream | null = null;

const normalizeLogLevel = (
  candidate: string | null | undefined,
  fallback: LogLevel
): LogLevel => {
  if (!candidate) {
    return fallback;
  }
  const normalized = candidate.toLowerCase();
  return normalized in LEVEL_PRIORITY ? (normalized as LogLevel) : fallback;
};

const formatMessage = (level: LogLevel, name: string, message: string) => {
  if (level === 'result') {
    return message;
  }

  const paddedLevel = level.toUpperCase().padEnd(7, ' ');
  return `${paddedLevel} [${name}] ${message}`;
};

const formatFileMessage = (level: LogLevel, name: string, message: string) =>
  `${new Date().toISOString()} ${formatMessage(level, name, message)}`;

const writePayload = (
  stream: SupportedStream,
  level: LogLevel,
  payload: string
) => {
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

const ensureFilePathReady = (filePath: string) => {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
};

const createPrivateLogStream = (filePath: string) => {
  const resolved = path.resolve(filePath);
  ensureFilePathReady(resolved);
  const fd = fs.openSync(resolved, 'a', 0o600);
  if (process.platform !== 'win32') {
    fs.chmodSync(resolved, 0o600);
  }
  return fs.createWriteStream(resolved, {
    fd,
    flags: 'a',
    encoding: 'utf-8',
    autoClose: true,
  });
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
  constructor(private readonly name: string) {}

  private shouldLog(level: LogLevel, threshold: LogLevel) {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[threshold];
  }

  public get level(): LogLevel {
    return consoleLevel;
  }

  private emit(level: LogLevel, message: string, ...args: unknown[]) {
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
      debugLogStream.write(
        `${argsPayload ? `${filePayload} ${argsPayload}` : filePayload}\n`
      );
    }

    if (infoLogStream && this.shouldLog(level, 'info')) {
      const filePayload = formatFileMessage(level, this.name, message);
      infoLogStream.write(
        `${argsPayload ? `${filePayload} ${argsPayload}` : filePayload}\n`
      );
    }
  }

  debug(message: string, ...args: unknown[]) {
    this.emit('debug', message, ...args);
  }

  info(message: string, ...args: unknown[]) {
    this.emit('info', message, ...args);
  }

  result(message: string, ...args: unknown[]) {
    this.emit('result', message, ...args);
  }

  warning(message: string, ...args: unknown[]) {
    this.emit('warning', message, ...args);
  }

  // Alias for compatibility
  warn(message: string, ...args: unknown[]) {
    this.warning(message, ...args);
  }

  error(message: string, ...args: unknown[]) {
    this.emit('error', message, ...args);
  }

  child(suffix: string) {
    return new Logger(`${this.name}.${suffix}`);
  }
}

export const createLogger = (name: string) => new Logger(name);

export const setupLogging = (options: SetupLoggingOptions = {}) => {
  if (configured && !options.forceSetup) {
    return createLogger('browser_use');
  }

  closeFileStreams();

  consoleLevel = normalizeLogLevel(
    options.logLevel ?? process.env.BROWSER_USE_LOGGING_LEVEL,
    'info'
  );
  consoleStream = options.stream || process.stderr;

  const debugLogFile =
    options.debugLogFile ?? process.env.BROWSER_USE_DEBUG_LOG_FILE ?? null;
  if (debugLogFile && debugLogFile.trim().length > 0) {
    debugLogStream = createPrivateLogStream(debugLogFile);
  }

  const infoLogFile =
    options.infoLogFile ?? process.env.BROWSER_USE_INFO_LOG_FILE ?? null;
  if (infoLogFile && infoLogFile.trim().length > 0) {
    infoLogStream = createPrivateLogStream(infoLogFile);
  }

  configured = true;

  return createLogger('browser_use');
};

setupLogging();

export const logger = createLogger('browser_use');
