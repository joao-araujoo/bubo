import {
  API_ROUTES,
  createCardRequestSchema,
  reviewRequestSchema,
  statsQuerySchema,
} from '@bubo/contracts';
import { Hono } from 'hono';

import { type AppEnv } from '../env';
import { AppError } from '../lib/errors';
import { parseJsonBody } from '../lib/validation';
import { createCard, deleteCard, listDueCards, reviewCard } from '../services/recall';

/** Active recall + spaced review (session-protected; scoped to the signed-in reader). */
export function recallRoutes(deps: { now: () => Date }) {
  const routes = new Hono<AppEnv>();

  routes.get(API_ROUTES.recallDue, async (c) => {
    const { user } = c.get('session');
    const query = statsQuerySchema.safeParse({ today: c.req.query('today') });
    if (!query.success) {
      throw new AppError('VALIDATION_FAILED', 'Query parameter "today" must be YYYY-MM-DD.', {
        issues: [{ path: 'today', message: 'Must be a calendar date (YYYY-MM-DD).' }],
      });
    }
    return c.json(await listDueCards(c.get('db'), user.id, query.data.today));
  });

  routes.post(API_ROUTES.recallCards, async (c) => {
    const { user } = c.get('session');
    const input = await parseJsonBody(c, createCardRequestSchema);
    return c.json(await createCard(c.get('db'), user.id, input, deps.now()), 201);
  });

  routes.delete(API_ROUTES.recallCard, async (c) => {
    const { user } = c.get('session');
    await deleteCard(c.get('db'), user.id, c.req.param('id'));
    return c.json({ deleted: true as const });
  });

  routes.post(API_ROUTES.recallReview, async (c) => {
    const { user } = c.get('session');
    const input = await parseJsonBody(c, reviewRequestSchema);
    const { result, created } = await reviewCard(
      c.get('db'),
      user.id,
      c.req.param('id'),
      input,
      deps.now(),
    );
    return c.json(result, created ? 201 : 200);
  });

  return routes;
}
