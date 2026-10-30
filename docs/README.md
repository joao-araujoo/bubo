# Bubo documentation

| doc                                        | contents                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| [architecture.md](architecture.md)         | repo layout, dependency rules, request flow                            |
| [development.md](development.md)           | requirements, first run, commands, conventions                         |
| [environment.md](environment.md)           | environment variables and validation                                   |
| [api.md](api.md)                           | endpoints, error model, services, adding routes                        |
| [database.md](database.md)                 | schema, migrations workflow                                            |
| [mobile.md](mobile.md)                     | navigation, Home, state, assets                                        |
| [design-system.md](design-system.md)       | tokens, typography, components, motion, haptics                        |
| [brand-assets.md](brand-assets.md)         | official asset inventory, pose mapping, gaps                           |
| [stitch-inventory.md](stitch-inventory.md) | every Stitch screen, grouped, canonical vs variant                     |
| [quality.md](quality.md)                   | quality gates, repo policy, test inventory                             |
| [security.md](security.md)                 | secrets, API surface, supply chain, what's not verified                |
| [emails.md](emails.md)                     | transactional emails, send policy, real Resend evidence                |
| [emails-dns.md](emails-dns.md)             | Hostinger DNS values for the Bubo sending subdomain                    |
| [notifications.md](notifications.md)       | push delivery, native setup, receipts and device acceptance            |
| [core-validation.md](core-validation.md)   | recall checklist, research, real-text corpus and validation limits     |
| [replay.md](replay.md)                     | monthly/yearly Replay, book Stories, metric sources and native sharing |
| [roadmap.md](roadmap.md)                   | task status and upcoming work                                          |

## Architecture Decision Records

