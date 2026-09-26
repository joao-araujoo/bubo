# Database migrations

Bubo 4 uses Neon PostgreSQL as the source of truth.

## Rules

- Migrations are append-only.
- Never edit a migration after it has been applied to a shared environment.
- Authentication-provider tables are kept separate from product-domain tables.
- Product tables store auth user IDs as opaque `TEXT` values.
- Cognitive/scoring data preserves algorithm/model/prompt provenance.

## Current

- `0001_core.sql` — profiles, books/editions, shelf, reading sessions, reflections, media metadata.
- `0002_onboarding_settings.sql` — onboarding preferences, interests, reading goals, notification preferences, push devices and updated_at triggers.
- `0003_mvp_schema.sql` — complete remaining MVP domain: book journey history, cognitive core, Bubo Score evidence, spaced review, gamification, community, clubs, anti-spoiler and notifications.

## Authentication

Authentication-provider tables are intentionally not hand-written here. They will be owned by the selected auth stack so Bubo's product domain remains decoupled from the authentication implementation.

## Environments

Use a Neon development branch first when available. Validate migrations before production deployment.
