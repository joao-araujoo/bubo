import { API_ROUTES, onboardingRequestSchema, statsQuerySchema } from '@bubo/contracts';
import { Hono } from 'hono';

import { type AppEnv } from '../env';
import { AppError } from '../lib/errors';
import { parseJsonBody } from '../lib/validation';
import { type CatalogProvider, resolveCatalogBook } from './catalog';
import { completeOnboarding, getReaderProfile, toMeResponse } from '../services/reader';
import { getStats } from '../services/sessions';
import { getMemoryStats } from '../services/memory';
import { getAchievements } from '../services/achievements';

/** Session-protected reader routes (mounted behind withDatabase → withAuth → requireSession). */
export function readerRoutes(deps: { catalog: CatalogProvider }) {
  const routes = new Hono<AppEnv>();

  routes.get(API_ROUTES.memoryStats, async (c) => {
    const query = statsQuerySchema.safeParse({ today: c.req.query('today') });
    if (!query.success)
      throw new AppError('VALIDATION_FAILED', 'Query parameter "today" must be a calendar date.');
    return c.json(await getMemoryStats(c.get('db'), c.get('session').user.id, query.data.today));
  });

  routes.get(API_ROUTES.achievements, async (c) => {
    const query = statsQuerySchema.safeParse({ today: c.req.query('today') });
    if (!query.success)
      throw new AppError('VALIDATION_FAILED', 'Query parameter "today" must be a calendar date.');
    return c.json(await getAchievements(c.get('db'), c.get('session').user.id, query.data.today));
  });

  routes.get(API_ROUTES.me, async (c) => {
    const { user } = c.get('session');
    const profile = await getReaderProfile(c.get('db'), user.id);
    return c.json(toMeResponse(user, profile));
  });

  routes.put(API_ROUTES.onboarding, async (c) => {
    const { user } = c.get('session');
    const input = await parseJsonBody(c, onboardingRequestSchema);
    const pick = input.firstBook;
    // A catalog pick is resolved before the transaction (network), then saved atomically.
    const firstBook =
      pick && 'catalogId' in pick
        ? await resolveCatalogBook(deps.catalog(c), pick.catalogId)
        : pick;
    await completeOnboarding(c.get('db'), user.id, { ...input, firstBook });
    c.get('logger').info('onboarding completed', {
      userId: user.id,
      withFirstBook: input.firstBook !== null,
    });
    const profile = await getReaderProfile(c.get('db'), user.id);
    return c.json(toMeResponse(user, profile));
  });

  routes.get(API_ROUTES.stats, async (c) => {
    const { user } = c.get('session');
    const query = statsQuerySchema.safeParse({ today: c.req.query('today') });
    if (!query.success) {
      throw new AppError('VALIDATION_FAILED', 'Query parameter "today" must be YYYY-MM-DD.', {
        issues: [{ path: 'today', message: 'Must be a calendar date (YYYY-MM-DD).' }],
      });
    }
    return c.json(await getStats(c.get('db'), user.id, query.data.today));
  });

  return routes;
}
