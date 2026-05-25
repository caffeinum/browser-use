import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

class MemoryWritable extends Writable {
  private chunks: string[] = [];

  _write(
    chunk: string | Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ) {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : chunk);
    callback();
  }

  text() {
    return this.chunks.join('');
  }
}

const importLogging = async () => {
  vi.resetModules();
  return await import('../src/logging-config.js');
};

const waitForFlush = async () => {
  await new Promise((resolve) => setTimeout(resolve, 20));
};

describe('logging config alignment', () => {
  afterEach(() => {
    delete process.env.BROWSER_USE_DEBUG_LOG_FILE;
    delete process.env.BROWSER_USE_INFO_LOG_FILE;
    delete process.env.BROWSER_USE_LOGGING_LEVEL;
  });

  it('writes debug logs to file while keeping console filtered at info level', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-use-logs-'));
    const debugFile = path.join(tempDir, 'debug.log');
    process.env.BROWSER_USE_DEBUG_LOG_FILE = debugFile;
    process.env.BROWSER_USE_LOGGING_LEVEL = 'info';

    const logging = await importLogging();
    const consoleSink = new MemoryWritable();
    logging.setupLogging({
      stream: consoleSink,
      logLevel: 'info',
      forceSetup: true,
    });

    const logger = logging.createLogger('browser_use.test');
    logger.debug('debug-only-message');
    logger.info('info-message');
    await waitForFlush();

    const consoleOutput = consoleSink.text();
    expect(consoleOutput).toContain('info-message');
    expect(consoleOutput).not.toContain('debug-only-message');

    const debugOutput = fs.readFileSync(debugFile, 'utf-8');
    expect(debugOutput).toContain('debug-only-message');
    expect(debugOutput).toContain('info-message');
    if (process.platform !== 'win32') {
      expect(fs.statSync(debugFile).mode & 0o777).toBe(0o600);
    }

    logging.setupLogging({
      stream: process.stderr,
      logLevel: 'info',
      forceSetup: true,
      debugLogFile: null,
      infoLogFile: null,
    });
  });

  it('writes info and warning logs to info log file but excludes debug logs', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-use-logs-'));
    const infoFile = path.join(tempDir, 'info.log');
    process.env.BROWSER_USE_INFO_LOG_FILE = infoFile;
    process.env.BROWSER_USE_LOGGING_LEVEL = 'warning';

    const logging = await importLogging();
    const consoleSink = new MemoryWritable();
    logging.setupLogging({
      stream: consoleSink,
      logLevel: 'warning',
      forceSetup: true,
    });

    const logger = logging.createLogger('browser_use.test');
    logger.debug('debug-message');
    logger.info('info-message');
    logger.warning('warning-message');
    await waitForFlush();

    const consoleOutput = consoleSink.text();
    expect(consoleOutput).toContain('warning-message');
    expect(consoleOutput).not.toContain('info-message');
    expect(consoleOutput).not.toContain('debug-message');

    const infoOutput = fs.readFileSync(infoFile, 'utf-8');
    expect(infoOutput).toContain('info-message');
    expect(infoOutput).toContain('warning-message');
    expect(infoOutput).not.toContain('debug-message');
    if (process.platform !== 'win32') {
      expect(fs.statSync(infoFile).mode & 0o777).toBe(0o600);
    }

    logging.setupLogging({
      stream: process.stderr,
      logLevel: 'info',
      forceSetup: true,
      debugLogFile: null,
      infoLogFile: null,
    });
  });
});
