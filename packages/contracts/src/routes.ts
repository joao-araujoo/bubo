import { z } from 'zod';

import { catalogBookResponseSchema, catalogSearchResponseSchema } from './catalog';
import { errorResponseSchema } from './errors';
import { healthResponseSchema, readyResponseSchema } from './health';
import {
  meResponseSchema,
  onboardingRequestSchema,
  shelfEntrySchema,
  shelfResponseSchema,
} from './me';
import {
  createCardRequestSchema,
  dueCardsResponseSchema,
  recallCardSchema,
  reviewRequestSchema,
} from './recall';
import {
  addBookRequestSchema,
  createSessionRequestSchema,
  reviewResultSchema,
  sessionResultSchema,
  shelfEntryDetailSchema,
  statsResponseSchema,
  updateShelfEntryRequestSchema,
} from './shelf';

export const deleteResponseSchema = z.object({ deleted: z.literal(true) });

/** Paths relative to the `/v1` prefix. */
export const API_ROUTES = {
  health: '/health',
  ready: '/ready',
  openapi: '/openapi.json',
  /** Better Auth handler (sign-up, sign-in, sign-out, session, password reset). */
  auth: '/auth',
  me: '/me',
  onboarding: '/me/onboarding',
  stats: '/me/stats',
  shelf: '/shelf',
  shelfEntry: '/shelf/:id',
  sessions: '/sessions',
  recallDue: '/recall/due',
  recallCards: '/recall/cards',
  recallCard: '/recall/cards/:id',
  recallReview: '/recall/cards/:id/review',
  catalogSearch: '/catalog/search',
  catalogBook: '/catalog/books/:catalogId',
  catalogIsbn: '/catalog/isbn/:isbn',
  /** Better Auth account deletion lives at /v1/auth/delete-user (documented, not in the registry). */
} as const;

/** Fills `:param` placeholders, e.g. `apiPath(API_ROUTES.shelfEntry, { id })`. */
export function apiPath(template: string, params: Record<string, string>): string {
  return template.replace(/:(\w+)/g, (_, key: string) => {
    const value = params[key];
    if (value === undefined) throw new Error(`Missing route param "${key}" for ${template}`);
    return encodeURIComponent(value);
  });
}

export type ApiRouteDefinition = {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  summary: string;
  tags: string[];
  /** Requires a Better Auth session cookie. */
  auth: boolean;
  requestBody?: z.ZodType;
  responses: Record<number, { description: string; schema: z.ZodType }>;
};

