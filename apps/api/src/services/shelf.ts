import {
  type CatalogBook,
  type NewBook,
  type ShelfEntry,
  type UpdateShelfEntryRequest,
  shelfEntrySchema,
} from '@bubo/contracts';
import { type Database, type Executor, schema } from '@bubo/database';
import {
  applyStatusChange,
  coverCandidates,
  hardenCoverUrl,
  type ReadingStatus,
  READING_STATUSES,
} from '@bubo/domain';
import { and, desc, eq, isNotNull, ne, or, sql } from 'drizzle-orm';

import { AppError } from '../lib/errors';

const { books, shelfEntries } = schema;

type EntryRow = typeof shelfEntries.$inferSelect;
type BookRow = typeof books.$inferSelect;

function asStatus(value: string): ReadingStatus {
  return (READING_STATUSES as readonly string[]).includes(value)
    ? (value as ReadingStatus)
    : 'want_to_read';
}

/** The reader's own page count (shared catalog books) wins over the book's. */
export function effectiveTotalPages(entry: EntryRow, book: BookRow): number | null {
  return entry.totalPages ?? book.totalPages;
}

export function toShelfEntry(entry: EntryRow, book: BookRow): ShelfEntry {
  return shelfEntrySchema.parse({
    id: entry.id,
    status: entry.status,
    currentPage: entry.currentPage,
    startedAt: entry.startedAt?.toISOString() ?? null,
    finishedAt: entry.finishedAt?.toISOString() ?? null,
    book: {
      id: book.id,
      title: book.title,
      author: book.author,
      totalPages: effectiveTotalPages(entry, book),
      catalogId: book.catalogKey,
      isbn13: book.isbn,
      publisher: book.publisher,
      publishedYear: book.publishedYear,
      coverUrls: [
        ...new Set([
          ...(book.coverUrl?.startsWith('https://') ? [book.coverUrl] : []),
          ...coverCandidates({ coverUrl: book.coverUrl, isbn13: book.isbn }),
        ]),
      ],
    },
  });
}

export async function listShelf(db: Database, userId: string): Promise<ShelfEntry[]> {
  const rows = await db
    .select({ entry: shelfEntries, book: books })
    .from(shelfEntries)
    .innerJoin(books, eq(books.id, shelfEntries.bookId))
    .where(eq(shelfEntries.userId, userId))
    .orderBy(desc(shelfEntries.updatedAt), desc(shelfEntries.createdAt));
  return rows.map(({ entry, book }) => toShelfEntry(entry, book));
}

/** A shelf entry owned by `userId` (never another reader's), or NOT_FOUND. */
export async function findEntry(db: Executor, userId: string, entryId: string) {
  const [row] = await db
    .select({ entry: shelfEntries, book: books })
    .from(shelfEntries)
    .innerJoin(books, eq(books.id, shelfEntries.bookId))
    .where(and(eq(shelfEntries.id, entryId), eq(shelfEntries.userId, userId)))
    .limit(1);
  if (!row) throw new AppError('NOT_FOUND', 'Book not found on your shelf.');
  return row;
}

type AddStatus = 'reading' | 'want_to_read';

/** Rejects a second copy of the same book (same row, same ISBN or same title, case-insensitive). */
async function assertNotShelved(
  tx: Executor,
  userId: string,
  book: {
    id?: string;
    isbn?: string | null;
    title: string;
    author?: string | null;
    catalogKey?: string | null;
  },
) {
  const [duplicate] = await tx
    .select({ id: shelfEntries.id })
    .from(shelfEntries)
    .innerJoin(books, eq(books.id, shelfEntries.bookId))
    .where(
      and(
        eq(shelfEntries.userId, userId),
        or(
          !book.catalogKey ? sql`lower(${books.title}) = lower(${book.title})` : undefined,
          book.id ? eq(books.id, book.id) : undefined,
          book.isbn ? eq(books.isbn, book.isbn) : undefined,
        ),
      ),
    )
    .limit(1);
  if (duplicate) throw new AppError('CONFLICT', 'This book is already on your shelf.');
}

async function insertEntry(tx: Executor, userId: string, book: BookRow, status: AddStatus) {
  const [entry] = await tx
    .insert(shelfEntries)
    .values({
      id: crypto.randomUUID(),
      userId,
      bookId: book.id,
      status,
      currentPage: 0,
      startedAt: status === 'reading' ? sql`now()` : null,
    })
    .returning();
  if (!entry) throw new AppError('INTERNAL_ERROR', 'Could not add the book.');
  return toShelfEntry(entry, book);
}

/** Inserts a book the reader typed in (owned by them). */
export async function insertManualBook(tx: Executor, userId: string, input: NewBook) {
  const [book] = await tx
    .insert(books)
    .values({
      id: crypto.randomUUID(),
      title: input.title,
      author: input.author ?? null,
      totalPages: input.totalPages ?? null,
      publisher: input.publisher ?? null,
      publishedYear: input.publishedYear ?? null,
      isbn: input.isbn ?? null,
      createdByUserId: userId,
    })
    .returning();
  if (!book) throw new AppError('INTERNAL_ERROR', 'Could not add the book.');
  return book;
}

/**
 * The shared row for a catalog book: reused by catalog id, then by ISBN-13, else inserted.
 * Metadata comes from the server-side catalog only (never from the client). Existing rows only
 * gain missing fields, so a later lookup can't rewrite what other readers already see.
 */
