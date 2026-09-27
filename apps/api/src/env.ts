import { type EnvParseResult, type ServerEnv } from '@bubo/config';
import { type Database } from '@bubo/database';

import { type Auth, type AuthSession } from './auth/auth';
import { type Logger } from './lib/logger';
import { type MediaBucket } from './services/media';

/** Raw Worker bindings (wrangler.toml [vars], secrets from .dev.vars / `wrangler secret`, R2). */
export type Bindings = {
  APP_ENV?: string;
  DATABASE_URL?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GOOGLE_BOOKS_API_KEY?: string;
  CATALOG_CONTACT_EMAIL?: string;
  MEDIA_PUBLIC_URL?: string;
  /** R2 bucket "bubo" (covers, avatars, uploads). */
  MEDIA: MediaBucket;
};

export type Variables = {
  requestId: string;
  logger: Logger;
  /** Validated configuration; `ok: false` keeps /health alive while /ready reports the issue. */
  config: EnvParseResult<ServerEnv>;
  /** Set by `withDatabase` for routes that need Postgres. */
  db: Database;
  /** Set by `withAuth`. */
  auth: Auth;
  /** Set by `requireSession`. */
  session: AuthSession;
};

export type AppEnv = { Bindings: Bindings; Variables: Variables };
