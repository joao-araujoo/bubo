# ADR-029 — Widget redesign, streak protection and the weekly friends league

- Status: accepted (2026-10-03)
- Supersedes the visual part of [ADR-026](ADR-026-streak-widget-scenes.md). Privacy, expiry,
  snapshot publishing (ADR-023) and the hourly moods (ADR-026 §2) stay in force.

## Context

The owner asked for a full widget review against four Duolingo references (Day Streak,
calendar with streak freeze, league), asking for far less visual noise, Plus Jakarta Sans,
the official Bubo poses integrated into the layout, a working "Sequência da semana" widget,
a real streak freeze and a new ranking widget backed by real data.

The audit found:

1. **"Sequência da semana" never loaded on Android.** `bubo_widget_rhythm.xml` used a plain
   `<View>` as a spacer. RemoteViews only inflate allow-listed classes, so every launcher showed
   "Can't load widget" (`InflateException: Class not allowed to be inflated android.view.View`,
   reproduced on an Android 15 emulator).
2. **Android widgets were not in Plus Jakarta Sans.** RemoteViews ignore
   `android:fontFamily="@font/…"`; every widget rendered in Roboto Regular (confirmed on the
   emulator). iOS fonts were correct (`UIAppFonts`, PostScript names verified).
3. No streak freeze, ranking, league or leaderboard existed anywhere (domain, API, database).
   XP existed (sessions + reviews, ADR-014) and so did consented friendships (ADR-021).

## Decision

1. **One clean surface.** The 11 saturated scenes, confetti/embers/stars decorations and white
   inner card are removed. Every widget uses `widgetPalette` (`src/theme/colors.ts`): a
   near-white lavender surface (league: a soft lavender wash), one accent per widget (orange
   streak, cyan protection, purple league), Bubo carrying the emotion. Moods keep their hours
   but carry a `tone` (`calm`, `done`, `risk`, `night`, `stale`, `welcome`) instead of a scene.
2. **Android draws on a Canvas.** `BuboPainter.kt` renders each widget into a bitmap at the
   widget's real size (portrait min-width × max-height, landscape the opposite), with the
   official Plus Jakarta Sans files (Regular → ExtraBold) loaded from the module's assets, the
   official pose PNGs and icon geometry generated once by the plugin for Android (Kotlin
   arrays) and iOS (Swift arrays). Layouts adapt to proportions (Bubo ≈ a third of the width,
   content block centred vertically), so a tall Pixel 4×2 and a wide Samsung 4×2 both look
   balanced. The XML layout is a single `ImageView`; the whole widget is the tap target and
   the bitmap gets one spoken description. Picker previews are static, data-free layouts (no
   numbers, no text). iOS keeps SwiftUI with the same compositions.
3. **Streak protection, derived (ADR-014 still holds).** `computeStreakState` in
   `@bubo/domain`: every 7 active days in the current streak earn one protection (max 2). A
   closed day without activity consumes one automatically and the streak survives; protected
   days never add to the count; without protections the streak breaks and progress resets.
   The rule is replayed from `STREAK_FREEZE_RULES.since` (2026-10-03), never retroactively.
   Nothing is stored: `/v1/me/stats` returns `streakFreeze { available, max, earnEvery,
progress, frozenDates }` (defaulted for older clients) and `streakDays` now includes
   protection. The calendar paints protected days cyan with a snowflake; the week strip shows a
   snowflake circle; a "❄ N" chip shows protections ready. With a protection ready, the
   evening stays calm ("Leia hoje: a proteção fica guardada") instead of escalating alerts.
4. **Weekly friends league.** `GET /v1/me/league?today=`: the reader plus accepted friends who
   share their activity (`share_activity`), ranked by the real XP of the reader's
   Monday→Sunday week (sessions + reviews). A friend's XP counts only from
   `greatest(accepted_at, sharing_since)`, like the friends feed. `previousRank` re-ranks with
   XP up to yesterday (null on Monday). Ties: name, then id. No tiers are invented: the title
   is "#N entre amigos" and the line reads "Liga semanal". Without friends the widget says
   "Sua liga semanal" with the reader's real weekly XP. Avatars are initials (the product's
   avatar). The sharing toggle copy now mentions the league. League responses are never
   persisted to disk (like the friends feed). The app gains `/liga` (from the widget and
   Amigos).
5. **Snapshot v3.** `freeze`, `week[].letter/frozen` (+ state `frozen`), `month.year/title`,
   `month.days[].frozen`, `book.author/coverPalette`, `league` (rank, previous, participants,
   weekly XP, days left, a 3-spot podium around the reader) and `leagueUrl`. Natives ignore
   older versions, so a stale v2 snapshot shows "Abra o Bubo" until the app republishes.
6. **Poses** (official, byte for byte): reading, deep-reading (no active book), celebrating,
   cheering, achievement, review, happy, confident (high streak), curious (no streak yet),
   thinking, worried, surprised, sleeping, doubt, welcome.

## Consequences

- Android text no longer scales with the system font beyond +15 % (kept within the cells);
  accessibility relies on the widget's content description.
- The fifth Android receiver (`LeagueWidget`) and iOS `BuboLeagueWidget` must ship in a new
  native build. Installed widgets keep working after the update.
- Swift was written but not compiled (no macOS here); Xcode compilation and device acceptance
  remain pending, like ADR-026.
- The protection rule is a product choice the owner can tune in `STREAK_FREEZE_RULES`.
