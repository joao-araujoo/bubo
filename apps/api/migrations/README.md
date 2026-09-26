# Database migrations

Bubo 4 uses Neon PostgreSQL as the source of truth.

## Rules

- Migrations are append-only.
- Never edit a migration after it has been applied to a shared environment.
- Authentication-provider tables are kept separate from product-domain tables.
- Product tables store auth user IDs as opaque `TEXT` values.
- Cognitive/scoring tables are intentionally deferred to a later migration so the scientific model can be versioned deliberately.

## Current

- `0001_core.sql` — profiles, books/editions, shelf, reading sessions, reflections, media metadata.
- `0002_onboarding_settings.sql` — onboarding preferences, interests, reading goals, notification preferences, push devices and updated_at triggers.

## Environments

Use a Neon development branch first. Validate there before applying to the project's default branch.
