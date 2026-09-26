import { CompleteOnboardingRequestSchema } from '@bubo/contracts';
import { Hono } from 'hono';
import { requireAuthRuntimeEnv } from '../env';
import {
  requireSession,
  type AppContext,
} from '../middleware/auth-session';
import { ensureDomainUser } from '../repositories/domain-user-repository';
import { persistCompletedOnboarding } from '../repositories/onboarding-repository';

export const onboardingRoutes = new Hono<AppContext>();

onboardingRoutes.put('/complete', requireSession, async (c) => {
  const payload = await c.req.json().catch(() => null);
  const parsed = CompleteOnboardingRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return c.json(
      {
        code: 'INVALID_ONBOARDING',
        message: 'Revise suas escolhas antes de concluir.',
      },
      400,
    );
  }

  const env = requireAuthRuntimeEnv(c.env);
  const user = c.get('authUser');

  await ensureDomainUser(env.DATABASE_URL, user);
  await persistCompletedOnboarding(
    env.DATABASE_URL,
    user.id,
    parsed.data,
  );

  return c.json({ completed: true });
});
