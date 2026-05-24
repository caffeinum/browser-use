import { createLogger } from '../logging-config.js';

const logger = createLogger('browser_use.controller.action_timeout');

const ACTION_TIMEOUT_FALLBACK_SECONDS = 180;
const ACTION_TIMEOUT_ENV = 'BROWSER_USE_ACTION_TIMEOUT_S';

const createAbortError = (reason?: unknown) => {
  if (reason instanceof Error && reason.name === 'AbortError') {
    return reason;
  }
  const error = new Error(
    reason instanceof Error ? reason.message : 'Operation aborted'
  );
  error.name = 'AbortError';
  if (reason !== undefined) {
    (error as Error & { cause?: unknown }).cause = reason;
  }
  return error;
};

const parseEnvActionTimeoutSeconds = () => {
  const raw = process.env[ACTION_TIMEOUT_ENV];
  if (raw == null || raw === '') {
    return ACTION_TIMEOUT_FALLBACK_SECONDS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    logger.warning(
      `Invalid ${ACTION_TIMEOUT_ENV}=${JSON.stringify(raw)}; falling back to ${ACTION_TIMEOUT_FALLBACK_SECONDS}s`
    );
    return ACTION_TIMEOUT_FALLBACK_SECONDS;
  }
  return parsed;
};

export const coerceActionTimeoutSeconds = (
  value: number | null | undefined
) => {
  if (value == null) {
    return parseEnvActionTimeoutSeconds();
  }
  if (!Number.isFinite(value) || value <= 0) {
    const fallback = parseEnvActionTimeoutSeconds();
    logger.warning(
      `Invalid action_timeout=${String(value)}; falling back to ${fallback}s`
    );
    return fallback;
  }
  return value;
};

export class ActionTimeoutError extends Error {
  readonly actionName: string;
  readonly timeoutSeconds: number;
  readonly isBrowserUseActionTimeout = true;

  constructor(actionName: string, timeoutSeconds: number) {
    super(
      `Action ${actionName} timed out after ${Math.round(timeoutSeconds)}s. ` +
        'The browser may be unresponsive (dead CDP WebSocket). Try again or a different approach.'
    );
    this.name = 'TimeoutError';
    this.actionName = actionName;
    this.timeoutSeconds = timeoutSeconds;
  }
}

export const isActionTimeoutError = (
  error: unknown
): error is ActionTimeoutError =>
  error instanceof Error &&
  error.name === 'TimeoutError' &&
  (error as ActionTimeoutError).isBrowserUseActionTimeout === true;

export async function runActionWithTimeout<T>(
  actionName: string,
  actionTimeoutSeconds: number | null | undefined,
  parentSignal: AbortSignal | null | undefined,
  execute: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const timeoutSeconds = coerceActionTimeoutSeconds(actionTimeoutSeconds);
  const controller = new AbortController();

  if (parentSignal?.aborted) {
    throw createAbortError(parentSignal.reason);
  }

  let timeoutHandle: NodeJS.Timeout | null = null;
  let abortHandler: (() => void) | null = null;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        const timeoutError = new ActionTimeoutError(actionName, timeoutSeconds);
        reject(timeoutError);
        controller.abort(timeoutError);
      }, timeoutSeconds * 1000);
    });

    const abortPromise = new Promise<never>((_, reject) => {
      if (!parentSignal) {
        return;
      }
      abortHandler = () => {
        const abortError = createAbortError(parentSignal.reason);
        controller.abort(abortError);
        reject(abortError);
      };
      parentSignal.addEventListener('abort', abortHandler, { once: true });
    });

    return await Promise.race([
      execute(controller.signal),
      timeoutPromise,
      abortPromise,
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
    if (abortHandler) {
      parentSignal?.removeEventListener('abort', abortHandler);
    }
  }
}
