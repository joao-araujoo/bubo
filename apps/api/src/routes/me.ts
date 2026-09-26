import { Hono } from 'hono';
import { requireAuthRuntimeEnv } from '../env';
import {
  requireSession,
  type AppContext,
} from '../middleware/auth-session';
import { ensureDomainUser } from '../repositories/domain-user-repository';
import { readMe } from '../repositories/me-repository';

export const meRoutes = new Hono<AppContext>();

meRoutes.get('/', requireSession, async (c) => {
  const env = requireAuthRuntimeEnv(c.env);
  const user = c.get('authUser');

  await ensureDomainUser(env.DATABASE_URL, user);
  const me = await readMe(env.DATABASE_URL, user.id);

  return c.json({
    user,
    profile: {
      displayName: me.displayName,
      isPrivate: me.isPrivate,
      onboardingCompleted: me.onboardingCompleted,
    },
    settings: {
      theme: me.theme,
      reduceMotion: me.reduceMotion,
      hapticsEnabled: me.hapticsEnabled,
      soundsEnabled: me.soundsEnabled,
    },
    notifications: {
      pushEnabled: me.pushEnabled,
      readingReminders: me.readingReminders,
      reviewReminders: me.reviewReminders,
    },
  });
});
