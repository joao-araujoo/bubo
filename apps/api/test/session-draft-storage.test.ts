import { beforeEach, expect, it, vi } from 'vitest';
import { newReadingGoal, pauseFocusClock, shouldShowReadingGoalNotice } from '@bubo/domain';

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
  createSessionDraftPersistence,
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
it('keeps the three recall fields and an exact pending submission through restart', async () => {
  const recall = {
    idea: 'A personagem escolhe partir apesar do medo.',
    detail: 'Ela guarda a carta e deixa a casa cedo.',
    connection: 'Isso lembra como coragem depende de agir com dúvida.',
  };
  const submission = {
    id: draft.id,
    shelfEntryId: draft.shelfEntryId,
    startedAt: '2026-09-30T10:00:00.000Z',
    endedAt: '2026-09-30T10:01:00.000Z',
    focusedSeconds: 60,
    endPage: 10,
    reflection: null,
    recall,
    localDate: '2026-09-30',
  };
  await writeSessionDraft('a', { ...draft, recall, submission });
  expect((await readSessionDraft('a'))?.recall).toEqual(recall);
  expect((await readSessionDraft('a'))?.submission).toEqual(submission);
  expect(await readSessionDraft('b')).toBeNull();
});
it('reads legacy drafts without inventing an approved recall exercise', async () => {
  storage.rows.set('bubo.session-draft.v1.a', JSON.stringify(draft));
  expect(await readSessionDraft('a')).toEqual(draft);
  expect((await readSessionDraft('a'))?.recall).toBeUndefined();
  expect((await readSessionDraft('a'))?.goalSeconds).toBeUndefined();
  expect((await readSessionDraft('a'))?.goalNoticeShown).toBeUndefined();
});
it('keeps the same session UUID when local cleanup fails and allows retrying cleanup', async () => {
  await writeSessionDraft('a', draft);
  storage.removeItem.mockRejectedValueOnce(new Error('disk unavailable'));
  await expect(clearSessionDraft('a')).rejects.toThrow('disk unavailable');
  expect((await readSessionDraft('a'))?.id).toBe(draft.id);
  await clearSessionDraft('a');
  expect(await readSessionDraft('a')).toBeNull();
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

it('recovers a five-minute goal with the same clock, UUID and completed notice for its account', async () => {
  const miniDraft = { ...draft, ...newReadingGoal('5'), goalNoticeShown: true };
  await writeSessionDraft('a', miniDraft);
  expect(await readSessionDraft('a')).toEqual(miniDraft);
  expect(await readSessionDraft('b')).toBeNull();
  expect(() =>
    writeSessionDraft('a', { ...miniDraft, goalSeconds: 600 } as unknown as SessionDraft),
  ).toThrow();
  expect(await readSessionDraft('a')).toEqual(miniDraft);
});

it('applies a notice to the latest paused clock instead of resurrecting a stale running snapshot', async () => {
  const running: SessionDraft = {
    ...draft,
    ...newReadingGoal('5'),
    runningSince: 1000,
    accumulatedMs: 0,
    endedAt: null,
  };
  const confirmed = vi.fn();
  const persistence = createSessionDraftPersistence('a', running, confirmed);
  const pause = persistence.persist((current) => ({
    ...current,
    ...pauseFocusClock(current, 301000),
  }));
  const notice = persistence.persist((current) =>
    shouldShowReadingGoalNotice(current, 301000) ? { ...current, goalNoticeShown: true } : current,
  );
  await Promise.all([pause, notice]);
  const recovered = await readSessionDraft('a');
  expect(recovered?.runningSince).toBeNull();
  expect(recovered?.accumulatedMs).toBe(300000);
  expect(recovered?.goalNoticeShown).toBe(true);
  expect(recovered?.endedAt).toBeNull();
  expect(recovered?.id).toBe(running.id);
  expect(confirmed).toHaveBeenCalledTimes(2);
});

it('keeps the notice when a subsequent timer transition is queued concurrently', async () => {
  const miniDraft = { ...draft, ...newReadingGoal('5'), accumulatedMs: 300000, endedAt: null };
  const persistence = createSessionDraftPersistence('a', miniDraft, vi.fn());
  const notice = persistence.persist((current) => ({ ...current, goalNoticeShown: true }));
  const finish = persistence.persist((current) => ({
    ...current,
    ...pauseFocusClock(current, 302000),
    endedAt: 302000,
  }));
  await Promise.all([notice, finish]);
  expect((await readSessionDraft('a'))?.goalNoticeShown).toBe(true);
  expect((await readSessionDraft('a'))?.endedAt).toBe(302000);
});

it('does not confirm a goal on write failure and resolves the retry from the last durable clock', async () => {
  const miniDraft = { ...draft, ...newReadingGoal('5'), endedAt: null };
  await writeSessionDraft('a', miniDraft);
  const confirmed = vi.fn();
  const persistence = createSessionDraftPersistence('a', miniDraft, confirmed);
  storage.setItem.mockRejectedValueOnce(new Error('disk unavailable'));
  await expect(
    persistence.persist((current) => ({
      ...current,
      goalNoticeShown: true,
      accumulatedMs: 300000,
    })),
  ).rejects.toThrow('disk unavailable');
  expect(confirmed).not.toHaveBeenCalled();
  expect(await readSessionDraft('a')).toEqual(miniDraft);
  let retryInput: SessionDraft | null = null;
  await persistence.persist((current) => {
    retryInput = current;
    return { ...current, accumulatedMs: 301000, goalNoticeShown: true };
  });
  expect(retryInput).toEqual(miniDraft);
  expect((await readSessionDraft('a'))?.goalNoticeShown).toBe(true);
  expect(confirmed).toHaveBeenCalledOnce();
});

it('discards after an in-flight goal update without reviving a persisted draft', async () => {
  const miniDraft = { ...draft, ...newReadingGoal('5'), endedAt: null };
  const fresh = { ...miniDraft, id: '00000000-0000-4000-8000-000000000002' };
  const confirmed = vi.fn();
  const persistence = createSessionDraftPersistence('a', miniDraft, confirmed);
  const notice = persistence.persist((current) => ({ ...current, goalNoticeShown: true }));
  const discard = persistence.discard(fresh);
  await Promise.all([notice, discard]);
  expect(await readSessionDraft('a')).toBeNull();
  expect(confirmed).toHaveBeenLastCalledWith(fresh);
});

it('does not discard another draft when a removed-book screen holds an old UUID', async () => {
  await writeSessionDraft('a', draft);
  await expect(clearSessionDraft('a', '00000000-0000-4000-8000-000000000002')).rejects.toThrow(
    'Session draft changed',
  );
  expect(await readSessionDraft('a')).toEqual(draft);
  await clearSessionDraft('a', draft.id);
  expect(await readSessionDraft('a')).toBeNull();
});

it('rejects late timer changes after discard instead of applying them to a new session', async () => {
  const miniDraft = { ...draft, ...newReadingGoal('5'), endedAt: null };
  const fresh = { ...miniDraft, id: '00000000-0000-4000-8000-000000000002' };
  await writeSessionDraft('a', miniDraft);
  const confirmed = vi.fn();
  const persistence = createSessionDraftPersistence('a', miniDraft, confirmed);
  const removal = persistence.discard(fresh);
  const lateChange = expect(
    persistence.persist((current) => ({ ...current, goalNoticeShown: true })),
  ).rejects.toThrow('Session draft changed');
  await Promise.all([removal, lateChange]);
  expect(await readSessionDraft('a')).toBeNull();
  expect(confirmed).toHaveBeenLastCalledWith(fresh);
  await expect(persistence.persist(miniDraft)).rejects.toThrow('Session draft changed');
  expect(await readSessionDraft('a')).toBeNull();
});
