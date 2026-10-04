import { createSessionRequestSchema, sessionRecallSchema } from '@bubo/contracts';
import { MAX_REFLECTION_LENGTH, MAX_SESSION_SECONDS } from '@bubo/domain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

const stamp = z.number().int().nonnegative().max(8640000000000000);
const draftSchema = z.object({
  version: z.literal(1),
  id: z.uuid(),
  shelfEntryId: z.string().min(1),
  startedAt: stamp.nullable(),
  accumulatedMs: z
    .number()
    .min(0)
    .max(MAX_SESSION_SECONDS * 1000),
  runningSince: stamp.nullable(),
  endedAt: stamp.nullable(),
  page: z.string().max(10),
  reflection: z.string().max(MAX_REFLECTION_LENGTH),
  // Optional to preserve drafts created before the mandatory recall exercise.
  recall: sessionRecallSchema.optional(),
  // A new route option never changes a recovered draft's goal or timer.
  goalSeconds: z.literal(300).optional(),
  goalNoticeShown: z.boolean().optional(),
  submission: createSessionRequestSchema.nullable(),
});
export type SessionDraft = z.infer<typeof draftSchema>;
export type SessionDraftUpdate = SessionDraft | ((current: SessionDraft) => SessionDraft);
export type SessionDraftPersist = (update: SessionDraftUpdate) => Promise<void>;
const key = (userId: string) => `bubo.session-draft.v1.${userId}`;

// Serialize writes and removal so an older autosave cannot resurrect a discarded draft.
let writes: Promise<void> = Promise.resolve();
function enqueue(action: () => Promise<void>) {
  const next = writes.catch(() => undefined).then(action);
  writes = next;
  return next;
}

export async function readSessionDraft(userId: string): Promise<SessionDraft | null> {
  await writes.catch(() => undefined);
  const raw = await AsyncStorage.getItem(key(userId));
  if (!raw) return null;
  const result = draftSchema.safeParse(JSON.parse(raw) as unknown);
  if (!result.success) throw new Error('Invalid session draft');
  return result.data;
}

export function writeSessionDraft(userId: string, draft: SessionDraft) {
  const serialized = JSON.stringify(draftSchema.parse(draft));
  return enqueue(() => AsyncStorage.setItem(key(userId), serialized));
}

export function clearSessionDraft(userId: string, expectedDraftId?: string) {
  return enqueue(async () => {
    if (expectedDraftId) {
      const raw = await AsyncStorage.getItem(key(userId));
      if (raw && draftSchema.parse(JSON.parse(raw) as unknown).id !== expectedDraftId)
        throw new Error('Session draft changed');
    }
    await AsyncStorage.removeItem(key(userId));
  });
}

/** Resolve timer/notice changes in order; failed writes never become the current state. */
export function createSessionDraftPersistence(
  userId: string,
  initial: SessionDraft,
  onPersisted: (draft: SessionDraft) => void,
) {
  let current = initial;
  let operations: Promise<void> = Promise.resolve();

  function persist(update: SessionDraftUpdate) {
    const expectedId = current.id;
    const operation = operations
      .catch(() => undefined)
      .then(async () => {
        if (current.id !== expectedId) throw new Error('Session draft changed');
        const next = typeof update === 'function' ? update(current) : update;
        if (next.id !== current.id || next.shelfEntryId !== current.shelfEntryId)
          throw new Error('Session draft changed');
        await writeSessionDraft(userId, next);
        current = next;
        onPersisted(next);
      });
    operations = operation;
    return operation;
  }

  function discard(next: SessionDraft) {
    const operation = operations
      .catch(() => undefined)
      .then(async () => {
        await clearSessionDraft(userId, current.id);
        current = next;
        onPersisted(next);
      });
    operations = operation;
    return operation;
  }

  return { persist, discard };
}