export async function upsertCatalogBook(tx: Executor, book: CatalogBook): Promise<BookRow> {
  const coverUrl = book.cachedCoverUrl ?? hardenCoverUrl(book.coverUrls[0]);
  const [existing] = await tx
    .select()
    .from(books)
    .where(
      and(
        isNotNull(books.catalogKey),
        or(
          eq(books.catalogKey, book.catalogId),
          book.isbn13 ? eq(books.isbn, book.isbn13) : undefined,
        ),
      ),
    )
    .orderBy(sql`(${books.catalogKey} = ${book.catalogId}) DESC`)
    .limit(1);
  if (existing) {
    if (!coverUrl || existing.coverUrl === coverUrl || (existing.coverUrl && !book.cachedCoverUrl))
      return existing;
    const [updated] = await tx
      .update(books)
      .set({ coverUrl })
      .where(eq(books.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  const author = book.authors.join(', ');
  await tx
    .insert(books)
    .values({
      id: crypto.randomUUID(),
      title: book.title.slice(0, 300),
      author: author ? author.slice(0, 200) : null,
      totalPages: book.totalPages,
      isbn: book.isbn13,
      createdByUserId: null,
      catalogKey: book.catalogId,
      coverUrl,
      publisher: book.publisher,
      publishedYear: book.publishedYear,
      description: book.description,
      language: book.language,
    })
    // A concurrent insert of the same catalog id wins; we read it back below.
    .onConflictDoNothing();
  const [row] = await tx.select().from(books).where(eq(books.catalogKey, book.catalogId)).limit(1);
  if (!row) throw new AppError('INTERNAL_ERROR', 'Could not save the book.');
  return row;
}

export async function addManualBook(
  db: Database,
  userId: string,
  input: NewBook & { status: AddStatus },
) {
  return db.transaction(async (tx) => {
    await assertNotShelved(tx, userId, {
      title: input.title,
      author: input.author,
      isbn: input.isbn ?? null,
    });
    const book = await insertManualBook(tx, userId, input);
    return insertEntry(tx, userId, book, input.status);
  });
}

export async function addCatalogBook(
  db: Database,
  userId: string,
  catalogBook: CatalogBook,
  status: AddStatus,
) {
  return db.transaction(async (tx) => {
    const book = await upsertCatalogBook(tx, catalogBook);
    await assertNotShelved(tx, userId, book);
    return insertEntry(tx, userId, book, status);
  });
}

/** The reader's entry for a catalog book (by catalog id or ISBN-13), if any. */
export async function findCatalogEntryId(
  db: Executor,
  userId: string,
  book: Pick<CatalogBook, 'catalogId' | 'isbn13'>,
): Promise<string | null> {
  const [row] = await db
    .select({ id: shelfEntries.id })
    .from(shelfEntries)
    .innerJoin(books, eq(books.id, shelfEntries.bookId))
    .where(
      and(
        eq(shelfEntries.userId, userId),
        or(
          eq(books.catalogKey, book.catalogId),
          book.isbn13 ? eq(books.isbn, book.isbn13) : undefined,
        ),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}
export async function updateEntry(
  db: Database,
  userId: string,
  entryId: string,
  patch: UpdateShelfEntryRequest,
) {
  return db.transaction(async (tx) => {
    const { entry, book } = await findEntry(tx, userId, entryId);

    // Manual books belong to their reader; shared catalog books keep a per-entry page count.
    const ownsBook = book.createdByUserId === userId && book.catalogKey === null;
    let totalPages = effectiveTotalPages(entry, book);
    if (patch.totalPages !== undefined) totalPages = patch.totalPages;
    let state = {
      status: asStatus(entry.status),
      currentPage: entry.currentPage,
      totalPages,
      startedAt: entry.startedAt,
      finishedAt: entry.finishedAt,
    };
    if (patch.currentPage !== undefined) state = { ...state, currentPage: patch.currentPage };
    if (patch.status !== undefined) state = applyStatusChange(state, patch.status, new Date());
    if (state.totalPages !== null && state.currentPage > state.totalPages) {
      throw new AppError('VALIDATION_FAILED', 'The current page is beyond the last page.', {
        issues: [{ path: 'currentPage', message: `Must be at most ${state.totalPages}.` }],
      });
    }

    const [updatedBook] =
      patch.totalPages !== undefined && ownsBook
        ? await tx.update(books).set({ totalPages }).where(eq(books.id, book.id)).returning()
        : [book];
    const [updatedEntry] = await tx
      .update(shelfEntries)
      .set({
        ...(patch.totalPages !== undefined && !ownsBook ? { totalPages } : {}),
        status: state.status,
        currentPage: state.currentPage,
        startedAt: state.startedAt,
        finishedAt: state.finishedAt,
      })
      .where(eq(shelfEntries.id, entry.id))
      .returning();
    if (!updatedEntry || !updatedBook)
      throw new AppError('INTERNAL_ERROR', 'Could not update the book.');
    return toShelfEntry(updatedEntry, updatedBook);
  });
}

/** Removes the entry (sessions cascade) and the reader's own manual book if nobody else shelves it. */
export async function deleteEntry(db: Database, userId: string, entryId: string) {
  await db.transaction(async (tx) => {
    const { entry, book } = await findEntry(tx, userId, entryId);
    await tx.delete(shelfEntries).where(eq(shelfEntries.id, entry.id));
    if (book.createdByUserId === userId) {
      const [other] = await tx
        .select({ id: shelfEntries.id })
        .from(shelfEntries)
        .where(and(eq(shelfEntries.bookId, book.id), ne(shelfEntries.userId, userId)))
        .limit(1);
      if (!other) await tx.delete(books).where(eq(books.id, book.id));
    }
  });
}
