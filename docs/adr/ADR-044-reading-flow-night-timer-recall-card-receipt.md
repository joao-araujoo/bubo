# ADR-044: Redesign 2.0 reading flow — night timer, recall card, reading receipt, streak night

Date: 2026-10-29. Status: accepted (part 2 of the Redesign 2.0). Builds on ADR-014 (derived
streak/XP), ADR-027 (mandatory recall checklist), ADR-029 (streak protection), ADR-032 (durable
session and reading return) and ADR-043 (Nunito, tab bar, Hoje).

## Context

The owner approved the reading-flow boards of the "Bubo — Redesign 2.0" prototype and asked for
them in the app "exactly as designed", standardized and responsive, without breaking anything.
An earlier pass had been rejected for copying Duolingo, so these screens use Bubo's own
metaphors: a bookmark ribbon at night, an index card with handwriting, a printed receipt and a
night calendar.

## Decision

**Behaviour does not change.** `sessao/[id]` keeps the durable draft, recovery, 48-hour notice,
discard rules, keep-awake, the 4-hour cap, the five-minute goal notice, the client UUID, the
server checklist, `VALIDATION_FAILED` handling, the optional Gemini question and the rating
prompt. Only the three steps were redrawn and split into `features/session`:

- **Night timer** (`NightTimer`): the book (`Book3D`) on a dark desk under a breathing lamp
  glow, a ribbon bookmark whose end moves down toward the session target, Bubo `deepReading`,
  a large clock, **one leaf per focused minute** (rows of 15) and "+N XP até agora" from
  `xpForReadingSession` (the same rule the API applies). The target is the session's own goal
  (5 min), else what is left of today's focus goal, else 10 minutes
  (`sessionTargetMinutes`, `@bubo/domain/reading-flow`); it is only drawn, the timer never
  stops by itself. "Antes de voltar" (ADR-032) is a glass card while idle. "Terminei por hoje"
  pauses and opens the **page sheet** ("Até que página você foi?": − / +, typing, +5, +10 and
  the next quarter of the book); confirming stores the page in the draft and ends the timer;
  closing it resumes. Discard is offered while paused.
- **Recall card** (`RecallCard`): one question per tab (Ideia, Detalhe, Conexão) on lined paper
  with a red margin; answers are typed in **Caveat** handwriting. "Guardar na memória" stamps
  "GUARDADO" only when the answer passes the same per-answer rules as the server checklist
  (`isSubstantialRecallAnswer`, `recallAnswersRepeat`, now exported by `@bubo/scoring`);
  otherwise Bubo shows a short nudge. "O Bubo confere" lights three circles: own words,
  something concrete (`mentionsSomethingConcrete`, a hint that never blocks) and no repetition.
  The last tap, "Ver meu recibo de leitura", is the deliberate server check of ADR-027; when it
  passes the same submission is saved, otherwise the server's messages are shown and the
  failing tab reopens. The page and focus time stay editable from a chip at the top.
- **Reading receipt** (`Receipt`): violet backdrop, confetti, Bubo celebrating, and a receipt
  printed out of a slot in **IBM Plex Mono**: pages, focus time, the three answers, the XP the
  API awarded (one line plus the total, no invented bonuses), the streak and the book milestone
  the session crossed (`crossedReadingMilestone`). "Compartilhar" shares a short text receipt
  through the system sheet; the book Story stays on the book page. The optional Gemini question
  is shown under the receipt.
- **Streak night** (`/sequencia`, `StreakNight`): the current streak, the record from
  `/v1/me/achievements`, this month's calendar built by the tested `buildWidgetMonth` (runs of
  consecutive days, protected days in blue, today ringed in gold), the protection status and the
  milestones 7/15/30/50/100 (`streakMilestones`). It opens from Hoje's streak tile and, after a
  session, only when saving grew the streak. The copy says "dias seguidos": the streak counts
  reading or review days.

**Fonts.** Caveat 500 and IBM Plex Mono 400/700 (OFL 1.1, unmodified from
`@expo-google-fonts/caveat@0.4.2` and `@expo-google-fonts/ibm-plex-mono@0.4.1`) are embedded
like Nunito and exposed as `accentFontFamily`. They are effects of these two objects only, never
interface text. No npm dependency was added.

**Colours and motion.** The scenes are objects, the same in light and dark mode, so their colours
are a fixed `readingPalette` in `theme/colors.ts`; `Icon` gained a `tint` for it. The scenes use
gentle whole-element loops (lamp, ribbon sway, Bubo breathing and peeking, current leaf, flame,
stars, confetti) with the native driver; all stop under reduced motion, and Bubo stops peeking
while the reader types. Status bar style follows each scene through `useLightStatusBar`.

## Consequences

- No API, contract, migration or remote change. Older recovered drafts (page chosen on the
  recall screen) still validate their page before the check.
- The leaves and "+N XP até agora" are previews of the API rule; XP still only exists after the
  API accepts the session.
- Device acceptance on Android/iPhone and a new APK (to embed the two accent fonts) are pending.
- Next parts: Revisar card, Estante/Livro, Descobrir and the recommendation algorithm,
  Comunidade, Replay, living mascot.
