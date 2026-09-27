# ADR-011 — Quality gates: Vitest, ESLint, Prettier, typecheck, repo audits

- Status: Accepted
- Date: 2026-09-26

## Context

Task 01 is done only when all quality gates pass. Rules like npm only, no OpenAI, canonical assets,
no raw colours and exactly five tabs must be enforced by tools, not by memory.

## Decision

`npm run verify` runs these steps in order, and fails fast:

1. `format:check`: Prettier 3.
2. `lint`: ESLint 10 flat config with typescript-eslint 8.
   - No `any` and no `ts-ignore`.
   - Type-only imports are consistent.
   - `no-console` everywhere except tooling and the API logger.
   - React Hooks rules in mobile.
3. `typecheck`: `tsc` per workspace (TypeScript 6.0, strict, `noUncheckedIndexedAccess`).
4. `test`: Vitest 5 for every package and the API. Pure logic and HTTP behaviour are tested with
   injected dependencies, with no network.
5. `assets:check`: see ADR-009.
6. `audit:repo`. Fails on:
   - other package managers
   - OpenAI
   - Gemini references in mobile
   - `ts-ignore` or `any`
   - TODO/FIXME
   - raw hex outside the theme
   - committed-looking secrets
   - a tab set other than the five official tabs

`npm run doctor` diagnoses the local environment without printing secret values.

The mobile app has no unit-test runner in Task 01. It's covered by typecheck, lint,
`expo install --check`, `expo config` and an `expo export` bundle smoke test. Component tests
(jest-expo + Testing Library) arrive with the first interactive feature.

## Consequences

- A green `verify` is the definition of done for every task, and CI can run it as-is later.
- The audits are regex-based: cheap and clear, but deliberately conservative.

## Alternatives considered

- **Jest everywhere:** slower and ESM-hostile for the Workers and TypeScript packages. Vitest is
  native ESM.
- **Biome instead of ESLint + Prettier:** a viable future swap, but it lacks the React Hooks and
  typescript-eslint rule depth today.
