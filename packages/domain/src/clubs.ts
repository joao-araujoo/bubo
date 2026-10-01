/**
 * Club rules added in Task 08 (ADR-020): polls, reactions, invites, member distribution and
 * memory breakdowns. Pure and tested; the API applies them, the app only displays the result.
 */

// ---------------------------------------------------------------------------------------------
// Topics and reactions
// ---------------------------------------------------------------------------------------------

/** Stitch "Tipo de discussão". `discussion` is the default for topics created before Task 08. */
export const TOPIC_KINDS = [
  'discussion',
  'philosophical',
  'worldbuilding',
  'character',
  'question',
] as const;
export type TopicKind = (typeof TOPIC_KINDS)[number];

/** Stitch reaction pills: "Fez pensar", "Novo ponto", "Bom contraponto". */
export const REACTION_KINDS = ['insight', 'idea', 'counterpoint'] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

// ---------------------------------------------------------------------------------------------
// Polls
// ---------------------------------------------------------------------------------------------

export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 4;
export const POLL_DURATIONS_DAYS = [3, 7] as const;

export function pollClosesAt(createdAt: Date, durationDays: number): Date {
  return new Date(createdAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
}

export function isPollOpen(closesAt: Date, now: Date): boolean {
  return now.getTime() < closesAt.getTime();
}

/** Results are shown after voting, after closing, or to the poll's author (no herd effect). */
export function canSeePollResults(input: {
  hasVoted: boolean;
  isOpen: boolean;
  isAuthor: boolean;
}): boolean {
  return input.hasVoted || !input.isOpen || input.isAuthor;
}

/**
 * Whole percentages that always add up to 100 (largest remainder), or all zeros without votes.
 * Ties keep the options' order, so the output is deterministic.
 */
export function pollPercentages(counts: readonly number[]): number[] {
  const total = counts.reduce((sum, n) => sum + Math.max(0, n), 0);
  if (total === 0) return counts.map(() => 0);
  const exact = counts.map((n) => (Math.max(0, n) / total) * 100);
  const floors = exact.map(Math.floor);
  let remaining = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of order) {
    if (remaining <= 0) break;
    floors[index] = (floors[index] ?? 0) + 1;
    remaining -= 1;
  }
  return floors;
}

// ---------------------------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------------------------

/** Unambiguous alphabet (no 0/O, 1/I/L): easy to read aloud or type from a screenshot. */
export const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 8;

/** Accepts "abcd-2345", " ABCD 2345 " or a bubo:// link; returns the bare code or null. */
export function normalizeInviteCode(input: string): string | null {
  const tail = input.trim().split('/').pop() ?? '';
  const code = tail.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== INVITE_CODE_LENGTH) return null;
  for (const char of code) if (!INVITE_ALPHABET.includes(char)) return null;
  return code;
}

/** "ABCD2345" → "ABCD-2345" for display. */
export function formatInviteCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** Builds a code from random bytes (the caller supplies crypto-quality randomness). */
export function inviteCodeFromBytes(bytes: Uint8Array): string {
  if (bytes.length < INVITE_CODE_LENGTH) throw new Error('Not enough random bytes');
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    code += INVITE_ALPHABET[(bytes[i] ?? 0) % INVITE_ALPHABET.length];
  }
  return code;
}

// ---------------------------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------------------------

export type PageBucket = { from: number; to: number; count: number };

/**
 * Stitch "Distribuição por página da obra": four equal page ranges of the book and how many members
 * are in each (a member at page 0 counts in the first range). Empty without a page count.
 */
export function pageBuckets(totalPages: number | null, pages: readonly number[]): PageBucket[] {
  if (!totalPages || totalPages < 4) return [];
  const size = Math.ceil(totalPages / 4);
  const buckets: PageBucket[] = [0, 1, 2, 3].map((i) => ({
    from: i * size + 1,
    to: Math.min(totalPages, (i + 1) * size),
    count: 0,
  }));
  for (const page of pages) {
    const clamped = Math.min(Math.max(page, 1), totalPages);
    const index = Math.min(3, Math.floor((clamped - 1) / size));
    const bucket = buckets[index];
    if (bucket) bucket.count += 1;
  }
  return buckets;
}

// ---------------------------------------------------------------------------------------------
// Memory breakdowns ("Minha memória")
// ---------------------------------------------------------------------------------------------

export const MEMORY_PERIODS = [7, 30, 90, 365] as const;
export type MemoryPeriod = (typeof MEMORY_PERIODS)[number];

export const DAY_PARTS = ['morning', 'afternoon', 'evening', 'dawn'] as const;
export type DayPart = (typeof DAY_PARTS)[number];

/** Madrugada 0–5 h, manhã 6–11 h, tarde 12–17 h, noite 18–23 h (reader's local hour). */
export function dayPartOf(hour: number): DayPart {
  if (hour < 6) return 'dawn';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

export type RecallStrength = 'firm' | 'building' | 'fragile' | 'unknown';

/**
 * Label for the share of attempts graded "Lembrei" on a book. Needs 3+ attempts to say anything;
 * it describes the reader's own grades, not measured retention.
 */
export function recallStrength(remembered: number, total: number): RecallStrength {
  if (total < 3) return 'unknown';
  const share = remembered / total;
  if (share >= 0.75) return 'firm';
  if (share >= 0.4) return 'building';
  return 'fragile';
}
