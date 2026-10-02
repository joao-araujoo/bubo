import { buildWidgetSnapshot } from '@bubo/domain';
import { widgetSnapshotSchema } from '@bubo/contracts';
import { describe, expect, it, vi } from 'vitest';

import { createWidgetPublisher } from '../../mobile/src/features/widgets/publisher';

function snapshot(title = 'Meu livro') {
  const now = new Date(2026, 9, 1, 12);
  return widgetSnapshotSchema.parse(
    buildWidgetSnapshot({
      now,
      updatedAt: now.getTime(),
      hideBookOnLockScreen: true,
      weeklyGoal: 4,
      entries: [
        {
          id: 'mine',
          status: 'reading',
          currentPage: 1,
          book: { title, totalPages: 10, coverUrls: ['https://example.com/cover'] },
        },
      ],
      stats: {
        today: '2026-10-01',
        streakDays: 0,
        weekReadingDates: [],
        weekActiveDates: [],
        monthActiveDates: [],
        readToday: false,
        reviewedToday: false,
      },
      due: { today: '2026-10-01', cards: [], dueCount: 0, nextDueDate: null },
    }),
  );
}

describe('widget publication', () => {
  it('publishes page changes immediately and adds a cached cover later', async () => {
    const native = {
      update: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      requestPin: vi.fn(),
    };
    const publisher = createWidgetPublisher(native, async () => '/cached/cover');
    await publisher.publish(snapshot());
    expect(native.update.mock.calls.map((call) => call[1])).toEqual([null, '/cached/cover']);
    expect(JSON.parse(native.update.mock.calls[0]![0])).toMatchObject({
      book: { title: 'Meu livro' },
      hideBookOnLockScreen: true,
    });
  });
  it('does not resurrect data when a cover finishes downloading after sign-out', async () => {
    let complete: (path: string) => void = () => undefined;
    const downloading = new Promise<string>((resolve) => {
      complete = resolve;
    });
    const native = {
      update: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      requestPin: vi.fn(),
    };
    const publisher = createWidgetPublisher(native, () => downloading);
    const publishing = publisher.publish(snapshot());
    await vi.waitFor(() => expect(native.update).toHaveBeenCalledOnce());
    await publisher.clear();
    complete('/old-account-cover');
    await publishing;
    expect(native.clear).toHaveBeenCalledOnce();
    expect(native.update).toHaveBeenCalledOnce();
  });
  it('keeps the latest account when old async work finishes last', async () => {
    let complete: (path: string) => void = () => undefined;
    const firstCover = new Promise<string>((resolve) => {
      complete = resolve;
    });
    const native = {
      update: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      requestPin: vi.fn(),
    };
    const cover = vi.fn().mockReturnValueOnce(firstCover).mockResolvedValue('/new-cover');
    const publisher = createWidgetPublisher(native, cover);
    const first = publisher.publish(snapshot('Primeira conta'));
    await vi.waitFor(() => expect(cover).toHaveBeenCalledOnce());
    await publisher.clear();
    publisher.activate();
    await publisher.publish(snapshot('Nova conta'));
    complete('/old-cover');
    await first;
    const last = native.update.mock.calls.at(-1)!;
    expect(JSON.parse(last[0]).book.title).toBe('Nova conta');
    expect(last[1]).toBe('/new-cover');
  });
  it('recovers the serialized queue after native failure and ignores cover failure', async () => {
    const native = {
      update: vi.fn().mockRejectedValueOnce(new Error('storage')).mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      requestPin: vi.fn(),
    };
    const publisher = createWidgetPublisher(native, async () => {
      throw new Error('offline');
    });
    await expect(publisher.publish(snapshot())).rejects.toThrow('storage');
    await expect(publisher.clear()).resolves.toBeUndefined();
    publisher.activate();
    await expect(publisher.publish(snapshot())).resolves.toBeUndefined();
  });
  it('ignores a stale query observer publishing after logout until the new account activates', async () => {
    const native = {
      update: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
      requestPin: vi.fn(),
    };
    const publisher = createWidgetPublisher(native, async () => null);
    await publisher.clear();
    await publisher.publish(snapshot('Conta anterior'));
    expect(native.update).not.toHaveBeenCalled();
    publisher.activate();
    await publisher.publish(snapshot('Conta atual'));
    expect(JSON.parse(native.update.mock.calls[0]![0]).book.title).toBe('Conta atual');
  });
});
