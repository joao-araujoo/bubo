# Bubo documentation

| doc                                        | contents                                                |
| ------------------------------------------ | ------------------------------------------------------- |
| [architecture.md](architecture.md)         | repo layout, dependency rules, request flow             |
| [development.md](development.md)           | requirements, first run, commands, conventions          |
| [environment.md](environment.md)           | environment variables and validation                    |
| [api.md](api.md)                           | endpoints, error model, services, adding routes         |
| [database.md](database.md)                 | schema, migrations workflow                             |
| [mobile.md](mobile.md)                     | navigation, Home, state, assets                         |
| [design-system.md](design-system.md)       | tokens, typography, components, motion, haptics         |
| [brand-assets.md](brand-assets.md)         | official asset inventory, pose mapping, gaps            |
| [stitch-inventory.md](stitch-inventory.md) | every Stitch screen, grouped, canonical vs variant      |
| [quality.md](quality.md)                   | quality gates, repo policy, test inventory              |
| [security.md](security.md)                 | secrets, API surface, supply chain, what's not verified |
| [roadmap.md](roadmap.md)                   | task status and upcoming work                           |

## Architecture Decision Records

| ADR                                                   | decision                                             |
| ----------------------------------------------------- | ---------------------------------------------------- |
| [ADR-001](adr/ADR-001-monorepo-npm-workspaces.md)     | Monorepo with npm workspaces                         |
| [ADR-002](adr/ADR-002-expo-sdk-57-expo-router.md)     | Expo SDK 57 + Expo Router                            |
| [ADR-003](adr/ADR-003-cloudflare-workers-hono.md)     | Cloudflare Workers + Hono                            |
| [ADR-004](adr/ADR-004-neon-postgres-drizzle.md)       | Neon Postgres + Drizzle, SQL-first migrations        |
| [ADR-005](adr/ADR-005-better-auth-deferred.md)        | Better Auth, wiring deferred to Task 02              |
| [ADR-006](adr/ADR-006-gemini-server-side-only.md)     | Gemini, server-side only (no OpenAI)                 |
| [ADR-007](adr/ADR-007-tanstack-query-server-state.md) | TanStack Query for server state (no Redux)           |
| [ADR-008](adr/ADR-008-design-system-tokens.md)        | Token-based design system; Stitch as reference       |
| [ADR-009](adr/ADR-009-official-brand-assets.md)       | Official brand assets are canonical                  |
| [ADR-010](adr/ADR-010-zod-contracts-openapi.md)       | Shared Zod contracts + generated OpenAPI             |
| [ADR-011](adr/ADR-011-quality-gates.md)               | Quality gates                                        |
| [ADR-012](adr/ADR-012-better-auth-implementation.md)  | Better Auth implementation (Task 02)                 |
| [ADR-013](adr/ADR-013-db-driver-and-local-dev.md)     | Neon Pool per request; PGlite for tests and dev      |
| [ADR-014](adr/ADR-014-reading-sessions.md)            | Reading sessions: source of progress, XP and streaks |
| [ADR-015](adr/ADR-015-active-recall.md)               | Active recall from the reader's notes, SM-2          |
| [ADR-016](adr/ADR-016-catalog.md)                     | Server-side catalog and provider cache               |

## Building and shipping

- [screens.md](screens.md): every Stitch screen → route → status → what it needs (the build plan).
- [release.md](release.md): the production checklist (Neon, Resend, Workers, EAS, stores).
