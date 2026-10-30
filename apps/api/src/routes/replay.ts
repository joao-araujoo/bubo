import { API_ROUTES, replayQuerySchema } from '@bubo/contracts';
import { Hono } from 'hono';

import { type AppEnv } from '../env';
import { AppError } from '../lib/errors';
import { getReplay } from '../services/replay';

/** Mounted under /me/* behind withDatabase → withAuth → requireSession. */
export function replayRoutes(deps: { now: () => Date }) {
  const routes = new Hono<AppEnv>();
  routes.get(API_ROUTES.replay, async (c) => {
    const input = replayQuerySchema.safeParse({
      kind: c.req.query('kind'),
      year: c.req.query('year'),
      month: c.req.query('month'),
      timeZone: c.req.query('timeZone'),
    });
    if (!input.success)
      throw new AppError(
        'VALIDATION_FAILED',
        'Replay requires kind, year, IANA timeZone and month for monthly periods.',
      );
    c.header('cache-control', 'private, no-store');
    return c.json(await getReplay(c.get('db'), c.get('session').user.id, input.data, deps.now()));
  });
  return routes;
}
