# AGENTS.md — working on Bubo

This guide is for AI agents and humans contributing to this repository. Follow it strictly.

## Product in one paragraph

Bubo helps readers _retain_ what they read. They read with focus, recall without peeking and review
at the right time, alone or in anti-spoiler clubs. The tone is warm, tactile and encouraging. The
official purple owl, Bubo, carries the emotional language. The UI language is Brazilian
Portuguese.

## Non-negotiable rules

1. **npm only.** Never add pnpm, Yarn or Bun files, commands or lockfiles.
2. **No OpenAI.** Gemini is the only LLM, called only from the API (`GeminiService`). The mobile
   app never holds AI keys or calls AI providers.
3. **Official assets are canonical.**
   - Never redesign, regenerate, trace, recolour or placeholder the logo or mascot.
   - Never use emoji or Stitch mascots in their place.
   - Use `src/assets/registry.ts` (`<BuboMascot state="…" />`).
   - If a state has no dedicated pose, use the closest official pose and document it. Unknown
     poses are marked `needs-confirmation`.
4. **Stitch is a reference, never a source.** Don't copy Stitch HTML. "BUBO — Home / Hoje" is the
   north star.
5. **Exactly five tabs:** Hoje, Estante, Revisar, Comunidade, Você. No AI/Chat tab.
6. **No fake business data.** Screens show honest empty states until real data exists. Sample data
   is allowed only in the DEV showcase route.
7. **No secrets in the repo or the app bundle.** `EXPO_PUBLIC_*` is public.
8. **No deploys and no remote changes** (Cloudflare, Neon, R2) unless a task explicitly asks for
   them.
9. **No git commits, branches or pushes** unless explicitly asked.

## Repository map

- `apps/mobile`: Expo SDK 57, Expo Router (`src/app`), theme (`src/theme`), components
  (`src/design-system`), features (`src/features`), infrastructure (`src/lib`).
- `apps/api`: Hono on Workers. Entry `src/index.ts` → `createApp()`. Routes in `src/routes`,
  services in `src/services`.
- `packages/*`: config, contracts, domain, scoring, database, testing. Consumed from source.
- `docs/`: start at [docs/README.md](docs/README.md). The ADRs explain every major choice.

## Commands

```sh
npm install            # root only
npm run verify         # MUST pass before you finish any task
npm run dev:mobile | dev:api | lint | format | typecheck | test | doctor
npm run assets:build | assets:check | audit:repo | package:zip
```

On Windows use PowerShell or cmd. All scripts are cross-platform Node.

## Coding conventions

- **TypeScript:** strict, with `noUncheckedIndexedAccess`.
  - No `any`, no `@ts-ignore`, no TODO/FIXME in code.
  - Use `import { type X }` for types.
- **Shared rules** go in `packages/domain` or `packages/scoring`: pure and tested. Shapes go in
  `packages/contracts`.
- **API:**
  - Every route is under `/v1`, has a contract and an `API_ROUTE_DEFINITIONS` entry, and has
    tests.
  - Expected failures throw `AppError(code, …)`.
  - Never log secrets or echo user-provided secrets.
- **Mobile:**
  - Use only theme tokens (no raw colours outside `src/theme`) and design-system components.
  - Server state goes in TanStack Query (no Redux).
  - Haptics go through `haptics.*`. Animations go through `FadeIn` or `useReducedMotion`.
  - Touch targets ≥ 48, with accessibility roles, labels and states.
- **Database:** add a new `migrations/NNNN_name.sql` and update the Drizzle schema together. Never
  edit an applied migration.
- **Dependencies:**
  - Pin exact versions.
  - For Expo native modules, use `npx expo install` or the SDK's `bundledNativeModules.json`
    version.
  - Justify new dependencies in the PR or ADR.

## Definition of done

- `npm run verify` is green: format, lint, typecheck, tests, assets:check, audit:repo.
- New behaviour has tests (packages and API).
- The relevant docs and ADRs are updated.
- No new policy violations and no fake data.

## Auth rules (Task 02)

- Every data route goes behind `withDatabase → withAuth → requireSession`, scopes every query to
  `session.user.id`, and is registered with `auth: true`.
- Never weaken `authRedirectGuard`, trusted origins or `disableOriginCheck: false`. Never enable
  Better Auth telemetry.
- Mobile auth goes through `authClient`. The session cookie stays in SecureStore, and screens never
  read or log it.
- `apps/api/.local/` (PGlite data) holds real local accounts. Never commit or ship it.

## Current status and next step

Tasks 01–04 are complete:

- foundation
- auth + onboarding
- reading sessions + Estante
- Revisar + production readiness

**Next: TASK 05 — DISCOVER + CATALOG + ISBN.**

- The per-screen build plan is [docs/screens.md](docs/screens.md). Update it whenever a screen
  changes status.
- Releases follow [docs/release.md](docs/release.md). Never deploy or run remote migrations without
  the owner's explicit go-ahead.

## Reading data rules (Task 03)

- Streak, XP, the week and missions are **derived from `reading_sessions` only** (ADR-014). Never
  store or show numbers that don't come from real activity.
- Sessions are idempotent on a client UUID. Keep that id stable across retries.
