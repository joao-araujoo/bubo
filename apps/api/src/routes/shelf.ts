import {
  API_ROUTES,
  addBookRequestSchema,
  assessSessionRequestSchema,
  createSessionRequestSchema,
  updateShelfEntryRequestSchema,
} from '@bubo/contracts';
import { Hono } from 'hono';

import { type AppEnv } from '../env';
import { parseJsonBody } from '../lib/validation';
import { entryReviewTotals, listEntryCards, listEntryReviews } from '../services/recall';
import { listEntrySessions, recordSession } from '../services/sessions';
import { assessSessionExercise } from '../services/session-assessment';
import { GeminiService } from '../services/gemini';
import { type CatalogProvider, resolveCatalogBook } from './catalog';
import {
  addCatalogBook,
  addManualBook,
  deleteEntry,
  findEntry,
  listShelf,
  toShelfEntry,
  updateEntry,
} from '../services/shelf';

/** Shelf + reading sessions (session-protected; every query is scoped to the signed-in reader). */
export function shelfRoutes(deps: {
  now: () => Date;
  catalog: CatalogProvider;
  geminiFetch: typeof fetch;
}) {
  const routes = new Hono<AppEnv>();

  routes.get(API_ROUTES.shelf, async (c) => {
    const { user } = c.get('session');
    return c.json({ entries: await listShelf(c.get('db'), user.id) });
  });

  routes.post(API_ROUTES.shelf, async (c) => {
    const { user } = c.get('session');
    const input = await parseJsonBody(c, addBookRequestSchema);
    if ('catalogId' in input) {
      const book = await resolveCatalogBook(deps.catalog(c), input.catalogId);
      return c.json(await addCatalogBook(c.get('db'), user.id, book, input.status), 201);
    }
    return c.json(await addManualBook(c.get('db'), user.id, input), 201);
  });

  routes.get(API_ROUTES.shelfEntry, async (c) => {
    const { user } = c.get('session');
    const db = c.get('db');
    const { entry, book } = await findEntry(db, user.id, c.req.param('id'));
    return c.json({
      entry: toShelfEntry(entry, book),
      sessions: await listEntrySessions(db, user.id, entry.id),
      cards: await listEntryCards(db, user.id, entry.id, book.title),
      reviews: await listEntryReviews(db, user.id, entry.id),
      reviewTotals: await entryReviewTotals(db, user.id, entry.id),
    });
  });

  routes.patch(API_ROUTES.shelfEntry, async (c) => {
    const { user } = c.get('session');
    const patch = await parseJsonBody(c, updateShelfEntryRequestSchema);
    return c.json(await updateEntry(c.get('db'), user.id, c.req.param('id'), patch));
  });

  routes.delete(API_ROUTES.shelfEntry, async (c) => {
    const { user } = c.get('session');
    await deleteEntry(c.get('db'), user.id, c.req.param('id'));
    return c.json({ deleted: true as const });
  });

  routes.post(API_ROUTES.sessions, async (c) => {
    const { user } = c.get('session');
    const input = await parseJsonBody(c, createSessionRequestSchema);
    const { result, created } = await recordSession(c.get('db'), user.id, input, deps.now());
    if (created) {
      c.get('logger').info('reading session recorded', {
        userId: user.id,
        focusedSeconds: result.session.focusedSeconds,
        pagesRead: result.session.pagesRead,
      });
    }
    return c.json(result, created ? 201 : 200);
  });

  routes.post(API_ROUTES.sessionAssessment, async (c) => {
    const { user } = c.get('session');
    const input = await parseJsonBody(c, assessSessionRequestSchema);
    const db = c.get('db');
    await findEntry(db, user.id, input.shelfEntryId);
    const config = c.get('config');
    const gemini = new GeminiService({
      apiKey: config.ok ? config.env.GEMINI_API_KEY : undefined,
      model: config.ok ? config.env.GEMINI_MODEL : 'gemini-2.5-flash',
      fetch: deps.geminiFetch,
      timeoutMs: 8000,
    });
    c.header('Cache-Control', 'private, no-store');
    return c.json(
      await assessSessionExercise({
        db,
        userId: user.id,
        recall: input.recall,
        coach: input.coach,
        gemini,
        now: deps.now(),
      }),
    );
  });

  return routes;
}
