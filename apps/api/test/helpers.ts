import { createTestServerBindings } from '@bubo/testing';

import { createMemoryBucket } from '../dev/memory-bucket';
import { type Bindings } from '../src/env';

export { createMemoryBucket };

export function createBindings(overrides: Record<string, string | undefined> = {}): Bindings {
  return { ...createTestServerBindings(overrides), MEDIA: createMemoryBucket() };
}

/** Collects log lines emitted by the app for assertions. */
export function createLogCollector() {
  const lines: string[] = [];
  return { lines, sink: (_level: string, line: string) => lines.push(line) };
}
