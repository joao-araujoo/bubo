import { AppError } from './errors';

/**
 * Small fixed-window limiter kept in isolate memory. It protects shared upstream quotas (catalog
 * sources) from a single noisy client; it is not a security boundary (isolates don't share it).
 */
export function createRateLimiter(options: {
  limit: number;
  windowMs: number;
  now?: () => number;
  maxKeys?: number;
  message?: string;
}) {
  const now = options.now ?? (() => Date.now());
  const maxKeys = options.maxKeys ?? 5000;
  const windows = new Map<string, { start: number; count: number }>();

  return {
    /** Counts one hit for `key`; throws RATE_LIMITED (429) once the window is full. */
    hit(key: string) {
      const time = now();
      const current = windows.get(key);
      if (!current || time - current.start >= options.windowMs) {
        windows.delete(key);
        windows.set(key, { start: time, count: 1 });
        while (windows.size > maxKeys) {
          const oldest = windows.keys().next().value;
          if (oldest === undefined) break;
          windows.delete(oldest);
        }
        return;
      }
      current.count += 1;
      if (current.count > options.limit) {
        throw new AppError(
          'RATE_LIMITED',
          options.message ?? 'Too many catalog requests. Try again in a moment.',
        );
      }
    },
  };
}
