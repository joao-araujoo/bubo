# ADR-003 — Cloudflare Workers + Hono for the API

- Status: Accepted
- Date: 2026-09-26

## Context

The API needs to be global, cheap at low traffic and fast to cold-start. It needs object storage
for covers and avatars, and it must keep secrets (database, auth, Gemini) server-side.

## Decision

- Cloudflare Workers runtime, configured in `apps/api/wrangler.toml`:
  - `compatibility_date = 2026-09-01`
  - `nodejs_compat`
  - observability on
- Hono 4 as the router. Every public route lives under `/v1`.
- Cross-cutting behaviour:
  - request id (`X-Request-Id`): reuses a well-formed incoming id, otherwise generates a UUID
  - structured JSON logs with secret redaction
  - secure headers
  - CORS only in development
  - a single error envelope (see ADR-010)
- Probes:
  - `GET /v1/health` is liveness and never touches the database.
  - `GET /v1/ready` checks config and the database, returning 503 when not ready.
- R2 binding `MEDIA` (bucket `bubo`), wrapped by `MediaStorage`. That wrapper validates key
  prefixes, blocks traversal and enforces image types and sizes.
- `createApp(deps)` lets tests inject the database pinger, clock and log sink.
- Local dev (`wrangler dev`) is fully local through Miniflare. Nothing is created remotely.
  Deploys are out of scope for Task 01.

## Consequences

- No long-lived TCP connections: the database is reached over Neon's HTTP driver (ADR-004).
- The bundle is about 1 MB uncompressed (193 KB gzip) with zod and drizzle. Watch it as features
  grow.

## Alternatives considered

- **Node server on a VM or container:** regional, always-on cost, more ops work.
- **AWS Lambda + API Gateway:** slower cold starts, and object storage and CDN need extra wiring.
- **Express / Fastify:** not built for Workers. Hono is small, typed and Web-standard.
