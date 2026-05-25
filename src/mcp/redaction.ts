const REDACTED_VALUE = '<redacted>';

const isSensitiveMcpArgumentKey = (key: string) => {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return [
    'password',
    'passwd',
    'pwd',
    'secret',
    'token',
    'apikey',
    'accesskey',
    'secretkey',
    'credential',
    'credentials',
    'authorization',
    'cookie',
    'session',
  ].some((candidate) => normalized.includes(candidate));
};

const redactStringForMcpLog = (value: string): string => {
  const trimmed = value.trim();
  if (/^(bearer|basic)\s+\S+/i.test(trimmed)) {
    return REDACTED_VALUE;
  }

  if (trimmed.startsWith('data:')) {
    return 'data:<redacted>';
  }

  if (trimmed.startsWith('blob:')) {
    try {
      const parsed = new URL(trimmed.slice('blob:'.length));
      return parsed.origin && parsed.origin !== 'null'
        ? `blob:${parsed.origin}/<redacted>`
        : 'blob:<redacted>';
    } catch {
      return 'blob:<redacted>';
    }
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.search || parsed.hash) {
      return `${parsed.origin}${parsed.pathname}${
        parsed.search ? '?<redacted>' : ''
      }${parsed.hash ? '#<redacted>' : ''}`;
    }
  } catch {
    // Not a URL; keep regular non-sensitive strings unchanged.
  }

  const assignmentMatch = trimmed.match(/^([^:=\s][^:=]*?)([:=])\s*(.+)$/);
  if (assignmentMatch) {
    const [, key, separator, assignedValue] = assignmentMatch;
    if (isSensitiveMcpArgumentKey(key)) {
      return `${key}${separator}${REDACTED_VALUE}`;
    }

    const redactedAssignedValue: string = redactStringForMcpLog(assignedValue);
    if (redactedAssignedValue !== assignedValue) {
      return `${key}${separator}${redactedAssignedValue}`;
    }
  }

  return value;
};

const redactMcpProcessArgs = (args: string[]) => {
  const redactedArgs: string[] = [];
  let redactNext = false;

  for (const arg of args) {
    if (redactNext) {
      redactedArgs.push(REDACTED_VALUE);
      redactNext = false;
      continue;
    }

    const assignmentIndex = arg.indexOf('=');
    const argName = assignmentIndex >= 0 ? arg.slice(0, assignmentIndex) : arg;
    if (argName.startsWith('-') && isSensitiveMcpArgumentKey(argName)) {
      if (assignmentIndex >= 0) {
        redactedArgs.push(`${argName}=${REDACTED_VALUE}`);
      } else {
        redactedArgs.push(arg);
        redactNext = true;
      }
      continue;
    }

    redactedArgs.push(redactStringForMcpLog(arg));
  }

  return redactedArgs;
};

export const formatMcpCommandForLog = (command: string, args: string[]) =>
  [command, ...redactMcpProcessArgs(args)].filter(Boolean).join(' ');

export const redactMcpLogMessage = (value: unknown) => {
  let message =
    value instanceof Error
      ? value.message
      : typeof value === 'string'
        ? value
        : String(value);

  message = message.replace(/https?:\/\/[^\s"'<>]+/gi, (match) =>
    redactStringForMcpLog(match)
  );
  message = message.replace(/\bdata:\S+/gi, () => 'data:<redacted>');
  message = message.replace(/\bblob:[^\s"'<>]+/gi, (match) =>
    redactStringForMcpLog(match)
  );
  message = message.replace(
    /\b(Bearer|Basic)\s+[^\s,;]+/gi,
    (_match, scheme: string) => `${scheme} ${REDACTED_VALUE}`
  );
  message = message.replace(
    /\b([A-Za-z0-9_.-]*(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|secret[_-]?key|credential|authorization|cookie|session)[A-Za-z0-9_.-]*)\s*([:=])\s*([^\s,;]+)/gi,
    (_match, key: string, separator: string) =>
      `${key}${separator}${REDACTED_VALUE}`
  );

  return message;
};

const redactMcpToolArgs = (
  value: unknown,
  seen = new WeakSet<object>()
): unknown => {
  if (value == null) {
    return value;
  }
  if (typeof value === 'string') {
    return redactStringForMcpLog(value);
  }
  if (typeof value !== 'object') {
    return value;
  }
  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactMcpToolArgs(item, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    result[key] = isSensitiveMcpArgumentKey(key)
      ? REDACTED_VALUE
      : redactMcpToolArgs(item, seen);
  }
  return result;
};

export const formatMcpToolArgsForLog = (args: unknown) => {
  try {
    return JSON.stringify(redactMcpToolArgs(args));
  } catch {
    return '[unserializable]';
  }
};
