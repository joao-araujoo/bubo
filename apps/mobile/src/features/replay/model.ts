import { type Book, type ReplayResponse } from '@bubo/contracts';
import { type ReadingStatus, toReplayLocalDate } from '@bubo/domain';

export type ReplayChapter =
  'intro' | 'pages' | 'time' | 'books' | 'authors' | 'rhythm' | 'highlight' | 'summary';
export type StoryContent =
  | { kind: 'book'; book: Book; status: ReadingStatus; rating: number | null }
  | { kind: 'replay'; replay: ReplayResponse; chapter: ReplayChapter };

export const chapterLabels: Record<ReplayChapter, string> = {
  intro: 'A sua jornada',
  pages: 'Páginas',
  time: 'Tempo para ler',
  books: 'Seus livros',
  authors: 'Autores',
  rhythm: 'Seu ritmo',
  highlight: 'O livro reencontrado',
  summary: 'Tudo em uma página',
};

export function replayChapters(replay: ReplayResponse): ReplayChapter[] {
  if (replay.totals.sessionsCount === 0) return [];
  return [
    'intro',
    'pages',
    'time',
    'books',
    ...(replay.topAuthors.length ? ['authors' as const] : []),
    'rhythm',
    ...(replay.highlights.mostReadBookId ? ['highlight' as const] : []),
    'summary',
  ];
}

export const bookStoryLabels: Record<ReadingStatus, string> = {
  reading: 'LENDO AGORA',
  want_to_read: 'QUERO LER',
  finished: 'JÁ LI',
  paused: 'EM PAUSA',
  abandoned: 'DEIXEI DE LADO',
};

export function periodLabel(period: ReplayResponse['period']): string {
  if (period.kind === 'year') return String(period.year);
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(period.year, (period.month ?? 1) - 1, 1)));
}

export function shortMonth(month: number): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2024, month - 1, 1)))
    .replace('.', '');
}

export function storyNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

export function replaySnapshotLabel(replay: ReplayResponse): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: replay.period.timeZone,
  }).format(new Date(replay.generatedAt));
}

export function replayMonthIsFuture(
  period: ReplayResponse['period'],
  month: number,
  now: Date,
): boolean {
  return (
    `${period.year}-${String(month).padStart(2, '0')}` >
    toReplayLocalDate(now, period.timeZone).slice(0, 7)
  );
}

/** A preview is a composed card, never a serialization of the private reading-session model. */
export function storyBooks(content: StoryContent): Book[] {
  if (content.kind === 'book') return [content.book];
  if (content.chapter === 'highlight') {
    const book = content.replay.books.find(
      (b) => b.shelfEntryId === content.replay.highlights.mostReadBookId,
    );
    return book ? [book.book] : [];
  }
  if (['intro', 'books', 'summary'].includes(content.chapter)) {
    return content.replay.books.slice(0, content.chapter === 'books' ? 6 : 3).map((b) => b.book);
  }
  return [];
}
