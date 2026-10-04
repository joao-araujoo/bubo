import { DELAYED_RECALL_WINDOWS } from '@bubo/domain';
import { describe, expect, it } from 'vitest';

import { delayedRecallStatsSchema, memoryStatsResponseSchema } from '../src';

const windows = DELAYED_RECALL_WINDOWS.map((window) => ({ window, total: 0, remembered: 0 }));

describe('delayed recall contract', () => {
  it('accepts empty observations and defaults older API responses to an empty history', () => {
    const empty = { version: 'observed-v1', windows };
    expect(delayedRecallStatsSchema.parse(empty)).toEqual(empty);
    expect(
      memoryStatsResponseSchema.parse({
        days: Array.from({ length: 7 }, () => ({
          date: '2026-10-03',
          remembered: 0,
          almost: 0,
          forgot: 0,
        })),
      }).delayedRecall,
    ).toEqual(empty);
  });

  it('rejects inflated counts, missing or duplicate windows and unknown versions', () => {
    for (const candidate of [
      { version: 'observed-v2', windows },
      { version: 'observed-v1', windows: windows.slice(1) },
      { version: 'observed-v1', windows: [windows[0], windows[0], windows[2]] },
      {
        version: 'observed-v1',
        windows: [{ window: 'oneToSixDays', total: 1, remembered: 2 }, windows[1], windows[2]],
      },
      {
        version: 'observed-v1',
        windows: [{ window: 'oneToSixDays', total: -1, remembered: 0 }, windows[1], windows[2]],
      },
    ]) {
      expect(delayedRecallStatsSchema.safeParse(candidate).success).toBe(false);
    }
  });
});
