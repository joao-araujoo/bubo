# Environment variables

A template lives in `.env.example` at the root. Real values go in:

- `apps/api/.dev.vars`: local Worker secrets.
- `apps/mobile/.env`: public app values.

Both files are gitignored and excluded from the ZIP.

| variable              | where          | required                             | notes                                                                    |
| --------------------- | -------------- | ------------------------------------ | ------------------------------------------------------------------------ |
| `APP_ENV`             | API (`[vars]`) | no (default `development`)           | `development` \| `preview` \| `production`                               |
| `DATABASE_URL`        | API secret     | production                           | Neon pooled `postgres://` URL. Empty locally → `dev:api` uses PGlite     |
| `BETTER_AUTH_SECRET`  | API secret     | auth (any env)                       | ≥ 32 chars. Missing → auth and data routes return 503                    |
| `BETTER_AUTH_URL`     | API (`[vars]`) | production                           | public API origin used in auth links. In dev, use `http://<LAN-IP>:8787` |
| `GEMINI_API_KEY`      | API secret     | only for AI features                 | server-side only. Never in the app                                       |
| `GEMINI_MODEL`        | API (`[vars]`) | no (default `gemini-2.5-flash`)      |                                                                          |
| `EXPO_PUBLIC_API_URL` | mobile `.env`  | no (default `http://localhost:8787`) | embedded in the bundle, so it's **public**                               |

## Validation

- **API:** `@bubo/config` validates the Worker env on each request. Invalid config never crashes
  `/v1/health`. `/v1/ready` reports the offending variable _names_, never their values.
- **Mobile:** `src/lib/config.ts`. It throws in development on an invalid URL and falls back to
  the default in production.

## Rules

- `.env.example` and `*.example` files are committed templates. `npm run audit:repo` **fails** if
  any secret variable in them has a value.
- Real values live only in the gitignored files above.

## Remote secrets

Not configured yet. When the time comes, run `wrangler secret put <NAME> --env production` as a
reviewed release step.
