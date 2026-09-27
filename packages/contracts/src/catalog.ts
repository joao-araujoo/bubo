import { CATALOG_ID_PATTERN, MAX_BOOK_PAGES } from '@bubo/domain';
import { z } from 'zod';

export const catalogIdSchema = z.string().regex(CATALOG_ID_PATTERN, 'Invalid catalog id.');
export const catalogSourceSchema = z.enum(['google', 'openlibrary', 'brasilapi']);
export const catalogSourceStatusSchema = z.enum(['ok', 'error', 'skipped']);

/** A book as returned by the catalog (merged from Google Books and Open Library). */
export const catalogBookSchema = z.object({
  catalogId: catalogIdSchema,
  title: z.string(),
  subtitle: z.string().nullable(),
  authors: z.array(z.string()),
  publisher: z.string().nullable(),
  publishedYear: z.number().int().nullable(),
  totalPages: z.number().int().min(1).max(MAX_BOOK_PAGES).nullable(),
  isbn13: z.string().nullable(),
  language: z.string().nullable(),
  description: z.string().nullable(),
  /** Ordered https candidates from allowlisted hosts. May be empty: clients draw a fallback. */
  coverUrls: z.array(z.url()),
  sources: z.array(catalogSourceSchema),
  match: z.enum(['exact', 'approximate']).optional(),
  edition: z.enum(['edition', 'work']).optional(),
  format: z.string().nullable().optional(),
  cachedCoverUrl: z.url().optional(),
});
export type CatalogBook = z.infer<typeof catalogBookSchema>;

export const catalogSearchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Type at least 2 characters.').max(120),
  limit: z.coerce.number().int().min(1).max(30).default(20),
});
export type CatalogSearchQuery = z.infer<typeof catalogSearchQuerySchema>;

/** GET /v1/catalog/search */
export const catalogSearchResponseSchema = z.object({
  query: z.string(),
  results: z.array(catalogBookSchema),
  /** Per-source status so clients can say "resultados parciais" honestly. */
  sources: z.object({
    google: catalogSourceStatusSchema,
    openlibrary: catalogSourceStatusSchema,
    brasilapi: catalogSourceStatusSchema.optional(),
  }),
});
export type CatalogSearchResponse = z.infer<typeof catalogSearchResponseSchema>;

/** GET /v1/catalog/books/:catalogId and GET /v1/catalog/isbn/:isbn */
export const catalogBookResponseSchema = z.object({
  book: catalogBookSchema,
  /** The reader's shelf entry for this book, when it is already on their shelf. */
  shelfEntryId: z.string().nullable(),
});
export type CatalogBookResponse = z.infer<typeof catalogBookResponseSchema>;
