# Review log

Every round: render frames with `window.seek(t)`, build contact sheets, look at them, score
honestly, fix the three biggest problems, render again. Scores are 0–10 and deliberately severe.

## Round 0 — first assembly (contact sheet `out/dev-open.png`, opening only)

What I saw:

- Macro did not fill the frame: the page edge and the purple table showed at the right and
  bottom. A 9:16 frame needs zoom ≥ 2.8 on a 690 px page.
- "Feche" landed on top of sharp body text: two layers of type fighting.
- After the light, "Abra a memória." sat on Bubo's belly; the escaped words were lavender on
  lavender (invisible).

Fixed: macro zoom 3.35 → 3.6 with the camera clamped inside the page; the command now lands
after the pull-back, over the clean purple table; the headline stacks above the eyes; escaped
words change colour with their surroundings (ink on paper, purple in the air, lavender in the
dark, purple inside the light) and are clipped exactly at the iris edge.

## Round 1 — whole film assembled (contact sheet `out/dev-full.png`)

| criterion         | score         |
| ----------------- | ------------- |
| hook (0–2 s)      | 7             |
| composition       | 6             |
| hierarchy         | 6             |
| typography        | 7             |
| phone legibility  | 6             |
| motion            | 6             |
| transitions       | 6             |
| variety           | 7             |
| storytelling      | 8             |
| product quality   | 7             |
| Bubo personality  | 7             |
| use of the mascot | 7             |
| sound design      | — (not built) |
| sync              | —             |
| polish            | 5             |
| originality       | 8             |
| desire to try     | 6             |

Three biggest problems:

1. **Calendar flips toward the camera** (top-hinged, rotating through the lens) blew the page up
   into a white curtain and stretched the UI type: unreadable and ugly at 5.45 s and 7.55 s.
2. **The recall screen at 1.17× zoom** cropped the left edge of every label and crowded Bubo
   into the body copy; floating words hovered over unrelated fields.
3. **Back faces rendered black** (unclamped Lambert on faces turned away from the light) and the
   book disappeared behind Bubo's body right before the catch.

Fixed: every page now turns like a book page (left hinge, the free edge leads then trails,
corner twist), which also turned the gag into real rope skipping — the free edge passes under
Bubo's feet. Recall screen at 1.0× (true app size on a phone), body copy and page field removed
from the frame, escaped words wait inside field 1 and drop into the line on their beat. Shading
clamped to [0.58, 1.12]; the flying book is drawn in front of Bubo. Ending re-timed to the bar
grid: the cover closes on the downbeat of bar 7, the logo lands on the downbeat of bar 8
(14.0 s).

## Round 2 — determinism

`npm run check` (seek in scrambled order, FNV hash of the pixels) failed at t = 3.6: the camera
zoom left the top three rows unpainted, so they kept the previous frame. Every frame now starts
from a cleared canvas and the backgrounds are full-bleed beyond the camera. Check passes.

## Round 3 — first real video (render 1), watched as motion strips

The MP4 cannot be "played" by me, so each transition was read as a strip of consecutive 60 fps
frames (`scripts/strip.mjs`), the way an animator scrubs. Audio was read as a spectrogram, a
waveform and per-window loudness (I cannot listen; see Sound below).

| criterion         | score |
| ----------------- | ----- |
| hook (0–2 s)      | 7.5   |
| composition       | 7.5   |
| hierarchy         | 7.5   |
| typography        | 7.5   |
| phone legibility  | 8     |
| motion            | 7     |
| transitions       | 8     |
| variety           | 8     |
| storytelling      | 8.5   |
| product quality   | 8     |
| Bubo personality  | 7.5   |
| use of the mascot | 8     |
| sound design      | 7     |
| sync              | 8.5   |
| polish            | 6.5   |
| originality       | 8.5   |
| desire to try     | 7.5   |

Three biggest problems:

1. **Dead air and a fake slam.** The book sat still for ~0.25 s before closing (pure cubic ease
   starts too slowly), and the "crash" into the cover was really a fade: the darkness arrived
   before the cover filled the frame.
2. **A 360° spin in Bubo's big jump** turned the official art into a smeared, upside-down blob
   under motion blur — reads as a glitch, not joy. Also the flying book covered Bubo completely.
3. **Music as a wall.** The spectrogram showed the piano's 250–430 Hz band saturated for the
   whole groove and no dynamic arc.

Fixed: the cover is lifted by hand first then falls under its weight
(φ = π(0.12k + 0.88k^2.6)), the camera drifts in, the crash goes into the cloth above the title
(title moved to the lower third so it leaves the frame downwards) and the dark only arrives when
the cloth fills the frame; vertical-only impact squash. Big jump: clean arc, stretch on take-off,
lean back. The book flies behind Bubo and only comes in front at the wing. Piano re-voiced an
octave up and quieter; groove arranged (bar 2 light, backbeat at 3.0, bar 5 busiest, drums out in
bar 7). Recall screen pushes to 1.22× while the words land; the summary page gets its own
camera; the XP chip is in world space.

## Round 4 — render 2

