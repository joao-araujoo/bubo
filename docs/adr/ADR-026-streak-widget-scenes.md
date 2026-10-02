# ADR-026 — Streak widget scenes (Duolingo-style redesign)

- Status: accepted (2026-10-01)
- Supersedes the visual part of [ADR-023](ADR-023-native-reading-widgets.md). Privacy, expiry
  and snapshot publishing from ADR-023 stay in force.

## Context

The owner asked to restyle the home-screen widgets to match the Duolingo streak widgets
(reference board: a saturated full-bleed scene, a flame with the streak number, a short
caption and the mascot peeking from the bottom edge, plus a wide week strip and a month
calendar). The first widgets (ADR-023) were plain white cards with a button.

## Decision

1. **Four widgets** replace reading/rhythm/complete:
   - **Sequência** (small; iPhone lock screen circular/rectangular/inline),
   - **Sequência da semana** (medium: "N dias de sequência" and week checks),
   - **Calendário de leitura** (medium: active-day runs for the month),
   - **Continuar leitura** (medium: a white book card with progress; small shows the page).
2. **Moods by hour, decided in `@bubo/domain`** (`buildWidgetMoods`, `widgetMoodNow`). The
   snapshot (v2) carries today's moods (`fromHour` 0/6/18/21/22). Natives pick the last one
   whose hour has started, so the widget changes without the app or a network request:
   calm in the day (reviews waiting → teal, a book → sky), "Salve sua sequência!" at 18h,
   "Está ficando tarde!" at 21h and "Última chance!" at 22h **only while a real streak is
   at risk**, celebration once there is activity today (gold; mint when the weekly reading
   goal is met), and Bubo asleep at night. Without fresh data the widget never shows a number:
   "Abra o Bubo" (slate) or "Zzz…" at night.
3. **The streak is the app's streak:** days with a session **or** a review
   (`/v1/me/stats.streakDays`), so week checks and the calendar use activity days too. The
   weekly goal still counts reading days only. The flame is lit only when today already has
   activity; otherwise it is hollow. Evening moods add a red "!" badge.
4. **Calendar data:** `/v1/me/stats` gains `monthActiveDates` (dates this month up to today
   with activity). It defaults to `[]` so older APIs and cached responses keep parsing.
5. **One palette source:** scene gradients live in `src/theme/colors.ts` (`widgetScenes`,
   `widgetFlame`). The local plugin generates Android colours, gradient shapes, calendar
   runs and vector decorations (sparkles, moon and stars, confetti, embers, hearts) and the
   iOS `BuboTokens.swift` from it. The decoration and flame geometry is defined once in the
   plugin and emitted as Android `pathData` and Swift literals.
6. **Mascot:** official poses only, copied byte for byte (`WIDGET_POSES`). The "peeking"
   effect is layout clipping by the widget bounds (about 70% visible); the image itself is
   never cropped, recoloured or redrawn. Scenes are saturated non-purple gradients so the
   purple Bubo stands out.

## Consequences

- Android keeps `updatePeriodMillis` (30 min): a mood change can arrive up to ~30 min late.
  iOS schedules timeline entries at the mood hours.
- Installed widgets from ADR-023 (`CompleteWidget`, iOS `BuboComplete`) disappear after the
  update and must be added again. They were not yet accepted on devices.
- The in-app previews (`features/widgets/WidgetPreview.tsx`) approximate decorations with
  Material icons; native widgets draw the generated vectors.
- Pending: launcher/WidgetKit acceptance on devices and Swift compilation (no macOS here).
