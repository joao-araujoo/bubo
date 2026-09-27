# Design system (mobile)

Tokens live in `apps/mobile/src/theme` and components in `apps/mobile/src/design-system`. The
visual reference is Stitch's `DESIGN.md` ("Tactile Cognitive Gamification") plus the north-star
Home. We reimplement it natively and never copy its HTML (ADR-008). You can browse everything in
the DEV showcase: Você → "DEV · Design system", development builds only.

## Colour roles (light / dark)

| token            | light     | dark      | use                                        |
| ---------------- | --------- | --------- | ------------------------------------------ |
| `primary`        | `#7C3AED` | `#7C3AED` | CTAs, active states, progress              |
| `primaryPressed` | `#5B21B6` | `#5B21B6` | pressed state / rims                       |
| `purpleLight`    | `#A78BFA` | `#A78BFA` | tints, inactive tracks                     |
| `bg`             | `#F8F5FF` | `#140D1F` | screen canvas                              |
| `surface`        | `#FFFFFF` | `#1E1530` | cards                                      |
| `surfaceMuted`   | `#FBF0FF` | `#271C3D` | secondary cards, idle chips                |
| `text`           | `#21152F` | `#F4EEFF` | primary text                               |
| `textMuted`      | `#6B6480` | `#B3A9C9` | meta text                                  |
| `border`         | `#E2D9F3` | `#3A2D52` | strokes                                    |
| `success`        | `#2ECF73` | `#2ECF73` | correct recall, completion (rim `#1EA858`) |
| `warning`        | `#F5A524` | `#F5A524` | due reviews, streak freeze (rim `#C98214`) |
| `error`          | `#EF5B5B` | `#FF7A7A` | wrong answer, failures (rim `#C93F3F`)     |
| `gold`           | `#FFC53D` | `#FFC53D` | XP, streak, today marker                   |
| `orange`         | `#FF8A3D` | `#FF8A3D` | review / attention, offline banner tint    |

`accentText` is `#7C3AED` in light and `#C4B5FD` in dark, so purple text keeps its contrast on
dark surfaces.

## Typography (Plus Jakarta Sans)

| variant      | size/line | weight | use                         |
| ------------ | --------- | ------ | --------------------------- |
| `display`    | 30/38     | 800    | celebrations, big numbers   |
| `heading`    | 24/32     | 800    | screen titles               |
| `title`      | 20/28     | 700    | card titles                 |
| `titleSm`    | 18/24     | 700    | compact titles              |
| `bodyLg`     | 17/26     | 500    | reading-heavy copy          |
| `body`       | 15/22     | 500    | default                     |
| `bodyStrong` | 15/22     | 600    | emphasis                    |
| `bodySm`     | 13/18     | 500    | meta                        |
| `labelLg`    | 16/20     | 800    | buttons                     |
| `label`      | 14/18     | 700    | chips, counters             |
| `caption`    | 11/14     | 700    | uppercase eyebrows (0.04em) |

## Layout & sizing

- 4/8 spacing scale: `xxs 2`, `xs 4`, `sm 8`, `md 12`, `lg 16`, `xl 24`, `xxl 32`, `xxxl 48`.
- Screen gutter 16. Touch target ≥ 48. Primary CTA height 56.
- Radii: cards 24, inputs 14, micro 8–12, pills 999.
- "Pushdown" depth comes from `Raised`:
  - A solid rim layer sits under the face, offset by 5 px for buttons and 4 px for cards and
    option tiles.
  - The face has a uniform 2 px stroke.
  - On press, the face sinks onto the rim. There are no blurred shadows.
  - Two layers instead of a thick `borderBottomWidth` avoid uneven, darker bottom edges with large
    radii on Android (fixed after device testing).

## Components

| component       | notes                                                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `Text`          | the only text primitive. `variant` + colour token. Font scaling capped at 1.6×                                             |
| `Button`        | `primary` / `secondary` / `success`, `md` 48 / `lg` 56, icon, trailing, loading, disabled, haptics                         |
| `Card`          | `default` / `muted`. `style` = inner layout, `containerStyle` = outer layout (flex)                                        |
| `Raised`        | the tactile depth primitive used by `Button`, `Card`, `SelectableCard`                                                     |
| `Chip`          | tones `primary`, `gold`, `orange`, `success`, `neutral`. `eyebrow` for caption labels. `align="center"` in centred layouts |
| `SectionHeader` | icon + caption title + trailing meta                                                                                       |
| `ProgressBar`   | accessible progressbar (`accessibilityValue`)                                                                              |
| `WeekStrip`     | Monday→Sunday cognitive week from `@bubo/domain`                                                                           |
| `EmptyState`    | official mascot (by semantic state) + title + description + action                                                         |
| `Screen`        | safe areas, canvas, gutters, optional sticky header, `OfflineBanner`                                                       |
| `BuboMascot`    | `pose` or semantic `state`. Decorative by default                                                                          |
| `BuboLogo`      | official horizontal logo or symbol                                                                                         |
| `Icon`          | Material Icons (`@expo/vector-icons`), hidden from screen readers                                                          |

## Motion & haptics

- `FadeIn` staggers on mount and does nothing when reduce motion is on (`useReducedMotion`).
- `haptics.selection` / `press` / `commit` / `success` / `warning` / `error`. These are no-ops
  where unsupported and can be switched off with `haptics.setEnabled(false)`.

## Theme

`ThemeProvider` supports `light` (default), `system` and `dark`. You can switch it in the Você tab.
The preference is kept in memory until user settings persistence exists.

### Form motion and sizing

`FormScreen` uses a brief `FadeIn`, an optional official brand header and animated step progress.
`BuboMascot animated` opts into a single greeting (no idle loop). `useMotionValue` drives native
transforms for tactile presses, selection and progress, and opacity for field focus. All honor
`useReducedMotion` and cancel on unmount. Inputs stay stationary while typing.

TextField uses a 56pt minimum outer height, normalized native padding, centered single-line
text and a 48pt password toggle. Multiline fields align at the top; errors remain outside the
input and are announced. Buttons grow vertically for long labels and larger text.
