import { beforeEach, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => {
  const rows = new Map<string, string>();
  return {
    rows,
    getItem: vi.fn(async (key: string) => rows.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      rows.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      rows.delete(key);
    }),
  };
});
vi.mock('@react-native-async-storage/async-storage', () => ({ default: storage }));
import {
  clearSessionDraft,
  readSessionDraft,
  writeSessionDraft,
  type SessionDraft,
} from '../../mobile/src/features/session/draft-storage';

const draft: SessionDraft = {
  version: 1,
  id: '00000000-0000-4000-8000-000000000001',
  shelfEntryId: 'book',
  startedAt: 1000,
  accumulatedMs: 60000,
  runningSince: null,
  endedAt: 61000,
  page: '10',
  reflection: 'Meu pensamento',
  submission: null,
};
beforeEach(() => {
  storage.rows.clear();
  vi.clearAllMocks();
});

it('restores the same id, elapsed time and reflection only for the owning account', async () => {
  await writeSessionDraft('a', draft);
  expect(await readSessionDraft('a')).toEqual(draft);
  expect(await readSessionDraft('b')).toBeNull();
});
it('serializes autosaves before removal so discard cannot resurrect old drafts', async () => {
  const first = writeSessionDraft('a', draft);
  const second = writeSessionDraft('a', { ...draft, reflection: 'Última versão' });
  const removed = clearSessionDraft('a');
  await Promise.all([first, second, removed]);
  expect(await readSessionDraft('a')).toBeNull();
});
it('preserves an exact pending submission across restart', async () => {
  const submission = {
    id: draft.id,
    shelfEntryId: 'book',
    startedAt: '2026-09-30T10:00:00.000Z',
    endedAt: '2026-09-30T10:01:00.000Z',
    focusedSeconds: 60,
    endPage: 10,
    reflection: 'Original',
    localDate: '2026-09-30',
  };
  await writeSessionDraft('a', { ...draft, submission });
  expect((await readSessionDraft('a'))?.submission).toEqual(submission);
});
it('surfaces failed writes and malformed drafts instead of claiming they were saved', async () => {
  storage.setItem.mockRejectedValueOnce(new Error('disk unavailable'));
  await expect(writeSessionDraft('a', draft)).rejects.toThrow('disk unavailable');
  await writeSessionDraft('a', draft);
  storage.rows.set('bubo.session-draft.v1.a', '{broken');
  await expect(readSessionDraft('a')).rejects.toThrow();
  await clearSessionDraft('a');
  expect(await readSessionDraft('a')).toBeNull();
});
