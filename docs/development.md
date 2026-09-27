# Development

## Requirements

- Node **≥ 20.19**. Tested with Node 24.18.
- npm **≥ 10**. Tested with npm 11.16. **npm only**: no pnpm, Yarn or Bun.
- For devices: the Expo Go app, an Android emulator or the iOS simulator (macOS only).
- Windows, macOS and Linux are all supported. Every script is Node or npm, so it works in
  PowerShell, cmd and bash.

## First run

```sh
npm install                 # root only; installs every workspace
npm run doctor              # checks toolchain, deps, env files (never prints secrets)
cp apps/api/.dev.vars.example apps/api/.dev.vars       # PowerShell: Copy-Item …
cp apps/mobile/.env.example apps/mobile/.env
```

npm 11 blocks dependency install scripts by default. The root `package.json` allows only
`esbuild` and `workerd`, which Wrangler and Vitest need. If a new native dependency needs one,
review it and run `npm approve-scripts <pkg>`.

## Everyday commands (repo root)

| command                | what it does                                                         |
| ---------------------- | -------------------------------------------------------------------- |
| `npm run dev:mobile`   | Expo dev server (press `a` for Android, `i` for iOS, or scan the QR) |
| `npm run dev:api`      | Local API on `0.0.0.0:8787`. See "Local API modes" below.            |
| `npm run lint`         | ESLint (zero warnings)                                               |
| `npm run format`       | Prettier write                                                       |
| `npm run format:check` | Prettier check                                                       |
| `npm run typecheck`    | `tsc` in every workspace                                             |
| `npm run test`         | Vitest in every package and the API                                  |
| `npm run verify`       | all gates: format, lint, typecheck, test, assets:check, audit:repo   |
| `npm run doctor`       | environment diagnostics                                              |
| `npm run assets:build` | re-sync official assets and regenerate app copies                    |
| `npm run assets:check` | asset integrity + registry coverage                                  |
| `npm run audit:repo`   | repository policy audit                                              |
| `npm run package:zip`  | builds a ZIP of the repo (no deps, caches, local data or secrets)    |

Workspace-specific commands:

- `npm run config --workspace @bubo/mobile`: resolved Expo config.
- `npm run expo:check --workspace @bubo/mobile`: SDK version alignment.
- `npm run check:bundle --workspace @bubo/api`: Wrangler dry-run bundle. It never deploys.
- `npm run db:migrate --workspace @bubo/database`: needs `DATABASE_URL`. Apply migrations only
  deliberately.

## Local API modes (`npm run dev:api`)

| `apps/api/.dev.vars` | runtime                                            | database                                             |
| -------------------- | -------------------------------------------------- | ---------------------------------------------------- |
| `DATABASE_URL` empty | Node + `@hono/node-server` (`dev/local-server.ts`) | embedded **PGlite**, persisted in `apps/api/.local/` |
| `DATABASE_URL` set   | `wrangler dev` (Workers runtime, Miniflare)        | Neon, with migrations applied beforehand             |

- Both need `BETTER_AUTH_SECRET` (≥ 32 chars) for auth.
- In development, password-reset e-mails are **logged to the API console**:
  `password reset link (development only)`. Open that link on the phone.
- Set `BETTER_AUTH_URL=http://<LAN-IP>:8787` so the link works on a device.
- To wipe local accounts, stop the API and delete `apps/api/.local/`.

## Pointing the app at the local API

`EXPO_PUBLIC_API_URL` in `apps/mobile/.env`:

- iOS simulator: `http://localhost:8787`
- Android emulator: `http://10.0.2.2:8787`
- Physical device: `http://<your-LAN-IP>:8787` (same network)

The DEV showcase (Você → "DEV · Design system") shows whether the app reaches `/v1/health`.

## Conventions

- TypeScript strict everywhere. No `any`, no `@ts-ignore`, no TODO markers in code: open an issue
  instead.
- UI uses tokens from `src/theme` and components from `src/design-system`. Raw colours are banned
  outside the theme.
- Mascots and logos come only from `src/assets/registry.ts`.
- New API routes need a contract in `@bubo/contracts`, an entry in `API_ROUTE_DEFINITIONS` and
  tests.
- Schema changes need a new `packages/database/migrations/NNNN_name.sql` plus the matching Drizzle
  schema.
