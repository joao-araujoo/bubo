# Style guide — filme de lançamento

A fonte definitiva é o design system do app. Nada aqui é inventado: valores vêm de
`apps/mobile/src/theme/*` e dos componentes de `apps/mobile/src/design-system`.

## Cor

| papel no filme           | token do app                        | valor                 |
| ------------------------ | ----------------------------------- | --------------------- |
| roxo principal, grifo    | `palette.purple` (primary)          | `#7C3AED`             |
| aro dos botões, sombra   | `palette.purpleDeep` (primaryRim)   | `#5B21B6`             |
| tons claros, íris de luz | `palette.purpleLight`               | `#A78BFA`             |
| fundo de chips, nota     | `palette.purpleSoft` (primarySoft)  | `#EDE4FF`             |
| mundo do app             | `palette.lavender` (bg)             | `#F8F5FF`             |
| texto                    | `palette.ink` (text)                | `#21152F`             |
| texto secundário         | `palette.inkMuted`                  | `#6B6480`             |
| traços dos cards         | `palette.line` / `lineSoft`         | `#E2D9F3` / `#E9E3F5` |
| eyebrows                 | `palette.purpleInk` (accentDeep)    | `#6E3ACA`             |
| "Lembrei", sucesso       | `palette.green` / `greenRim`        | `#2ECF73` / `#1EA858` |
| escuro do livro fechado  | cor do livro na pose oficial `main` | `#2C0B4F`             |
| noite                    | `palette.night`, `purpleNight`      | `#140D1F`, `#3B1680`  |
| papel                    | `bookPalette.paper` / `paperEdge`   | `#F7F1E6` / `#DCD2BF` |
| ouro (XP, detalhes)      | `palette.gold` / `goldSoft`         | `#FFC53D` / `#FFF4D6` |

Proporção: papel só no primeiro segundo. Do escuro em diante, o filme é roxo e lilás.
Proibido: neon, glow largo, glassmorphism, gradientes decorativos sem motivo físico.

## Tipografia

- **Voz do produto e títulos:** Plus Jakarta Sans (arquivos do app). Títulos cinéticos em 800,
  tracking −2 %, 120–150 px no master. UI na escala real do app ×2,77 (390 pt → 1080 px), o que
  no celular devolve o tamanho nativo do app; closes vão a ×3,4.
- **O livro:** Literata (SIL OFL), só no papel impresso. Serifa = palavras do livro;
  Jakarta = palavras suas. A troca de fonte é o gesto de lembrar.
- Ícones: Material Icons, a mesma fonte e glyph map do `@expo/vector-icons` do app.

## Forma e profundidade (do `Raised`)

- Cards: raio 24 pt, traço 2 pt `#E9E3F5`, aro sólido 4 pt `#E2D9F3` abaixo. Sem sombra borrada.
- Botões: pílula, aro 5 pt (`#5B21B6` no primário, `#D1C4E9` no secundário, `#1EA858` no
  sucesso). Ao tocar, a face afunda no aro — é a recompensa física do filme.
- Campos: raio 14 pt, traço 2 pt, altura mínima 56 pt.
- Sombras borradas só existem para objetos físicos (papel, livro, Bubo no chão).

## Mascote

- Só PNGs oficiais (`assets-source/`, verificados por SHA-256 em `npm run sync`).
- Permitido: escala, rotação, squash & stretch do corpo inteiro, máscaras de recorte, troca de
  pose no tempo. Proibido: redesenhar, recolorir, deformar partes, inventar pose.
- Poses usadas: `neutral` (olhos no escuro), `curious`, `taking-notes`, `idea`, `confident`,
  `happy`, `cheering`, `celebrating`, `main`.

## Movimento

- Tudo é função de `t` (`window.seek(t)`); molas em forma fechada, ruído com seed.
- Curvas: entradas com mola sub-amortecida (overshoot 6–12 %), saídas com ease-in exponencial.
  Objetos com peso caem com aceleração (o livro), objetos leves flutuam (as palavras).
- Papel: malha 3D com curvatura cilíndrica, ponta atrasada, sombra de contato, luz rasante e
  brilho de papel. Nunca um retângulo girando.
- Motion blur temporal de 4 subquadros, ativado só nos trechos rápidos.

## Som

120 BPM, Fá maior. Felt piano, marimba, madeiras, shaker, baixo quente, papel e caneta. Sem pads
de synth, sem EDM, sem boom de trailer. Master em −14 LUFS integrado, pico real ≤ −1 dBTP.