/** Registry used to generate the OpenAPI document. Add every new route here. */
export const API_ROUTE_DEFINITIONS: ApiRouteDefinition[] = [
  {
    method: 'get',
    path: API_ROUTES.health,
    summary: 'Liveness probe (no database access).',
    tags: ['system'],
    auth: false,
    responses: { 200: { description: 'Service is alive.', schema: healthResponseSchema } },
  },
  {
    method: 'get',
    path: API_ROUTES.ready,
    summary: 'Readiness probe (configuration + database connectivity).',
    tags: ['system'],
    auth: false,
    responses: {
      200: { description: 'Ready to serve traffic.', schema: readyResponseSchema },
      503: { description: 'A dependency is not ready.', schema: readyResponseSchema },
    },
  },
  {
    method: 'get',
    path: API_ROUTES.me,
    summary: 'The signed-in reader and onboarding state.',
    tags: ['me'],
    auth: true,
    responses: { 200: { description: 'Current reader.', schema: meResponseSchema } },
  },
  {
    method: 'put',
    path: API_ROUTES.onboarding,
    summary: 'Save onboarding answers (habit, goals, interests, optional first book).',
    tags: ['me'],
    auth: true,
    requestBody: onboardingRequestSchema,
    responses: { 200: { description: 'Onboarding completed.', schema: meResponseSchema } },
  },
  {
    method: 'get',
    path: API_ROUTES.stats,
    summary: 'Reading stats from real sessions (XP, streak, this week). Query: today=YYYY-MM-DD.',
    tags: ['me'],
    auth: true,
    responses: { 200: { description: 'Stats.', schema: statsResponseSchema } },
  },
  {
    method: 'get',
    path: API_ROUTES.shelf,
    summary: "The reader's shelf.",
    tags: ['shelf'],
    auth: true,
    responses: { 200: { description: 'Shelf entries.', schema: shelfResponseSchema } },
  },
  {
    method: 'post',
    path: API_ROUTES.shelf,
    summary: 'Add a book to the shelf: a catalog pick ({catalogId}) or a manual entry.',
    tags: ['shelf'],
    auth: true,
    requestBody: addBookRequestSchema,
    responses: {
      201: { description: 'Created.', schema: shelfEntrySchema },
      409: { description: 'The book is already on the shelf.', schema: errorResponseSchema },
    },
  },
  {
    method: 'get',
    path: API_ROUTES.shelfEntry,
    summary: 'One shelf entry with its recent reading sessions.',
    tags: ['shelf'],
    auth: true,
    responses: { 200: { description: 'Entry.', schema: shelfEntryDetailSchema } },
  },
  {
    method: 'patch',
    path: API_ROUTES.shelfEntry,
    summary: 'Change status, current page or page count.',
    tags: ['shelf'],
    auth: true,
    requestBody: updateShelfEntryRequestSchema,
    responses: { 200: { description: 'Updated entry.', schema: shelfEntrySchema } },
  },
  {
    method: 'delete',
    path: API_ROUTES.shelfEntry,
    summary: 'Remove a book from the shelf (and its sessions).',
    tags: ['shelf'],
    auth: true,
    responses: { 200: { description: 'Removed.', schema: deleteResponseSchema } },
  },
  {
    method: 'post',
    path: API_ROUTES.sessions,
    summary: 'Record a finished focused reading session (updates progress, XP, streak).',
    tags: ['sessions'],
    auth: true,
    requestBody: createSessionRequestSchema,
    responses: { 201: { description: 'Session recorded.', schema: sessionResultSchema } },
  },
  {
    method: 'get',
    path: API_ROUTES.recallDue,
    summary: 'Recall cards due today or earlier. Query: today=YYYY-MM-DD.',
    tags: ['recall'],
    auth: true,
    responses: { 200: { description: 'Due cards.', schema: dueCardsResponseSchema } },
  },
  {
    method: 'post',
    path: API_ROUTES.recallCards,
    summary: 'Create a recall card for a book on the shelf.',
    tags: ['recall'],
    auth: true,
    requestBody: createCardRequestSchema,
    responses: { 201: { description: 'Created.', schema: recallCardSchema } },
  },
  {
    method: 'delete',
    path: API_ROUTES.recallCard,
    summary: 'Delete a recall card.',
    tags: ['recall'],
    auth: true,
    responses: { 200: { description: 'Deleted.', schema: deleteResponseSchema } },
  },
  {
    method: 'post',
    path: API_ROUTES.recallReview,
    summary: 'Grade a recall attempt (SM-2 reschedules the card). Idempotent on id.',
    tags: ['recall'],
    auth: true,
    requestBody: reviewRequestSchema,
    responses: {
      201: { description: 'Review recorded.', schema: reviewResultSchema },
      200: { description: 'Retry of an already recorded review.', schema: reviewResultSchema },
    },
  },
  {
    method: 'get',
    path: API_ROUTES.catalogSearch,
    summary: 'Search Google Books + Open Library (merged, de-duplicated). Query: q, limit.',
    tags: ['catalog'],
    auth: true,
    responses: {
      200: {
        description: 'Results (possibly partial, see sources).',
        schema: catalogSearchResponseSchema,
      },
      503: { description: 'Every catalog source failed.', schema: errorResponseSchema },
    },
  },
  {
    method: 'get',
    path: API_ROUTES.catalogBook,
    summary: 'One catalog book (details + cover candidates) and whether it is on the shelf.',
    tags: ['catalog'],
    auth: true,
    responses: {
      200: { description: 'Book.', schema: catalogBookResponseSchema },
      404: { description: 'Unknown catalog id.', schema: errorResponseSchema },
    },
  },
  {
    method: 'get',
    path: API_ROUTES.catalogIsbn,
    summary: 'Look up a book by ISBN-10/13 (barcode scanner).',
    tags: ['catalog'],
    auth: true,
    responses: {
      200: { description: 'Book.', schema: catalogBookResponseSchema },
      404: { description: 'No book with this ISBN.', schema: errorResponseSchema },
    },
  },
];