| ADR                                                                    | decision                                                                            |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| [ADR-001](adr/ADR-001-monorepo-npm-workspaces.md)                      | Monorepo with npm workspaces                                                        |
| [ADR-002](adr/ADR-002-expo-sdk-57-expo-router.md)                      | Expo SDK 57 + Expo Router                                                           |
| [ADR-003](adr/ADR-003-cloudflare-workers-hono.md)                      | Cloudflare Workers + Hono                                                           |
| [ADR-004](adr/ADR-004-neon-postgres-drizzle.md)                        | Neon Postgres + Drizzle, SQL-first migrations                                       |
| [ADR-005](adr/ADR-005-better-auth-deferred.md)                         | Better Auth, wiring deferred to Task 02                                             |
| [ADR-006](adr/ADR-006-gemini-server-side-only.md)                      | Gemini, server-side only (no OpenAI)                                                |
| [ADR-007](adr/ADR-007-tanstack-query-server-state.md)                  | TanStack Query for server state (no Redux)                                          |
| [ADR-008](adr/ADR-008-design-system-tokens.md)                         | Token-based design system; Stitch as reference                                      |
| [ADR-009](adr/ADR-009-official-brand-assets.md)                        | Official brand assets are canonical                                                 |
| [ADR-010](adr/ADR-010-zod-contracts-openapi.md)                        | Shared Zod contracts + generated OpenAPI                                            |
| [ADR-011](adr/ADR-011-quality-gates.md)                                | Quality gates                                                                       |
| [ADR-012](adr/ADR-012-better-auth-implementation.md)                   | Better Auth implementation (Task 02)                                                |
| [ADR-013](adr/ADR-013-db-driver-and-local-dev.md)                      | Neon Pool per request; PGlite for tests and dev                                     |
| [ADR-014](adr/ADR-014-reading-sessions.md)                             | Reading sessions: source of progress, XP and streaks                                |
| [ADR-015](adr/ADR-015-active-recall.md)                                | Active recall from the reader's notes, SM-2                                         |
| [ADR-016](adr/ADR-016-catalog.md)                                      | Server-side catalog and provider cache                                              |
| [ADR-017](adr/ADR-017-memory-from-recorded-activity.md)                | Memory views derived only from recorded activity                                    |
| [ADR-019](adr/ADR-019-community-clubs-anti-spoiler.md)                 | Clubs, server-enforced anti-spoiler, UGC moderation                                 |
| [ADR-018](adr/ADR-018-achievements-and-levels.md)                      | Achievements and cognitive levels computed on read                                  |
| [ADR-020](adr/ADR-020-clubs-part-2-polls-invites.md)                   | Private clubs, invites, polls, reactions, members, feed                             |
| [ADR-021](adr/ADR-021-reviews-friends-cycles-moderation.md)            | Book reviews, friends, club reading cycles, global moderation                       |
| [ADR-022](adr/ADR-022-preferences-notifications-push.md)               | Preferences, notification inbox, push and review reminders                          |
| [ADR-023](adr/ADR-023-native-reading-widgets.md)                       | Native Android/iOS reading widgets, snapshot privacy and expiry                     |
| [ADR-024](adr/ADR-024-free-local-android-builds.md)                    | Free repeatable local Android APK and safe USB installation                         |
| [ADR-025](adr/ADR-025-transactional-emails.md)                         | Warm transactional emails, safe hooks and Resend delivery                           |
| [ADR-026](adr/ADR-026-streak-widget-scenes.md)                         | Duolingo-style streak widgets: scenes, moods by hour, calendar                      |
| [ADR-027](adr/ADR-027-session-recall-gate.md)                          | Mandatory structured recall, versioned writing gate and optional Gemini coach       |
| [ADR-028](adr/ADR-028-push-delivery-lifecycle.md)                      | Push receipts, session-bound devices, consent and native lifecycle                  |
| [ADR-029](adr/ADR-029-widget-redesign-freeze-league.md)                | Widget redesign (canvas + Plus Jakarta), streak protection, weekly league           |
| [ADR-030](adr/ADR-030-observed-delayed-recall.md)                      | Actual review delays, observed recall and serialized review writes                  |
| [ADR-031](adr/ADR-031-discover-recommendations.md)                     | Discover: taste-graph recommendations, Portuguese shelves, catalog burst fix        |
| [ADR-032](adr/ADR-032-reading-return-and-adaptive-home.md)             | Reading return, optional five-minute goal and adaptive Hoje                         |
| [ADR-033](adr/ADR-033-responsive-search-and-shelf.md)                  | Responsive catalog, cover loading, shelf filters and already-read books             |
| [ADR-034](adr/ADR-034-replay-and-book-stories.md)                      | Recorded-reading Replay, 1080 × 1920 book Stories and explicit native sharing       |
| [ADR-035](adr/ADR-035-book-rating-and-grid-shelf.md)                   | Private book rating, rating popup and 2-column grid Estante                         |
| [ADR-036](adr/ADR-036-book-object-3d.md)                               | The book as a 3D object (tilted cover, fore-edge, shadow) in the book detail        |
| [ADR-037](adr/ADR-037-3d-bookcase-view.md)                             | Estante 3D: the shelf as a cozy wooden bookcase, visualisation only                 |
| [ADR-038](adr/ADR-038-login-codes-and-email-program.md)                | E-mailed login codes, trusted devices, code-based reset, e-mail program             |
| [ADR-039](adr/ADR-039-settings-structure-and-legal.md)                 | Settings hub per concern, legal documents, consent screens                          |
| [ADR-040](adr/ADR-040-reset-signs-in-and-legacy-clients.md)            | A password reset signs the reader in; old builds are told to update                 |
| [ADR-041](adr/ADR-041-light-email-art.md)                              | Light hosted e-mail art (no attachments) and a minimal white e-mail frame           |
| [ADR-042](adr/ADR-042-skoob-style-shelf-and-book-pages.md)             | Skoob-style Estante, search, Descobrir and book pages; instant book pages           |
| [ADR-043](adr/ADR-043-redesign-foundation-and-home.md)                 | Redesign 2.0 part 1: Nunito, floating tab bar with quick actions, new Hoje          |
| [ADR-044](adr/ADR-044-reading-flow-night-timer-recall-card-receipt.md) | Redesign 2.0 part 2: night timer, recall card, reading receipt, streak night        |
| [ADR-045](adr/ADR-045-revisar-stack-stamp-card-practice.md)            | Redesign 2.0 part 3: Revisar stack, daily stamp card, month challenge, practice     |
| [ADR-046](adr/ADR-046-estante-library-and-book-page-community.md)      | Redesign 2.0 part 4: Estante home and opening, reader marks, book community numbers |
| [ADR-047](adr/ADR-047-one-header-tab-bar-labels-type-scale.md)         | One header per screen kind, labelled tab bar, one section title, 12 pt type steps   |

## Building and shipping

- [build-mobile.md](build-mobile.md): **(pt-BR)** free local Android APK, setup and USB install.
- [ideias-futuras.md](ideias-futuras.md): 34 product ideas, acceptance criteria and dependencies.

- [screens.md](screens.md): every Stitch screen → route → status → what it needs (the build plan).
- [widgets.md](widgets.md): Android/iOS widgets, installation, privacy and native acceptance.
- [release.md](release.md): the production checklist (Neon, Resend, Workers, EAS, stores).
- [../CONFIGURAR.md](../CONFIGURAR.md): **(pt-BR)** everything the owner still has to configure.
- [TESTAR-TELAS.md](TESTAR-TELAS.md): **(pt-BR)** every screen, how to reach it, what to check.
- [../motion/bubo-launch/README.md](../motion/bubo-launch/README.md): the 9:16 launch film, an
  isolated npm project (deterministic Canvas/WebGL film, synthesised score, local render).
