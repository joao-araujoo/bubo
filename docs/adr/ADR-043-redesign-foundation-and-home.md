# ADR-043: Redesign 2.0 foundation — Nunito, floating tab bar with quick actions, new Hoje

Date: 2026-10-29. Status: accepted (part 1 of the Redesign 2.0). Builds on ADR-008 (tokens),
ADR-026/029 (widgets keep their own font), ADR-032 (reading return) and ADR-042.

## Context

The owner reviewed a full Claude Design prototype of the app ("Bubo — Redesign 2.0", 27 boards,
private canvas) and approved it for implementation in parts. The decisions that come first,
because every later screen depends on them:

- one app font: **Nunito** (chosen by the owner over Plus Jakarta Sans);
- a **floating, rounded, detached** tab bar across the full width, with a central **"+"** for
  quick actions; the profile avatar stays at the **top** of the screens;
- Hoje kept its structure but had three stacked full-width buttons and loose cards; the owner
  asked for a much better Home with the same essence and a one-line greeting.

## Decision

**Font.** The app uses Nunito 400–900 (`assets/fonts/Nunito_*.ttf`, unmodified from
`@expo-google-fonts/nunito@0.4.2`, OFL 1.1), embedded by the `expo-font` plugin and exposed as
`fontFamily` tokens; `display` and `heading` use the new `black` weight. No npm dependency was
added. Plus Jakarta Sans stays on disk only because the native widgets copy it from
`assets/fonts`; switching the widgets is a separate change.

**Tab bar.** `(tabs)/_layout.tsx` renders `FloatingTabBar` (`features/shell`): a full-width pill
12 pt above the safe area with Hoje, Estante, the "+" and Revisar, Comunidade (icons, active tab
on a soft pill with a dot, real due-review badge). The "+" opens `QuickActionsSheet`, which only
lists real, available actions: continue the current book, read 5 minutes, add a book, scan a
barcode, search books, review due cards and update the page. **Você keeps its tab route** but is
not in the bar; it opens from `ProfileButton`, the avatar at the top of Hoje, Estante and
Revisar. This replaces the "exactly five tabs" rule with four tabs plus quick actions, still
without any AI/Chat tab. Tab screens get the bar's height as extra bottom space through the
`ScreenBottomInset` context consumed by `Screen`.

**Hoje — the book stage.** The owner approved a second Home design ("palco do livro"), now in
code (`features/home/BookStage`, `NextStepStage`, `sections`):

- a full-bleed stage at the top painted with the **current book's own cover, blurred and
  darkened** (`stageVeil`), so its colours follow every book; books without a cover image use
  the typographic cover palette, no book uses the brand violet; translucent glows decorate it and
  the status bar turns light while Hoje is focused;
- on the stage: the official symbol, glass streak/XP chips, notifications, the profile avatar, a
  one-line greeting for the local hour with a real-goal subtitle, `Book3D`, "Lendo agora", the
  page, a gold progress track with the next milestone flag ("faltam 6 pág. pra metade") and
  **one primary white button** ("Continuar leitura") beside a glass "5 min";
- three tiles overlapping the stage: today's goal (`ProgressRing`), the streak (orange, week
  marks) and due reviews (green);
- below: the daily card as a ticket, "Pra você hoje" (the first real "Para você" item of
  Descobrir with its reason — no invented match percentage), "Amigos lendo" (the friends feed's
  `readingNow`, progress rings around avatars, only friends who share) and the month Replay.

Stage colours are tokens (`stageVeil`, `stageGlass`, `stageTrack`, `stageButton`, …) valid in
both schemes. The reading-return priority of ADR-032 is unchanged.

**Pure rules** live in `@bubo/domain/home.ts` with tests: the greeting period, the next reading
milestone (25/50/75/100 %) and the daily card stamps. A stamp is only set by real data: the
daily goal in Preferências, a session today (sessions already require the recall exercise,
ADR-027) and reviews today; the review stamp only exists when something is due or was reviewed.
No bonus XP is shown for the card until the API awards one.

`ProgressRing` draws the ring with two clipped half rings instead of adding `react-native-svg`,
so this part needs no new native module.

## Consequences

- AGENTS.md rule 5 now describes four tabs plus quick actions, with Você behind the avatar.
- The next parts (reading flow, Revisar, Estante/Livro, Descobrir and the recommendation
  algorithm, Comunidade, Replay, living mascot) follow the same canvas and get their own ADRs.
- Android/iPhone acceptance of the floating bar, the sheet and the new Home is pending; the
  standalone APK must be rebuilt to embed Nunito.
