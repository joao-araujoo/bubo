import { READING_RETURN_AFTER_DAYS } from './today';

/**
 * Bubo's e-mail program (ADR-038). Account and security e-mails are always sent; optional e-mails
 * need consent, real activity, a quiet local hour and a cooldown. Pure rules, shared by the API cron
 * and the app copy. The seven-day "away" threshold is the same one Hoje uses (today.ts).
 */

/** Digits in an e-mailed login or password-reset code. */
export const EMAIL_CODE_LENGTH = 6;
/** Minutes a code stays valid (also the window to finish a sign-in challenge). */
export const EMAIL_CODE_TTL_MINUTES = 10;
/** Days a device stays trusted after "Lembrar este aparelho". */
export const TRUSTED_DEVICE_DAYS = 30;

/** Minimum days between two reading-return e-mails to the same reader. */
export const READING_RETURN_COOLDOWN_DAYS = 30;
/** Local hour (0–23) at which the reading-return e-mail may go out. */
export const READING_RETURN_LOCAL_HOUR = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Keeps only digits, capped at the code length: "123 456" and "123-456" both become "123456". */
export function normalizeEmailCode(input: string): string {
  return input.replace(/\D/g, '').slice(0, EMAIL_CODE_LENGTH);
}

export function isCompleteEmailCode(input: string): boolean {
  return normalizeEmailCode(input).length === EMAIL_CODE_LENGTH;
}

/** Whole days elapsed between two instants (never negative). */
export function wholeDaysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}

export type ReadingReturnInput = {
  now: Date;
  /** Reader opted in to reading reminders by e-mail. */
  consent: boolean;
  /** The reader has a book with status "reading". */
  hasReadingBook: boolean;
  /** End of the most recent accepted reading session; null when the reader never read. */
  lastSessionEndedAt: Date | null;
  /** Last reading-return e-mail accepted by the provider; null when none was ever sent. */
  lastEmailAt: Date | null;
  /** Reader's current local hour (0–23). */
  localHour: number;
};

export type ReadingReturnDecision =
  | { eligible: true; daysAway: number }
  | {
      eligible: false;
      reason:
        | 'no_consent'
        | 'no_reading_book'
        | 'never_read'
        | 'read_recently'
        | 'cooldown'
        | 'wrong_hour';
    };

/**
 * Whether the reading-return e-mail may be sent now. Every condition is observable from recorded
 * activity: nothing is inferred and a reader who came back is never nudged.
 */
export function readingReturnDecision(input: ReadingReturnInput): ReadingReturnDecision {
  if (!input.consent) return { eligible: false, reason: 'no_consent' };
  if (!input.hasReadingBook) return { eligible: false, reason: 'no_reading_book' };
  if (!input.lastSessionEndedAt) return { eligible: false, reason: 'never_read' };
  const daysAway = wholeDaysBetween(input.lastSessionEndedAt, input.now);
  if (daysAway < READING_RETURN_AFTER_DAYS) return { eligible: false, reason: 'read_recently' };
  if (
    input.lastEmailAt &&
    wholeDaysBetween(input.lastEmailAt, input.now) < READING_RETURN_COOLDOWN_DAYS
  ) {
    return { eligible: false, reason: 'cooldown' };
  }
  if (input.localHour !== READING_RETURN_LOCAL_HOUR)
    return { eligible: false, reason: 'wrong_hour' };
  return { eligible: true, daysAway };
}
