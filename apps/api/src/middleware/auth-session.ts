import { createMiddleware } from 'hono/factory';
import { createAuth } from '../auth/create-auth';
import type { AppBindings } from '../env';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export type AppContext = {
  Bindings: AppBindings;
  Variables: {
    authUser: AuthUser;
  };
};

export const requireSession = createMiddleware<AppContext>(
  async (c, next) => {
    try {
      const auth = createAuth(
        c.env,
        (promise) => c.executionCtx.waitUntil(promise),
      );
      const session = await auth.api.getSession({
        headers: c.req.raw.headers,
      });

      if (!session) {
        return c.json(
          { code: 'UNAUTHORIZED', message: 'Faça login para continuar.' },
          401,
        );
      }

      c.set('authUser', {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      });

      await next();
    } catch (error) {
      console.error('[Bubo auth] session middleware failed', error);
      return c.json(
        {
          code: 'AUTH_UNAVAILABLE',
          message: 'A autenticação do Bubo está temporariamente indisponível.',
        },
        503,
      );
    }
  },
);
