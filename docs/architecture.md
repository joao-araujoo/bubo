# Architecture

```
apps/
  mobile/        Expo SDK 57 · Expo Router · TanStack Query      (ADR-002, ADR-007, ADR-008)
  api/           Cloudflare Worker · Hono · R2 · Gemini (server)  (ADR-003, ADR-006)
packages/
  config/        app constants + Zod env schemas (server / public)
  contracts/     Zod request/response schemas, error envelope, OpenAPI builder (ADR-010)
  domain/        pure domain model (ids, reading progress, cognitive week, Result)
  scoring/       pure rules: retention curve, SM-2 scheduling, XP
  database/      Drizzle schema, Neon client, SQL migrations (ADR-004)
  testing/       test-only helpers (env fixtures, fetch mock, clock)
assets-source/   official brand files (byte-identical) + manifest.json (ADR-009)
scripts/         cross-platform Node tooling (assets, audit, doctor, zip)
docs/            this documentation + ADRs
```

## Dependency rules

- `apps/*` → `packages/*`. Packages never import apps.
- `domain` and `scoring` are pure: no I/O, no framework, no environment access.
- `contracts` and `config` depend only on `zod`. They're safe for both the Worker and React
  Native.
- `database` is server-only. The mobile app must never import it.
- `testing` is used only by tests.

## Request flow

```
Mobile screen ─ useQuery ─▶ api client (validates with @bubo/contracts)
      │                                   │  HTTPS  /v1/*
      ▼                                   ▼
 TanStack cache              Worker: requestContext (X-Request-Id, logger, env validation)
 (online/focus aware)          → secureHeaders → [dev] CORS → route → contracts-typed JSON
                                   ├─ @bubo/database (Neon HTTP)   ├─ R2 MEDIA   └─ Gemini (REST)
                                   └─ errors → { error: { code, message, requestId, issues? } }
```

## Cross-cutting concerns

- **Config:** validated with Zod at the edge of each app. Secrets are server-only.
  `EXPO_PUBLIC_*` values are public.
- **Errors:** one envelope with stable codes. Clients branch on `code`.
- **Observability:** JSON logs with `requestId`, redaction of sensitive keys, and Workers
  observability enabled.
- **Offline:** NetInfo drives TanStack's `onlineManager`, and `OfflineBanner` informs the user.
- **Accessibility:**
  - touch targets ≥ 48 pt
  - roles, labels and states on interactive elements
  - reduce-motion honoured
  - font scaling capped at 1.6× so layouts don't break
- **Brand:** official assets only, reached through the registry.
