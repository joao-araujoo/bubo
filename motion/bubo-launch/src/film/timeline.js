// The single source of timing for picture and sound. 120 BPM: one beat = 0.5 s.
// scripts/audio.mjs imports this file, so every sound lands on the frame that causes it.

export const BPM = 120;
export const BEAT = 60 / BPM;
export const DURATION = 16.5;

export const T = {
  // 1 — Página
  highlight: [-0.2, 0.2],
  words: [0.16, 0.28, 0.4], // "Feche" "o" "livro."
  pullBack: [0.3, 0.62],
  close: [0.58, 1.0],
  lift: [0.54, 1.05],
  impact: 1.0,
  crash: [0.95, 1.045],
  // 4 — Olhos
  eyeL: 1.5,
  eyeR: 1.565,
  open: [1.625, 1.75, 1.875], // "Abra" "a" "memória."
  blink: 2.06,
  // 5 — Luz
  iris: [2.0, 2.42],
  pullOut: [2.05, 2.55],
  curious: 2.36,
  heading: [2.4, 2.86],
  ui: [2.74, 3.0],
  notesHop: [2.6, 2.92],
  // 6 — Lembrar
  type: [3.25, 3.5, 3.75, 4.0, 4.25, 4.5], // one word per eighth note
  fastFill: [4.56, 4.86],
  conferir: 4.75,
  idea: 4.82,
  salvar: 5.0,
  // 7 — Vira
  flipOut: [5.14, 5.86],
  padHop: [5.12, 5.9],
  // 8 — Voltar (days of the real SM-2 schedule for a reader who answers "Lembrei")
  days: [
    { day: 1, arrive: 6.0, reveal: 6.25, grade: 6.5 },
    { day: 2, arrive: 7.0, reveal: 7.0625, grade: 7.25 },
    { day: 8, arrive: 7.9, reveal: 7.94, grade: 8.0 },
    { day: 23, arrive: 8.62, reveal: 8.66, grade: 8.75 },
    { day: 61, arrive: 9.3, reveal: 9.34, grade: 9.5 },
  ],
  flips: [
    // [start of first flip, interval, number of pages, duration of one flip]
    { from: 1, to: 2, start: 6.72, gap: 0, count: 1, dur: 0.3 },
    { from: 2, to: 8, start: 7.38, gap: 0.075, count: 6, dur: 0.26 },
    { from: 8, to: 23, start: 8.16, gap: 0.0295, count: 15, dur: 0.24 },
    { from: 23, to: 61, start: 8.84, gap: 0.0118, count: 38, dur: 0.22 },
  ],
  // 9 — Fica
  bigJump: [9.52, 9.98],
  summaryFlip: [9.6, 9.92],
  stays: [10.0, 10.125, 10.25, 10.5], // "Isso" "ficou" "com" "você."
  xp: 10.875,
  // 10 — Leva
  coverClose: [11.55, 12.0],
  hopOff: [11.45, 11.9],
  bookFly: [12.14, 13.0],
  catch: 13.0,
  // 11 — Assinatura (the final chord lands on the downbeat of the last bar)
  logo: 14.0,
  tagline: 14.375,
};
