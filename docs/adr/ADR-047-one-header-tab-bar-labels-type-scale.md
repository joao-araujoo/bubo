# ADR-047: One header per screen kind, labelled tab bar, section titles and a complete type scale

Date: 2026-10-29. Status: accepted. Builds on ADR-008 (tokens), ADR-043 (floating tab bar, avatar
at the top) and ADR-044/045/046 (redesigned Hoje, reading flow, Revisar and Estante).

## Context

The owner asked for a full design audit ("deixe ele realmente profissional e padronize os
headers, navbar"). The code-level audit found the app built from two eras (Stitch screens and the
Redesign 2.0) with no shared chrome:

- **Tab headers:** four tabs, four headers. Estante opened with a 34 pt greeting that repeated
  Hoje's; Revisar used an uppercase eyebrow over a 28 pt heading; Comunidade a logo tile, a 20 pt
  title, two square buttons, a "Clube" button and no avatar (Você was unreachable from there);
  Você a 24 pt "Meu Perfil".
- **Pushed screens:** `FormScreen` had a centred and a left header, round 48 pt and square 42 pt
  header buttons (below the 48 pt touch target), uppercase eyebrows above titles (often filler
  such as "Gamificação Bubo" or "Sua estante, seu jeito") and a decorative green status dot.
  Descobrir drew its own header.
- **Tab bar:** icons only, so "Revisar" (a lamp) and "Comunidade" were guesswork, and the active
  tab had two indicators (soft pill and a dot).
- **Section titles:** four styles — uppercase 13 pt captions with an icon (`SectionTitle`), the
  20 pt sentence-case titles of Hoje/Revisar, Estante's with an underlined 15 pt link, Revisar's
  with baseline meta.
- **Type scale:** no 12 pt step, so 74 text styles overrode `bodySm`/`label` with `fontSize: 12`.
- Dead code: `TabShell` and the `tabBarHeight` token were unused.

## Decision

**Tab screens** (`features/shell/TabHeader`): a large title naming the place (`pageTitle`, 26 pt
like Hoje's greeting, sized so "Comunidade" fits beside two actions and the avatar on a 360 pt
phone; it only shrinks under large system fonts), an optional line of real context, at most two
screen actions as
`HeaderButton`s and the avatar (`ProfileButton`) at the far right — Estante (3D bookcase, add
book), Revisar ("Hora de lembrar"), Comunidade (friends, create club; the search button was
removed because it only switched to the Descobrir segment) and Você ("Meu perfil", bell and
settings, no avatar). Hoje keeps its book-stage header (owner rule, ADR-043), which already ends
with the same bell and avatar. Estante's search field now spans the full width.

**Pushed and modal screens** (`FormScreen`): one header — back/close, a left-aligned `title`
(two lines at most) and an optional `subtitle` line _below_ it carrying real context only (the
club name, the queue position "Lembrança 2 de 5"); `headerRight` holds actions. Eyebrows,
`align`, `eyebrowDot`, the `Eyebrow` export and the square `HeaderButton` shape were removed;
`HeaderButton` is always the round 48 pt raised button. Signed-out and onboarding screens keep the
centred logo/progress header (no title). Descobrir now uses `FormScreen`. Title copy moved to
sentence case ("Convidar membros", "Enquete e resultados", "Ciclos e leituras anteriores").

**Tab bar:** every tab shows its icon and its label (`tabLabel`, 11 pt: at 12 pt "Comunidade" is
71 pt wide and each tab slot of a 360 pt bar is ~66 pt; capped font scaling), the selected tab
sits in one soft pill (no dot), the bar is 72 pt and the screens' bottom space follows it through
`ScreenBottomInset`. The quick-actions "+" (52 pt raised face) is vertically centred inside the
bar, in line with the tabs, instead of floating above its top edge. Slots are symmetric: the edge
tabs (Hoje, Comunidade) start at 72 pt, the inner ones at 56 pt, spare width is shared equally,
the bar keeps 10 pt from the screen edges and 10 pt of inner padding, so "Comunidade" clears the
rounded end (16 pt from the edge at 360 pt, where the curve needs 12) and the "+" stays centred. `SegmentedTabs` labels use `labelSm`, so "Meus clubes" + count stays on one
line at 360 pt.

**Section titles:** `SectionTitle` is the only heading for sections outside cards: sentence-case
`title`, optional `subtitle`, and either a `link` (`label`, accent, no underline, 48 pt target)
or a `trailing` element. Its icons were dropped (Hoje, the north star, has none). Hoje's
`SectionRow`, Estante's `LibrarySection` and Revisar's `ReviewSection` render it. `SectionHeader`
(card-internal caption rows) is unchanged.

**Type scale:** `meta` (12/16 medium, metadata lines) and `labelSm` (12/16 bold, dense labels)
replace the 74 overrides; `pageTitle` (26/32 black) and `tabLabel` (11/14 bold) serve the chrome. Remaining `fontSize` overrides are the effect faces of
Story art, widgets previews and the receipt, plus badge digits.

No API, migration, dependency or remote change.

## Consequences

- New screens pick a header by kind: tab → `TabHeader`, pushed/modal → `FormScreen` title,
  signed-out/onboarding → `FormScreen` brand/step, immersive (session, scanner, Story) → own chrome.
- Estante no longer greets the reader (Hoje does); the waving symbol greeting was removed.
- Visual acceptance on Android/iPhone (narrow 360 dp phones, large fonts, dark theme) and a new
  APK are pending: no emulator or device was available in this environment.
