# Bubo — Read deeply.

Bubo is a reading companion that helps people remember what they read. It combines focused reading
sessions, active recall and spaced review, and anti-spoiler reading clubs. The mascot is an owl
called Bubo.

**Status:** Tasks 01–04 are done:

- foundation
- authentication + onboarding
- Estante + focused reading sessions
- Revisar (active recall + spaced review)
- production readiness

Next screens: [docs/screens.md](docs/screens.md). Shipping: [docs/release.md](docs/release.md).

`npm run dev:api` runs locally with embedded Postgres, with no cloud setup. See
[docs/roadmap.md](docs/roadmap.md).

The repository contains:

- an npm-workspaces monorepo
- an Expo SDK 57 mobile app
- a Cloudflare Workers + Hono API
- shared TypeScript packages
- the official brand assets
- documentation and ADRs

## Quick start

```sh
npm install
npm run doctor
npm run dev:api        # http://localhost:8787/v1/health
npm run dev:mobile     # Expo dev server
npm run verify         # all quality gates
```

Requires Node ≥ 20.19 and **npm only**. Works on Windows, macOS and Linux. See
[docs/development.md](docs/development.md).

## Layout

| path                 | what                                                               |
| -------------------- | ------------------------------------------------------------------ |
| `apps/mobile`        | Expo Router app: 5 tabs (Hoje, Estante, Revisar, Comunidade, Você) |
| `apps/api`           | Worker API under `/v1` (health, ready, OpenAPI)                    |
| `packages/config`    | constants + validated env                                          |
| `packages/contracts` | shared Zod contracts + error envelope + OpenAPI builder            |
| `packages/domain`    | pure domain rules                                                  |
| `packages/scoring`   | retention, spaced repetition, XP                                   |
| `packages/database`  | Drizzle schema, Neon client, SQL migrations                        |
| `packages/testing`   | test helpers                                                       |
| `assets-source`      | official brand files (canonical, hashed)                           |
| `docs`               | documentation + ADR-001…011                                        |
| `scripts`            | cross-platform tooling                                             |

Read [AGENTS.md](AGENTS.md) before contributing, whether you're a person or an AI agent.
