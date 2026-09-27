# ADR-008 — Token-based design system; Stitch is a reference, never copied

- Status: Accepted
- Date: 2026-09-26

## Context

Stitch produced about 64 HTML/PNG screens and a design system ("Tactile Cognitive Gamification").
The brief says: don't copy Stitch HTML; "BUBO — Home / Hoje" is the north star; use Plus Jakarta
Sans and the given brand colours; support light, dark and system themes.

## Decision

- Tokens live only in `apps/mobile/src/theme`:
  - `colors.ts`: light and dark `ColorTokens`, including gold for XP and streak, and orange for
    review and attention.
  - `typography.ts`: display, heading, title(Sm), body(Lg/Sm/Strong), label(Lg) and caption. One
    font family per weight, because Android doesn't synthesise weights.
  - `layout.ts`: 4/8 spacing, radii, sizes (gutter 16, touch target 48, CTA 56), motion.
- Components in `src/design-system` are built natively from those tokens. They mirror the Stitch
  intent (pushdown buttons, 2 px strokes with a solid bottom offset, chunky progress, pill chips)
  without its markup:
  - `Text`, `Button`, `Card`, `Chip`, `Icon`, `ProgressBar`
  - `SectionHeader`, `EmptyState`, `WeekStrip`, `Screen`, `OfflineBanner`
  - `BuboMascot`, `BuboLogo`
- Raw hex colours outside `src/theme` fail `npm run audit:repo`.
- Motion honours the OS reduce-motion setting (`useReducedMotion`, `FadeIn`). Haptics go through
  the semantic `haptics.*` wrapper.
- Where the Task 01 brief and Stitch disagree, the brief wins. Example: `success #2ECF73` versus
  the board's `#22C55E`.

## Consequences

- Dark mode is a token swap, not a per-screen effort.
- New UI must use tokens and components. Visual QA happens on the DEV showcase route.

## Alternatives considered

- **Porting Stitch HTML or Tailwind (NativeWind):** forbidden by the brief, and it would bind us to
  generated markup.
- **A third-party UI kit (Tamagui, Paper):** fights the tactile brand style and adds weight.
