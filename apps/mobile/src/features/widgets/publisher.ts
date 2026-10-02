import { type WidgetSnapshot } from '@bubo/contracts';

export type WidgetNative = {
  update: (json: string, coverPath: string | null) => Promise<void>;
  clear: () => Promise<void>;
  requestPin: (kind: string) => Promise<boolean>;
};

/** Serialize native writes and invalidate downloads so sign-out cannot resurrect a snapshot. */
export function createWidgetPublisher(
  native: WidgetNative,
  cover: (url: string) => Promise<string | null>,
  initiallyActive = true,
) {
  let generation = 0;
  let active = initiallyActive;
  let tail: Promise<void> = Promise.resolve();
  const enqueue = (task: () => Promise<void>) => {
    tail = tail.catch(() => undefined).then(task);
    return tail;
  };
  return {
    activate() {
      active = true;
    },
    async publish(snapshot: WidgetSnapshot) {
      if (!active) return;
      const ticket = ++generation;
      // Publish immediately: an unavailable cover must never hold up real page/count changes.
      await enqueue(async () => {
        if (ticket === generation) await native.update(JSON.stringify(snapshot), null);
      });
      if (!snapshot.book?.coverUrl || ticket !== generation) return;
      const coverPath = await cover(snapshot.book.coverUrl).catch(() => null);
      if (!coverPath || ticket !== generation) return;
      await enqueue(async () => {
        if (ticket === generation) await native.update(JSON.stringify(snapshot), coverPath);
      });
    },
    clear() {
      active = false;
      generation += 1;
      return enqueue(() => native.clear());
    },
  };
}
