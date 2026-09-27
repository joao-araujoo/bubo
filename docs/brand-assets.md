# Brand & mascot asset inventory

The official files in `Bubo - Assets/` are **canonical**. They are never redesigned, regenerated,
recoloured or replaced by emoji, Stitch mascots or placeholders (see ADR-009).

- Machine-readable inventory, with SHA-256, sizes and original names:
  `assets-source/manifest.json`.
- Source of truth for names and labels: `scripts/asset-manifest.mjs`.
- Pose labels come from the official brand board (the reference sheet
  `stitch_bubo_read_deeply/…/chatgpt_image_sep_24_2026_10_14_19_pm_2.png/screen.png`).

All 26 files are 8-bit RGBA PNGs with transparent backgrounds. Each is 1254×1254, except the logo
at 1448×1086. There are no duplicates.

## Brand

| id               | clean file                       | original (`ChatGPT Image Sep 24, 2026, …`) | notes                                                            |
| ---------------- | -------------------------------- | ------------------------------------------ | ---------------------------------------------------------------- |
| `logoHorizontal` | `brand/bubo-logo-horizontal.png` | `10_37_11 PM (1)`                          | Symbol + BUBO + "READ DEEPLY." Trimmed to 720×232 for the app.   |
| `symbol`         | `brand/bubo-symbol.png`          | `10_37_11 PM (2)`                          | Owl head mark. Source of the app icon, adaptive icon and splash. |

## Mascot poses

| id            | label (brand board) | original           | status                           |
| ------------- | ------------------- | ------------------ | -------------------------------- |
| `main`        | Mascote principal   | `10_45_22 PM (1)`  | confirmed                        |
| `neutral`     | Neutro              | `10_37_11 PM (3)`  | confirmed                        |
| `happy`       | Feliz               | `10_37_11 PM (4)`  | needs-confirmation (vs Animando) |
| `celebrating` | Comemorando         | `10_37_11 PM (5)`  | confirmed                        |
| `curious`     | Curioso             | `10_37_11 PM (6)`  | confirmed                        |
| `thinking`    | Pensando            | `10_37_11 PM (7)`  | needs-confirmation               |
| `surprised`   | Surpreso            | `10_37_11 PM (8)`  | confirmed                        |
| `focused`     | Focado              | `10_37_11 PM (9)`  | needs-confirmation (vs Lendo)    |
| `reading`     | Lendo               | `10_37_11 PM (10)` | needs-confirmation (vs Focado)   |
| `sleeping`    | Dormindo            | `10_42_35 PM (1)`  | confirmed                        |
| `cheering`    | Animando            | `10_42_35 PM (2)`  | needs-confirmation (vs Feliz)    |
| `worried`     | Preocupado          | `10_42_36 PM (3)`  | confirmed                        |
| `confident`   | Confiante           | `10_42_36 PM (4)`  | confirmed                        |
| `takingNotes` | Anotando            | `10_42_36 PM (5)`  | confirmed                        |
| `idea`        | Ideia               | `10_42_36 PM (6)`  | confirmed                        |
| `doubt`       | Dúvida              | `10_42_37 PM (7)`  | confirmed                        |
| `typing`      | Digitando           | `10_42_37 PM (8)`  | confirmed                        |
| `welcome`     | Boas-vindas         | `10_42_37 PM (9)`  | confirmed                        |
| `achievement` | Conquista           | `10_42_37 PM (10)` | confirmed                        |
| `deepReading` | Leitura             | `10_45_22 PM (2)`  | confirmed                        |
| `review`      | Revisão             | `10_45_22 PM (3)`  | confirmed                        |
| `loading`     | Carregando          | `10_45_22 PM (4)`  | confirmed                        |
| `empty`       | Nada por agora      | `10_45_22 PM (5)`  | confirmed                        |
| `error`       | Erro (gentil)       | `10_45_23 PM (6)`  | confirmed                        |

"needs-confirmation" means two poses on the board are visually close: Focado and Lendo are both
open-book poses, and Feliz and Animando are both smiling. The mapping is the best reading of the
board. Swapping a pair only needs an edit to `scripts/asset-manifest.mjs`, then
`npm run assets:build`.

## Semantic states → closest official pose

`mascotForState` in `apps/mobile/src/assets/registry.ts`:

| state                                 | pose                          | why                               |
| ------------------------------------- | ----------------------------- | --------------------------------- |
| onboarding                            | `welcome`                     | Boas-vindas                       |
| emptyShelf                            | `deepReading`                 | invites reading                   |
| emptyReview                           | `empty`                       | "Nada por agora"                  |
| emptyCommunity                        | `cheering`                    | encouraging                       |
| profile                               | `main`                        | principal mascot                  |
| reviewDue / recallPrompt              | `review` / `curious`          | recall cards / curiosity          |
| recallCorrect / recallIncorrect       | `confident` / `worried`       | feedback                          |
| sessionComplete / achievementUnlocked | `celebrating` / `achievement` |                                   |
| streakAtRisk                          | `worried`                     |                                   |
| focusSession                          | `focused`                     |                                   |
| loading / error / notFound            | `loading` / `error` / `doubt` |                                   |
| offline _(no dedicated asset)_        | `sleeping`                    | closest: "resting / disconnected" |

## Derived app files (`npm run assets:build`)

- `apps/mobile/assets/mascot/*.png`: 640×640, full square frame, so every pose keeps the same
  scale.
- `apps/mobile/assets/brand/*`: trimmed. Logo 720 px wide, symbol 512 px.
- `apps/mobile/assets/icons/`:
  - `app-icon.png`: 1024², symbol at 700 px on white. Matches the board's "App Icon Light".
  - `adaptive-icon-foreground.png`: 1024², transparent, symbol at 600 px inside the safe zone.
  - `splash-icon.png`: trimmed symbol, 512 px.

Derivation only downscales (area-average with premultiplied alpha), trims transparent padding and
centres.

## Not available as official files (documented gaps)

The brand board _shows_ these, but no standalone official file exists. They are **not** recreated:

- logo horizontal monochrome
- logo vertical
- "Ícone minimal" (colour and black)
- app icon "Colorido" (purple background) and "Dark"
- Android monochrome (themed) icon

We use the official symbol on white as the app icon. Request the missing files from the brand owner
if needed.

## Other files seen

- `stitch_bubo_read_deeply/…/chatgpt_image_sep_24_2026_*.png/`: re-encoded copies of the official
  images (same dimensions, different bytes). Not canonical. Always use `Bubo - Assets/`.
- `…10_14_19_pm_1`: early mascot renders (8 poses). Reference only.
- `…10_14_19_pm_2`: the brand board (palette, icon, logo variants, pose names). Reference only.
