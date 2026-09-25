# ADR-002 — Cloudflare Workers + Neon PostgreSQL + R2

## Status
Accepted.

## Decision
The Bubo API runs on Cloudflare Workers. PostgreSQL on Neon is the source of truth for relational application data. Cloudflare R2 stores user-generated binary objects such as avatars, club images and future permitted uploads.

## Boundaries

### Mobile app
- Never receives Neon credentials.
- Never receives R2 secret credentials.
- Calls the Bubo API over HTTPS.
- Keeps only session material and device-appropriate cache.

### API
- Owns authentication and authorization.
- Validates every write operation.
- Calculates/coordinates Bubo Score updates server-side.
- Accesses Neon using server-side credentials.
- Accesses R2 through a Worker binding.

### Neon
Stores users, books, reading state, recalls, review schedules, score evidence, gamification, social graph and clubs.

### R2
Stores opaque binary objects. PostgreSQL stores ownership, metadata and object keys.

## Later, only when justified
Cloudflare Queues/Workflows may be introduced for expensive AI evaluation, media processing or notification fan-out. They are not required for the foundation.