| criterion         | score |
| ----------------- | ----- |
| hook (0–2 s)      | 8     |
| composition       | 8.5   |
| hierarchy         | 8.5   |
| typography        | 8     |
| phone legibility  | 8.5   |
| motion            | 8     |
| transitions       | 8.5   |
| variety           | 8.5   |
| storytelling      | 9     |
| product quality   | 8.5   |
| Bubo personality  | 8     |
| use of the mascot | 8.5   |
| sound design      | 7.5   |
| sync              | 9     |
| polish            | 7.5   |
| originality       | 9     |
| desire to try     | 8     |

Three biggest problems:

1. **Stroboscopic blur on the slam.** 4 sub-frames could not cover a ×3 zoom per frame: the
   cover title printed four times. Now `shutterAt` returns shutter and sample count per moment:
   16 on the slam, 8 on the whip and the fluttering days, 6 on jumps, 0 on reading moments.
2. **The hook said "Feche o livro." only at 0.5 s.** The command now lands at 0.16 / 0.28 /
   0.40 s over the page while focus is pulled from the book to the words, before the whip; the
   marker finishes the line as focus leaves it. The intro was also −32 dB RMS (inaudible in a
   feed): marker, ticks and whooshes raised ~6 dB, keeping the thud's contrast.
3. **Bubo watched day 1 without acting.** Now: lands `neutral` → `curious` when the card arrives
   → `thinking` (eyes up) while remembering → `confident` on "Lembrei". Also: the finger leaves
   between review days instead of hovering over empty pages; optical kerning for display periods.

## Round 5 — render 3

The slam now reads as one smooth streak. Remaining big issue: the 38-page flutter only drew the
5 newest pages (all barely lifted), so it read as "the number changes" rather than pages
turning. Pages in flight are now a spread across the arc (up to 10), with an LRU texture cache
per day (a page in flight is frozen, so a cache hit is pixel-identical — determinism re-checked).

## Round 6 — render 4 and 5: ghosts

Pose swaps that fell inside a motion-blur window (7.0, 9.5, 13.0 s) averaged two different
official poses into a double image. Replacement animation must cut, so discrete choices (which
pose) are now taken at the frame's own time (`src/film/clock.js`) while motion still spreads over
the shutter. At the catch, the flying book also faded over Bubo's chest for three frames and the
size popped: the book is now handed over on the catch frame (the `main` pose holds its own book),
the scale-up is eased and the blur window closes before the catch. Strips at 60 fps confirm clean
cuts.

## Final — render 7 (`out/bubo-launch-9x16.mp4`)

Technical: 16.5 s, 990 frames, 1080 × 1920, 60 fps, H.264 High, yuv420p, BT.709 tagged, CRF 16;
AAC 48 kHz stereo at **−13.9 LUFS integrated, −1.0 dBTP true peak** (two-pass loudnorm).
`npm run check` passes; the repo's `npm run verify` passes with the film in place.

| criterion         | score |
| ----------------- | ----- |
| hook (0–2 s)      | 9     |
| composition       | 8.5   |
| hierarchy         | 9     |
| typography        | 8.5   |
| phone legibility  | 8.5   |
| motion            | 9     |
| transitions       | 9     |
| variety           | 8.5   |
| storytelling      | 9     |
| product quality   | 9     |
| Bubo personality  | 9     |
| use of the mascot | 9     |
| sound design      | 8 \*  |
| sync              | 9     |
| polish            | 9     |
| originality       | 9     |
| desire to try     | 8.5   |

\* **Sound was never heard by me.** I cannot listen to audio. The score was judged from the
design (synthesis choices, arrangement), the spectrogram, the waveform and per-window loudness.
It is the least verified criterion in this log and the first thing a human should check: the
felt-piano timbre, the marker squeak in the first 0.2 s and the balance of the groove under the
sound effects.

Why the flagship criteria are at 9 and not 10:

- **Hook.** The paradox ("Feche o livro." from a reading app) lands by 0.4 s, the slam at 1.0 s,
  the eyes at 1.5 s. Frame 0 is a beautiful page, but a page: a thumbnail chosen by the platform
  from the first frame is quieter than the eyes at 1.9 s.
- **Motion.** Paper, springs, arcs and blur are physical; the recall screen is the calmest
  stretch (typing and rising cards), by design, because it is where the product is read.
- **Bubo.** All acting is official poses, squash, arcs and timing. Without separate rig parts
  (eyes, wings) there are no eye-lines toward the words; that is the ceiling of rule 3.
- **Polish.** Fixed in a last pass (render 7): the crash into the cover now takes 32
  sub-frames, so the gold title becomes one continuous streak instead of stepped copies, and the
  escaped words change colour on frame time, never mid-blur. What keeps it from 10: the recall
  screen's fields 2 and 3 fill in a blur of typing that is honest but not choreographed.
- **Originality.** The book of days with rope skipping and the words that change typeface as they
  become yours are, as far as I know, this film's own.

Phone check (`out/bubo-launch-phone-preview.mp4`, 432 × 768): headlines, the day numbers and
"Isso ficou com você." read instantly; the recall UI reads at the app's real size (labels ≈ 14 pt
equivalent); one focus per shot.
