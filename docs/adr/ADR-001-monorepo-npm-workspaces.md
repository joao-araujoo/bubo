# ADR-001 — Monorepo with npm workspaces

- Status: Accepted
- Date: 2026-09-26

## Context

Bubo has a mobile app, an API and shared rules (contracts, domain, scoring, database). They change
together and must not drift. The team works on Windows, and the brief says npm only.

## Decision

- One repository with npm workspaces: `apps/*` (mobile, api) and `packages/*` (config, contracts,
  domain, scoring, database, testing).
- Shared packages are consumed from source (`"exports": "./src/index.ts"`). There is no build
  step: Metro, Wrangler (esbuild) and Vitest compile TypeScript directly.
- Internal dependencies use `"*"` so npm links the local workspace.
- One `package-lock.json` at the root. `packageManager` is pinned to npm, and the root declares
  `allowScripts` for the two native install scripts we need (esbuild, workerd).
- Every root script is a Node script or a plain npm command, so it works in PowerShell, cmd and
  POSIX shells.

## Consequences

- Changing a shared package is picked up instantly by both apps and all tests.
- The dependency graph must stay acyclic: apps depend on packages, and packages never import apps.
- Shared packages must avoid Node-only or DOM-only APIs unless their consumers allow them.

## Alternatives considered

- **pnpm / Yarn / Bun workspaces:** ruled out by the brief (npm only).
- **Turborepo / Nx:** extra tooling that isn't needed at this size. Easy to add later on top of npm
  workspaces.
- **Separate repositories:** contract drift and duplicated tooling.
- **Pre-built packages (`dist/`):** slower feedback and more config for no benefit while
  everything is private.
