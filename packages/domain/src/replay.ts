import { addDays } from './streak';

export type ReplayPeriodInput = {
  kind: 'month' | 'year';
  year: number;
  month?: number;
  timeZone: string;
};

export type ReplayPeriod = {
  kind: 'month' | 'year';
  year: number;
  month: number | null;
  startDate: string;
  endDate: string;
  timeZone: string;
  inProgress: boolean;
};

/** Require a named IANA zone (including UTC), never an unlabelled fixed device offset. */
export function isReplayTimeZone(value: string): boolean {
  if (value !== 'UTC' && !/^[A-Za-z_]+(?:\/[A-Za-z0-9_.+-]+)+$/.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function dateFormatter(timeZone: string) {
  return new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatDate(formatter: Intl.DateTimeFormat, date: Date): string {
  const parts = formatter.formatToParts(date);
  const part = (type: string) => parts.find((value) => value.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function toReplayLocalDate(date: Date, timeZone: string): string {
  return formatDate(dateFormatter(timeZone), date);
}

/** Leap years and future periods are resolved on the server clock in the requested zone. */
export function createReplayPeriod(input: ReplayPeriodInput, now: Date): ReplayPeriod {
  if (
    !isReplayTimeZone(input.timeZone) ||
    !Number.isInteger(input.year) ||
    input.year < 2020 ||
    input.year > 2100
  )
    throw new RangeError('Invalid Replay period.');
  if (
    input.kind === 'month' &&
    (!Number.isInteger(input.month) || (input.month ?? 0) < 1 || (input.month ?? 13) > 12)
  )
    throw new RangeError('Invalid Replay month.');
  if (input.kind === 'year' && input.month !== undefined)
    throw new RangeError('Annual Replay has no month.');
  const firstMonth = input.kind === 'month' ? (input.month ?? 1) : 1;
  const lastMonth = input.kind === 'month' ? firstMonth : 12;
  const startDate = `${input.year}-${String(firstMonth).padStart(2, '0')}-01`;
  const endDate = new Date(Date.UTC(input.year, lastMonth, 0)).toISOString().slice(0, 10);
  const today = toReplayLocalDate(now, input.timeZone);
  if (startDate > today) throw new RangeError('Replay cannot describe a future period.');
  return {
    kind: input.kind,
    year: input.year,
    month: input.kind === 'month' ? firstMonth : null,
    startDate,
    endDate,
    timeZone: input.timeZone,
    inProgress: today <= endDate,
  };
}

export type ReplaySessionInput = {
  id: string;
  shelfEntryId: string;
  startedAt: Date;
  endedAt: Date;
  focusedSeconds: number;
  startPage: number;
  endPage: number;
};

export type ReplayBookInput<T> = {
  shelfEntryId: string;
  book: T;
  author: string | null;
  firstReadAt: Date;
  lastReadAt: Date;
  completionAt: Date | null;
};

function longestStreak(dates: readonly string[]): number {
  let best = 0;
  let current = 0;
  let previous: string | null = null;
  for (const date of dates) {
    current = previous !== null && addDays(previous, 1) === date ? current + 1 : 1;
    best = Math.max(best, current);
    previous = date;
  }
  return best;
}

/** Pure aggregation. End time attributes the whole accepted session to one local day. */
export function computeReplay<T>(input: {
  period: ReplayPeriod;
  now: Date;
  firstSessionAt: Date | null;
  sessions: readonly ReplaySessionInput[];
  books: readonly ReplayBookInput<T>[];
}) {
  const { period } = input;
  const formatter = dateFormatter(period.timeZone);
  const hourFormatter = new Intl.DateTimeFormat('en', {
    timeZone: period.timeZone,
    hour: 'numeric',
    hourCycle: 'h23',
  });
  const localDate = (date: Date) => formatDate(formatter, date);
  const within = (date: string) => date >= period.startDate && date <= period.endDate;
  const booksById = new Map(input.books.map((book) => [book.shelfEntryId, book]));
  const unique = new Map(input.sessions.map((session) => [session.id, session]));
  const sessions = [...unique.values()]
    .filter(
      (session) =>
        session.endedAt <= input.now &&
        within(localDate(session.endedAt)) &&
        booksById.has(session.shelfEntryId),
    )
    .sort((a, b) => a.endedAt.getTime() - b.endedAt.getTime() || a.id.localeCompare(b.id));
  const sessionsFor = (id: string) => sessions.filter((session) => session.shelfEntryId === id);
  const pages = (session: ReplaySessionInput) => Math.max(0, session.endPage - session.startPage);
  const dates = [...new Set(sessions.map((session) => localDate(session.endedAt)))].sort();
  const books = input.books
    .filter((book) => sessions.some((session) => session.shelfEntryId === book.shelfEntryId))
    .map((item) => {
      const readings = sessionsFor(item.shelfEntryId);
      const firstReadDate = localDate(item.firstReadAt);
      const lastReadDate = localDate(item.lastReadAt);
      const completionDate = item.completionAt === null ? null : localDate(item.completionAt);
      return {
        shelfEntryId: item.shelfEntryId,
        book: item.book,
        pagesRead: readings.reduce((total, session) => total + pages(session), 0),
        focusedSeconds: readings.reduce((total, session) => total + session.focusedSeconds, 0),
        sessionsCount: readings.length,
        readingDays: new Set(readings.map((session) => localDate(session.endedAt))).size,
        firstReadDate,
        lastReadDate,
        startedInPeriod: within(firstReadDate),
        finishedInPeriod: completionDate !== null && within(completionDate),
        completionDate,
      };
    })
    .sort(
      (a, b) =>
        b.focusedSeconds - a.focusedSeconds ||
        b.pagesRead - a.pagesRead ||
        a.shelfEntryId.localeCompare(b.shelfEntryId),
    );
  const authorMap = new Map<
    string,
    {
      author: string;
      booksRead: number;
      pagesRead: number;
      focusedSeconds: number;
      sessionsCount: number;
    }
  >();
  for (const book of books) {
    const author = booksById.get(book.shelfEntryId)?.author?.trim();
    if (!author) continue;
    const key = author.toLocaleLowerCase('pt-BR');
    const entry = authorMap.get(key) ?? {
      author,
      booksRead: 0,
      pagesRead: 0,
      focusedSeconds: 0,
      sessionsCount: 0,
    };
    entry.booksRead += 1;
    entry.pagesRead += book.pagesRead;
    entry.focusedSeconds += book.focusedSeconds;
    entry.sessionsCount += book.sessionsCount;
    authorMap.set(key, entry);
  }
  const topAuthors = [...authorMap.values()]
    .sort(
      (a, b) =>
        b.focusedSeconds - a.focusedSeconds ||
        b.booksRead - a.booksRead ||
        a.author.localeCompare(b.author),
    )
    .slice(0, 5);
  const months = Array.from({ length: period.kind === 'year' ? 12 : 1 }, (_, index) => {
    const month = period.kind === 'year' ? index + 1 : (period.month ?? 1);
    const prefix = `${period.year}-${String(month).padStart(2, '0')}`;
    const readings = sessions.filter((session) => localDate(session.endedAt).startsWith(prefix));
    const bookIds = new Set(readings.map((session) => session.shelfEntryId));
    return {
      month,
      booksRead: bookIds.size,
      booksStarted: books.filter(
        (book) => bookIds.has(book.shelfEntryId) && book.firstReadDate.startsWith(prefix),
      ).length,
      booksFinished: books.filter(
        (book) => bookIds.has(book.shelfEntryId) && book.completionDate?.startsWith(prefix),
      ).length,
      pagesRead: readings.reduce((total, session) => total + pages(session), 0),
      focusedSeconds: readings.reduce((total, session) => total + session.focusedSeconds, 0),
      sessionsCount: readings.length,
      readingDays: new Set(readings.map((session) => localDate(session.endedAt))).size,
    };
  });
  const focusedSeconds = sessions.reduce((total, session) => total + session.focusedSeconds, 0);
  const hourCounts = new Map<number, number>();
  for (const session of sessions) {
    const hour = Number(hourFormatter.format(session.startedAt));
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
  }
  const hours = [...hourCounts].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const winner = hours[0];
  const favoriteHour =
    sessions.length >= 5 && winner && winner[1] > (hours[1]?.[1] ?? 0)
      ? { hour: winner[0], sessionsCount: winner[1] }
      : null;
  const longestSession = [...sessions].sort(
    (a, b) => b.focusedSeconds - a.focusedSeconds || a.id.localeCompare(b.id),
  )[0];
  const mostRead = [...books].sort(
    (a, b) =>
      b.sessionsCount - a.sessionsCount ||
      b.focusedSeconds - a.focusedSeconds ||
      a.shelfEntryId.localeCompare(b.shelfEntryId),
  )[0];
  const longestBook = books
    .filter((book) => book.finishedInPeriod && book.completionDate !== null)
    .map((book) => ({
      shelfEntryId: book.shelfEntryId,
      spanDays: Math.max(
        1,
        Math.round(
          (Date.parse(`${book.completionDate}T00:00:00Z`) -
            Date.parse(`${book.firstReadDate}T00:00:00Z`)) /
            86400000,
        ) + 1,
      ),
    }))
    .sort((a, b) => b.spanDays - a.spanDays || a.shelfEntryId.localeCompare(b.shelfEntryId))[0];
  const bestMonth = [...months].sort(
    (a, b) => b.focusedSeconds - a.focusedSeconds || b.pagesRead - a.pagesRead || a.month - b.month,
  )[0];
  const firstSessionDate = input.firstSessionAt === null ? null : localDate(input.firstSessionAt);
  return {
    generatedAt: input.now.toISOString(),
    period,
    coverage: {
      firstSessionDate,
      partialHistory: firstSessionDate === null || firstSessionDate > period.startDate,
      source: 'accepted_reading_sessions' as const,
    },
    totals: {
      booksRead: books.length,
      booksStarted: books.filter((book) => book.startedInPeriod).length,
      booksFinished: books.filter((book) => book.finishedInPeriod).length,
      pagesRead: sessions.reduce((total, session) => total + pages(session), 0),
      focusedSeconds,
      focusedMinutes: Math.floor(focusedSeconds / 60),
      sessionsCount: sessions.length,
      readingDays: dates.length,
      bestStreakDays: longestStreak(dates),
    },
    books,
    topAuthors,
    months,
    highlights: {
      mostReadBookId: mostRead && mostRead.sessionsCount >= 2 ? mostRead.shelfEntryId : null,
      favoriteHour,
      longestSession: longestSession
        ? {
            shelfEntryId: longestSession.shelfEntryId,
            focusedSeconds: longestSession.focusedSeconds,
            localDate: localDate(longestSession.endedAt),
          }
        : null,
      longestBook: longestBook ?? null,
      bestMonth: bestMonth && bestMonth.sessionsCount > 0 ? bestMonth.month : null,
    },
    unavailableDimensions: ['genres', 'quotations', 'bridges', 'reflections'] as (
      'genres' | 'quotations' | 'bridges' | 'reflections'
    )[],
  };
}
