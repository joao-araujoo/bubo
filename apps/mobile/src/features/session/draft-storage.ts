import { createSessionRequestSchema } from '@bubo/contracts';
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
  submission: createSessionRequestSchema.nullable(),
});
export type SessionDraft = z.infer<typeof draftSchema>;
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

export function clearSessionDraft(userId: string) {
  return enqueue(() => AsyncStorage.removeItem(key(userId)));
}
