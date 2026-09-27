export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFields = Record<string, unknown>;

export type Logger = {
  debug: (message: string, fields?: LogFields) => void;
  info: (message: string, fields?: LogFields) => void;
  warn: (message: string, fields?: LogFields) => void;
  error: (message: string, fields?: LogFields) => void;
  child: (fields: LogFields) => Logger;
};

export type LogSink = (level: LogLevel, line: string) => void;

const SENSITIVE_KEY = /(secret|token|password|authorization|cookie|api[-_]?key|database[-_]?url)/i;

/** Recursively replaces values of sensitive keys so secrets never reach the logs. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    out[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : redact(inner, depth + 1);
  }
  return out;
}

const consoleSink: LogSink = (level, line) => {
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
};

/** Structured JSON logger (Workers Logs indexes JSON fields). */
export function createLogger(base: LogFields = {}, sink: LogSink = consoleSink): Logger {
  const write = (level: LogLevel, message: string, fields?: LogFields) => {
    const entry = redact({ level, message, time: new Date().toISOString(), ...base, ...fields });
    sink(level, JSON.stringify(entry));
  };
  return {
    debug: (message, fields) => write('debug', message, fields),
    info: (message, fields) => write('info', message, fields),
    warn: (message, fields) => write('warn', message, fields),
    error: (message, fields) => write('error', message, fields),
    child: (fields) => createLogger({ ...base, ...fields }, sink),
  };
}
