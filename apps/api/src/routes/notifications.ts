import {
  API_ROUTES,
  markNotificationsReadSchema,
  pushTokenRequestSchema,
  readerPreferencesSchema,
} from '@bubo/contracts';
import { type Context, Hono } from 'hono';

import { type AppEnv } from '../env';
import { createRateLimiter } from '../lib/rate-limit';
import { parseJsonBody } from '../lib/validation';
import { listNotifications, markNotificationsRead } from '../services/notifications';
import { getPreferences, savePreferences } from '../services/preferences';
import { registerPushToken, removePushToken } from '../services/push';

const readerId = (c: Context<AppEnv>) => c.get('session').user.id;

/** Task 09 (ADR-022): preferences, this device's push token and the notification inbox. */
export function notificationRoutes(deps: { now: () => Date }) {
  const routes = new Hono<AppEnv>();
  const writes = createRateLimiter({
    limit: 30,
    windowMs: 60_000,
    now: () => deps.now().getTime(),
    message: 'Too many changes in a short time. Try again in a moment.',
  });

  routes.get(API_ROUTES.preferences, async (c) =>
    c.json(await getPreferences(c.get('db'), readerId(c))),
  );

  routes.put(API_ROUTES.preferences, async (c) => {
    writes.hit(readerId(c));
    const input = await parseJsonBody(c, readerPreferencesSchema);
    return c.json(await savePreferences(c.get('db'), readerId(c), input));
  });

  routes.post(API_ROUTES.pushToken, async (c) => {
    writes.hit(readerId(c));
    const input = await parseJsonBody(c, pushTokenRequestSchema);
    await registerPushToken(c.get('db'), readerId(c), input);
    // The token itself is never logged.
    c.get('logger').info('push token registered', {
      userId: readerId(c),
      platform: input.platform,
    });
    return c.json({ registered: true });
  });

  routes.delete(API_ROUTES.pushTokenItem, async (c) => {
    await removePushToken(c.get('db'), readerId(c), c.req.param('token'));
    return c.json({ registered: false });
  });

  routes.get(API_ROUTES.notifications, async (c) =>
    c.json(await listNotifications(c.get('db'), readerId(c))),
  );

  routes.post(API_ROUTES.notificationsRead, async (c) => {
    const input = await parseJsonBody(c, markNotificationsReadSchema);
    return c.json(await markNotificationsRead(c.get('db'), readerId(c), input, deps.now()));
  });

  return routes;
}
