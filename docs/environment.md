# Environment variables

A template lives in `.env.example` at the root. Real values go in:

- `apps/api/.dev.vars`: local Worker secrets.
- `apps/mobile/.env`: public app values.

Both files are gitignored and excluded from the ZIP.

| variable                       | where             | required                             | notes                                                                                                                                        |
| ------------------------------ | ----------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_ENV`                      | API (`[vars]`)    | no (default `development`)           | `development` \| `preview` \| `production`                                                                                                   |
| `DATABASE_URL`                 | API secret        | production                           | Neon pooled `postgres://` URL. Empty locally → `dev:api` uses PGlite                                                                         |
| `BETTER_AUTH_SECRET`           | API secret        | auth (any env)                       | ≥ 32 chars. Missing → auth and data routes return 503                                                                                        |
| `BETTER_AUTH_URL`              | API (`[vars]`)    | production                           | public API origin used in auth links. In dev, use `http://<LAN-IP>:8787`                                                                     |
| `EMAIL_ART_BASE_URL`           | API (`.dev.vars`) | optional                             | https origin serving `/v1/email/art/*` (ADR-041); defaults to `BETTER_AUTH_URL`. Local `dev:api`: the production API, so inbox pictures load |
| `GEMINI_API_KEY`               | API secret        | only for AI features                 | server-side only. Never in the app                                                                                                           |
| `GEMINI_MODEL`                 | API (`[vars]`)    | no (default `gemini-2.5-flash`)      |                                                                                                                                              |
| `EXPO_PUBLIC_API_URL`          | mobile `.env`     | no (default `http://localhost:8787`) | embedded in the bundle, so it's **public**                                                                                                   |
| `EXPO_PUBLIC_INSTAGRAM_APP_ID` | mobile `.env`     | no; direct Stories handoff only      | real public Meta App ID (5–30 digits), never an App Secret/token; native build and Instagram required                                        |
| `EXPO_PUBLIC_SUPPORT_EMAIL`    | mobile `.env`     | no                                   | public contact shown in Configurações → Sobre and the legal screens (ADR-039); empty hides the row                                           |

## Validation

- **API:** `@bubo/config` validates the Worker env on each request. Invalid config never crashes
  `/v1/health`. `/v1/ready` reports the offending variable _names_, never their values.
- **Mobile:** `src/lib/config.ts`. It throws in development on an invalid URL and falls back to
  the default in production.

## Rules

Replay needs no new API secret. Native Stories capture/sharing/saving work independently of the
optional Instagram App ID. Missing or malformed IDs leave direct Instagram unavailable with
system sharing/saving alternatives. Expo Go cannot load the local native module; see
[replay.md](replay.md) and [CONFIGURAR.md](../CONFIGURAR.md) section 3.16.

- `.env.example` and `*.example` files are committed templates. `npm run audit:repo` **fails** if
  any secret variable in them has a value.
- Real values live only in the gitignored files above.

## Remote secrets

The recorded remote configuration is in [release.md](release.md) → **Current remote state**.
Changes use `wrangler secret put <NAME> --env production` as an authorized release step; the
Replay/Stories local implementation does not alter those secrets.
