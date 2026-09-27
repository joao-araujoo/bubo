import {
  type CatalogBook,
  type MeResponse,
  type NewBook,
  type OnboardingRequest,
  type ReaderProfile,
  meResponseSchema,
  readerProfileSchema,
} from '@bubo/contracts';
import { type Database, schema } from '@bubo/database';
import { uniqueSelection } from '@bubo/domain';
import { and, eq, or, sql } from 'drizzle-orm';

import { insertManualBook, upsertCatalogBook } from './shelf';

const { books, readerProfiles, shelfEntries } = schema;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
};

const EMPTY_PROFILE: ReaderProfile = {
  readingHabit: null,
  goals: [],
  interests: [],
  onboardingCompletedAt: null,
};

export async function getReaderProfile(db: Database, userId: string): Promise<ReaderProfile> {
  const [row] = await db
    .select()
    .from(readerProfiles)
    .where(eq(readerProfiles.userId, userId))
    .limit(1);
  if (!row) return EMPTY_PROFILE;
  // Validate at the boundary: the DB may hold values from older app versions.
  return readerProfileSchema.parse({
    readingHabit: row.readingHabit,
    goals: row.goals,
    interests: row.interests,
    onboardingCompletedAt: row.onboardingCompletedAt?.toISOString() ?? null,
  });
}

export function toMeResponse(user: SessionUser, profile: ReaderProfile): MeResponse {
  return meResponseSchema.parse({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image ?? null,
      createdAt: user.createdAt.toISOString(),
    },
    profile,
    onboardingCompleted: profile.onboardingCompletedAt !== null,
  });
}

/**
 * Saves onboarding answers atomically. Idempotent: re-submitting updates the answers, keeps the
 * original completion time and never duplicates the first book (matched by title, case-insensitive,
 * or by ISBN). A catalog pick arrives already resolved by the catalog service.
 */
export type OnboardingInput = Omit<OnboardingRequest, 'firstBook'> & {
  firstBook: NewBook | CatalogBook | null;
};

export async function completeOnboarding(db: Database, userId: string, input: OnboardingInput) {
  await db.transaction(async (tx) => {
    const goals = uniqueSelection(input.goals);
    const interests = uniqueSelection(input.interests);
    await tx
      .insert(readerProfiles)
      .values({
        userId,
        readingHabit: input.readingHabit,
        goals,
        interests,
        onboardingCompletedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: readerProfiles.userId,
        set: {
          readingHabit: input.readingHabit,
          goals,
          interests,
          onboardingCompletedAt: sql`coalesce(${readerProfiles.onboardingCompletedAt}, now())`,
          updatedAt: sql`now()`,
        },
      });

    const firstBook = input.firstBook;
    if (!firstBook) return;

    const isbn = 'catalogId' in firstBook ? firstBook.isbn13 : null;
    const [existing] = await tx
      .select({ id: shelfEntries.id })
      .from(shelfEntries)
      .innerJoin(books, eq(books.id, shelfEntries.bookId))
      .where(
        and(
          eq(shelfEntries.userId, userId),
          or(
            sql`lower(${books.title}) = lower(${firstBook.title})`,
            isbn ? eq(books.isbn, isbn) : undefined,
          ),
        ),
      )
      .limit(1);
    if (existing) return;

    const book =
      'catalogId' in firstBook
        ? await upsertCatalogBook(tx, firstBook)
        : await insertManualBook(tx, userId, firstBook);
    await tx.insert(shelfEntries).values({
      id: crypto.randomUUID(),
      userId,
      bookId: book.id,
      status: 'reading',
      currentPage: 0,
      startedAt: sql`now()`,
    });
  });
}
