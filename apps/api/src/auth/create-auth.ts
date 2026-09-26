import { expo } from '@better-auth/expo';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import { authDatabase } from '../db';
import * as authSchema from '../db/auth-schema';
import {
  requireAuthRuntimeEnv,
  type AppBindings,
} from '../env';
import { sendPasswordResetEmail } from '../lib/auth-email';
import { ensureDomainUser } from '../repositories/domain-user-repository';
import { buildTrustedOrigins } from './trusted-origins';

type WaitUntil = (promise: Promise<unknown>) => void;

export function createAuth(
  bindings: AppBindings,
  waitUntil?: WaitUntil,
) {
  const env = requireAuthRuntimeEnv(bindings);
  const db = authDatabase(env.DATABASE_URL);

  return betterAuth({
    appName: 'Bubo',
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: authSchema,
    }),
    plugins: [expo()],
    trustedOrigins: buildTrustedOrigins(env),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        const task = sendPasswordResetEmail(env, {
          to: user.email,
          url,
        });

        if (waitUntil) {
          waitUntil(task);
          return;
        }

        await task;
      },
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      customRules: {
        '/sign-in/email': { window: 60, max: 8 },
        '/request-password-reset': { window: 300, max: 3 },
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await ensureDomainUser(env.DATABASE_URL, {
              id: user.id,
              name: user.name,
            });
          },
        },
      },
    },
    advanced: {
      database: {
        joins: true,
      },
      ...(waitUntil
        ? {
            backgroundTasks: {
              handler: waitUntil,
            },
          }
        : {}),
    },
  });
}
