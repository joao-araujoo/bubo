# ADR-034 — Recorded-reading Replay and native book Stories

- Status: Accepted
- Date: 2026-10-04

## Context

The owner requested monthly and yearly retrospectives and beautiful book images to share on
Instagram, inspired by the storytelling rhythm of Wrapped and the cover/rating focus of the
provided references. Bubo must retain its own identity, five tabs, canonical assets, real activity
and private writing. A shelf declaration cannot establish when historical reading happened
(ADR-033).

## Decision

- Add authenticated, owner-scoped `GET /v1/me/replay`, with shared contracts and pure domain rules.
  Monthly and yearly reports derive focus, page advances, books, days and sessions from accepted
  reading sessions. First recorded reading and a session crossing a known final page provide
  explicit evidence for starts/completions. Manual shelf timestamps do not create activity.
- Define period membership by `endedAt` converted into the requested IANA time zone. Start-hour
  patterns use `startedAt` in that same zone. Changing the zone can change boundary membership.
  Period dates retain their calendar boundaries; current periods include accepted sessions only
  up to the server clock. Future activity is excluded and partial history is described as recorded history. A
  zero month does not claim that the reader read nothing outside Bubo. Current page metadata
  bounds observed completions; corrections can change which final-page crossing is observed.
  The reading-only best
  sequence excludes reviews and streak freezes. Frequent-hour highlights require at least five
  sessions and an unambiguous top hour; the most-present book requires two sessions. Stored
  author strings remain intact, including coauthorship.
- Return mandatory server `generatedAt`. Current-period artwork labels its snapshot cutoff as
  `até DD/MM` in the requested zone, never silently relabelling old offline data as today. Replay
  is excluded from persisted query caches and refetches on mount; paused initial requests without
  data show an offline state. Deterministic ranking ties use non-exclusive highlight language.
- Add Replay under Você, with manually advanced chapters, short `FadeIn` transitions, reduced
  motion and a complete report of books, authors and monthly evolution. Keep exactly five tabs.
- Add a book Story composer under the book detail. The reader previews Papel, Noite or Violeta
  with real title, author, cover and shelf status. An optional 1–5 rating belongs only to the
  current composition: no database write, public review or inferred score. (Superseded by
  ADR-035: the Story now shows the private saved shelf rating, with a switch to hide it.)
- Export the current chapter/composition as a portrait PNG at 1080 × 1920. Use canonical fonts,
  theme tokens and a small unmodified official logo. Reserve central space for Story content;
  app controls do not enter the exported image. Missing covers keep the existing typographic
  fallback. Avoid fabricated genres, quotations, connections or reader comparisons.
- Exclude private reflections, recall exercises and card answers from sharing models. Sharing is
  explicit after preview and does not change friends-feed preferences or create public UGC in
  Bubo. The recipient app still owns the final publication action.
- Capture the mounted, static composition with exact-pinned `react-native-view-shot` 5.1.0,
  the Expo SDK bundled version. This native capture dependency preserves the actual React Native
  fonts, canonical assets and layout in a full-resolution PNG; screenshots of the device screen
  would include controls or lose export resolution.
  Capture draws the static art on a density-aware native canvas at the export resolution,
  rather than enlarging the small preview bitmap; the preview uses the same composition.
- Use the local Expo module `bubo-stories` for system sharing/saving and Instagram handoff, with a
  config plugin for the required platform declarations. This reuses system APIs instead of a
  paid rendering service or a third-party sharing dependency. Android 10+ saves through
  MediaStore without photo-read permission; iOS requests add-only photo access at Save.
- Preserve a temporary private-cache image copy while recipient apps consume it. Later image
  preparation removes files older than 24 hours from the dedicated directory. iOS Instagram
  clipboard handoff is local-only with five-minute expiry. Gallery exports remain the reader's
  deliberate files; account deletion does not delete them from the photo library.
- Direct Instagram Stories handoff requires a real public Meta App ID supplied as
  `EXPO_PUBLIC_INSTAGRAM_APP_ID`, Instagram availability and a newly compiled native app. The
  app ID is not a credential. Missing setup or unsupported handoff preserves system sharing and
  saving alternatives. Expo Go explains native availability instead of claiming delivery.

## Consequences

No migration, new AI flow or image-rendering backend is needed. The report reflects existing
records and the existing account/shelf deletion semantics. It cannot reconstruct deleted history
or reading performed before Bubo. Genres, quotations and Pontes remain separate future work with
their own data dependencies.

The feature adds native source and therefore requires a new Android/iOS build. Tests, prebuild,
autolinking and JS export can validate implementation stages; they do not establish Instagram
delivery, photo-library permission behavior, visual acceptance or Swift compilation.

## Validation and delivery

The local implementation passed `npm run verify` on 2026-10-04 with 541 tests; formatting, lint,
workspace/scripts typechecks, canonical assets and repo policy audit are green. Domain/API checks cover
periods, metric evidence, account isolation, empty/partial history and private-content exclusion.
Mobile checks cover safe compositions and contract consumption. No remote publication or git
operation is part of this delivery. Final check evidence belongs in [replay.md](../replay.md).

Android prebuild, module Kotlin compilation, merged manifest and release JavaScript bundle export
were checked locally. A full debug APK was assembled and installed in the Android emulator;
runtime visual/export checks are still in progress. A standalone build accepted on physical
devices, Swift compilation and actual Instagram sharing acceptance remain explicitly pending in
[TESTAR-TELAS.md](../TESTAR-TELAS.md). Owner setup is in [CONFIGURAR.md](../../CONFIGURAR.md).
