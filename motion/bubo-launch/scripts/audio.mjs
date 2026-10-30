// Original score and sound design for the film, synthesised from scratch (no samples).
// Every event is placed from src/film/timeline.js, the same timeline that moves the picture.
// Output: build/audio/mix.wav (48 kHz stereo, float). Loudness is normalised at render time.
// Usage: npm run audio
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DURATION, T } from '../src/film/timeline.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SR = 48000;
const LEN = Math.ceil((DURATION + 0.2) * SR);
const TAU = Math.PI * 2;

// ---------- deterministic noise ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const white = (n, seed) => {
  const r = rng(seed);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = r() * 2 - 1;
  return out;
};

// ---------- buses ----------
const bus = () => ({ L: new Float32Array(LEN), R: new Float32Array(LEN) });
const dry = bus();
const send = bus(); // to reverb

/** Adds a mono signal at time t (s), equal-power pan (-1..1), with a reverb send amount. */
function place(sig, t, { gain = 1, pan = 0, rev = 0.15 } = {}) {
  const start = Math.round(t * SR);
  const a = ((pan + 1) * Math.PI) / 4;
  const gl = Math.cos(a) * gain;
  const gr = Math.sin(a) * gain;
  for (let i = 0; i < sig.length; i++) {
    const k = start + i;
    if (k < 0 || k >= LEN) continue;
    const v = sig[i];
    dry.L[k] += v * gl;
    dry.R[k] += v * gr;
    if (rev > 0) {
      send.L[k] += v * gl * rev;
      send.R[k] += v * gr * rev;
    }
  }
}

// ---------- filters ----------
function biquad(sig, type, f0, q = 0.707, gainDb = 0) {
  const out = new Float32Array(sig.length);
  const w = (TAU * f0) / SR;
  const cs = Math.cos(w);
  const sn = Math.sin(w);
  const alpha = sn / (2 * q);
  const A = 10 ** (gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp')
    [b0, b1, b2, a0, a1, a2] = [(1 - cs) / 2, 1 - cs, (1 - cs) / 2, 1 + alpha, -2 * cs, 1 - alpha];
  else if (type === 'hp')
    [b0, b1, b2, a0, a1, a2] = [
      (1 + cs) / 2,
      -(1 + cs),
      (1 + cs) / 2,
      1 + alpha,
      -2 * cs,
      1 - alpha,
    ];
  else if (type === 'bp')
    [b0, b1, b2, a0, a1, a2] = [alpha, 0, -alpha, 1 + alpha, -2 * cs, 1 - alpha];
  else if (type === 'peak')
    [b0, b1, b2, a0, a1, a2] = [
      1 + alpha * A,
      -2 * cs,
      1 - alpha * A,
      1 + alpha / A,
      -2 * cs,
      1 - alpha / A,
    ];
  else throw new Error(type);
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  for (let i = 0; i < sig.length; i++) {
    const x = sig[i];
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    out[i] = y;
  }
  return out;
}

/** Band-pass with a centre frequency that moves over time (per-sample coefficients). */
function sweepBP(sig, fFrom, fTo, q, curve = (k) => k) {
  const out = new Float32Array(sig.length);
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  for (let i = 0; i < sig.length; i++) {
    const k = curve(i / sig.length);
    const f0 = fFrom * (fTo / fFrom) ** k;
    const w = (TAU * f0) / SR;
    const alpha = Math.sin(w) / (2 * q);
    const cs = Math.cos(w);
    const a0 = 1 + alpha;
    const x = sig[i];
    const y = (alpha * x - alpha * x2 + 2 * cs * y1 - (1 - alpha) * y2) / a0;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    out[i] = y;
  }
  return out;
}

function env(n, attack, decay, shape = 1) {
  const out = new Float32Array(n);
  const a = Math.max(1, attack * SR);
  for (let i = 0; i < n; i++) {
    out[i] = i < a ? (i / a) ** shape : Math.exp(-(i - a) / (decay * SR));
  }
  return out;
}
const mul = (a, b) => a.map((v, i) => v * (b[i] ?? 0));
const scale = (a, g) => a.map((v) => v * g);

// ---------- instruments ----------
const NOTE = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};
function hz(name) {
  const m = /^([A-G][b#]?)(-?\d)$/.exec(name);
  const midi = (Number(m[2]) + 1) * 12 + NOTE[m[1]];
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Felt piano: inharmonic partials, two detuned strings, soft hammer, felt-damped highs. */
function feltPiano(note, dur = 1.5, vel = 0.7, seed = 1) {
  const f = hz(note);
  const len = Math.round((dur + 1.6) * SR);
  const out = new Float32Array(len);
  const B = 0.00035;
  const sustain = Math.max(0.6, 3.2 - Math.log2(f / 130) * 0.7);
  const bright = 0.35 + vel * 0.65;
  for (let n = 1; n <= 14; n++) {
    const fn = n * f * Math.sqrt(1 + B * n * n);
    if (fn > 9000) break;
    const felt = 1 / (1 + (fn / (1400 + 1800 * bright)) ** 2.2);
    const amp = (1 / n ** 1.15) * felt;
    const t60 = sustain / (1 + 0.32 * (n - 1));
    for (const det of [-0.9, 0.9]) {
      const ff = fn * 2 ** (det / 1200);
      const ph = rng(seed * 31 + n)() * TAU;
      for (let i = 0; i < len; i++) {
        const t = i / SR;
        const rel = t > dur ? Math.exp(-(t - dur) / 0.09) : 1;
        out[i] += Math.sin(TAU * ff * t + ph) * amp * Math.exp((-6.9 * t) / t60) * rel * 0.5;
      }
    }
  }
  // Hammer: soft felt thump + key mechanism.
  const thump = biquad(mul(white(1400, seed + 7), env(1400, 0.001, 0.006)), 'lp', 900);
  for (let i = 0; i < thump.length; i++) out[i] += thump[i] * 0.25 * vel;
  const atk = Math.round(0.004 * SR);
  for (let i = 0; i < atk; i++) out[i] *= i / atk;
  return scale(out, vel * 0.32);
}

/** Marimba: tuned bar modes (1 : 3.9 : 9.2), mallet click, resonator warmth. */
function marimba(note, vel = 0.7, seed = 2) {
  const f = hz(note);
  const len = Math.round(1.6 * SR);
  const out = new Float32Array(len);
  const modes = [
    [1, 1, Math.max(0.35, 1.3 - Math.log2(f / 260) * 0.35)],
    [3.93, 0.32, 0.16],
    [9.2, 0.1, 0.05],
  ];
  for (const [r, a, d] of modes) {
    const fm = f * r;
    if (fm > 12000) continue;
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      out[i] += Math.sin(TAU * fm * t) * a * Math.exp(-t / d);
    }
  }
  const click = biquad(mul(white(240, seed), env(240, 0.0003, 0.0012)), 'bp', f * 5, 1.2);
  for (let i = 0; i < click.length; i++) out[i] += click[i] * 0.5;
  const atk = Math.round(0.0015 * SR);
  for (let i = 0; i < atk; i++) out[i] *= i / atk;
  return scale(out, vel * 0.3);
}

/** Warm plucked bass (upright-ish). */
function bass(note, dur = 0.6, vel = 0.8) {
  const f = hz(note);
  const len = Math.round((dur + 0.4) * SR);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const e =
      Math.min(1, t / 0.008) * Math.exp(-t / 0.55) * (t > dur ? Math.exp(-(t - dur) / 0.06) : 1);
    const s =
      Math.sin(TAU * f * t) +
      0.35 * Math.sin(TAU * 2 * f * t) * Math.exp(-t / 0.12) +
      0.12 * Math.sin(TAU * 3 * f * t) * Math.exp(-t / 0.05);
    out[i] = Math.tanh(s * 1.4) * e;
  }
  return scale(biquad(out, 'lp', 900), vel * 0.42);
}

/** Felt kick: pitch-dropping sine and a padded thud, no click. */
function kick(vel = 0.8) {
  const len = Math.round(0.35 * SR);
  const out = new Float32Array(len);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const f = 48 + 70 * Math.exp(-t / 0.03);
    ph += (TAU * f) / SR;
    out[i] = Math.sin(ph) * Math.exp(-t / 0.16) * Math.min(1, t / 0.002);
  }
  const thud = biquad(mul(white(2400, 9), env(2400, 0.001, 0.012)), 'lp', 300);
  for (let i = 0; i < thud.length; i++) out[i] += thud[i] * 0.4;
  return scale(out, vel * 0.6);
}

/** Small wooden click (rim / woodblock), two damped modes. */
function wood(vel = 0.6, pitch = 1, seed = 4) {
  const len = Math.round(0.12 * SR);
  const out = new Float32Array(len);
  for (const [f, a, d] of [
    [780 * pitch, 1, 0.03],
    [1720 * pitch, 0.5, 0.015],
    [3150 * pitch, 0.2, 0.006],
  ]) {
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      out[i] += Math.sin(TAU * f * t) * a * Math.exp(-t / d);
    }
  }
  const n = biquad(mul(white(300, seed), env(300, 0.0002, 0.001)), 'hp', 2000);
  for (let i = 0; i < n.length; i++) out[i] += n[i] * 0.4;
  return scale(out, vel * 0.25);
}

function shaker(vel = 0.3, seed = 5) {
  const n = Math.round(0.09 * SR);
  const s = mul(white(n, seed), env(n, 0.006, 0.025, 2));
  return scale(biquad(biquad(s, 'hp', 5200), 'lp', 11000), vel * 0.35);
}

// ---------- sound effects ----------

function paperFlip(dur = 0.22, vel = 0.6, seed = 10, bright = 1) {
  const n = Math.round(dur * SR);
  const r = rng(seed);
  const base = mul(white(n, seed), env(n, dur * 0.25, dur * 0.25, 1.5));
  const s = sweepBP(base, 900 * bright, 3800 * bright, 0.9, (k) => k);
  // Crackle: tiny fibre snaps scattered through the gesture.
  for (let c = 0; c < 26; c++) {
    const at = Math.floor(r() * n * 0.9);
    const len = 30 + Math.floor(r() * 90);
    for (let i = 0; i < len && at + i < n; i++)
      s[at + i] += (r() * 2 - 1) * Math.exp(-i / 16) * 0.5;
  }
  const air = biquad(mul(white(n, seed + 1), env(n, dur * 0.4, dur * 0.3)), 'lp', 400);
  for (let i = 0; i < n; i++) s[i] += air[i] * 0.5;
  return scale(s, vel * 0.5);
}

function whoosh(dur, fFrom, fTo, vel = 0.5, seed = 20, curve = (k) => k) {
  const n = Math.round(dur * SR);
  const e = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const k = i / n;
    e[i] = Math.sin(Math.PI * k) ** 1.6;
  }
  return scale(sweepBP(mul(white(n, seed), e), fFrom, fTo, 1.1, curve), vel);
}

function bookThud(vel = 1, seed = 30) {
  const len = Math.round(0.6 * SR);
  const out = new Float32Array(len);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const f = 42 + 60 * Math.exp(-t / 0.025);
    ph += (TAU * f) / SR;
    out[i] =
      Math.sin(ph) * Math.exp(-t / 0.12) * 0.9 +
      Math.sin(TAU * 118 * t) * Math.exp(-t / 0.05) * 0.35;
  }
  const body = biquad(mul(white(6000, seed), env(6000, 0.0005, 0.02)), 'lp', 500);
  const slap = biquad(mul(white(1200, seed + 1), env(1200, 0.0002, 0.004)), 'bp', 2600, 0.8);
  for (let i = 0; i < body.length; i++) out[i] += body[i] * 0.9;
  for (let i = 0; i < slap.length; i++) out[i] += slap[i] * 0.6;
  // Paper settling right after the impact.
  const settle = paperFlip(0.16, 0.25, seed + 3, 0.8);
  for (let i = 0; i < settle.length && i + 2400 < len; i++) out[i + 2400] += settle[i];
  return scale(out, vel * 0.85);
}

function markerSqueak(dur, seed = 40) {
  const n = Math.round(dur * SR);
  const r = rng(seed);
  const e = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const k = i / n;
    e[i] =
      Math.min(1, k / 0.06) * Math.min(1, (1 - k) / 0.1) * (0.75 + 0.25 * Math.sin(k * 40 + r()));
  }
  const fibre = mul(white(n, seed), e);
  const squeak = sweepBP(fibre, 2300, 3100, 7, (k) => 0.5 + 0.5 * Math.sin(k * 9));
  const scratch = biquad(fibre, 'hp', 3500);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = squeak[i] * 1.2 + scratch[i] * 0.12;
  return scale(out, 0.35);
}

function pop(fFrom = 520, fTo = 1100, vel = 0.5) {
  const len = Math.round(0.14 * SR);
  const out = new Float32Array(len);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const f = fFrom + (fTo - fFrom) * (1 - Math.exp(-t / 0.018));
    ph += (TAU * f) / SR;
    out[i] = Math.sin(ph) * Math.min(1, t / 0.003) * Math.exp(-t / 0.045);
  }
  return scale(out, vel * 0.4);
}

function tap(vel = 0.5, seed = 50) {
  const n = Math.round(0.05 * SR);
  const s = biquad(mul(white(n, seed), env(n, 0.0003, 0.004)), 'bp', 2400, 1.5);
  const body = new Float32Array(n);
  for (let i = 0; i < n; i++)
    body[i] = Math.sin(TAU * 1300 * (i / SR)) * Math.exp(-i / (0.006 * SR)) * 0.4;
  return scale(
    s.map((v, i) => v + body[i]),
    vel * 0.5,
  );
}

/** Tactile button: the face sinks onto its rim. A low "thock" with a plastic click. */
function thock(vel = 0.6, seed = 60) {
  const len = Math.round(0.16 * SR);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    out[i] =
      Math.sin(TAU * 210 * t) * Math.exp(-t / 0.035) +
      Math.sin(TAU * 520 * t) * Math.exp(-t / 0.012) * 0.4;
  }
  const c = tap(0.8, seed);
  for (let i = 0; i < c.length; i++) out[i] += c[i];
  return scale(out, vel * 0.5);
}

function keyClick(vel = 0.3, seed = 70) {
  const n = Math.round(0.03 * SR);
  const r = rng(seed)();
  const s = biquad(mul(white(n, seed), env(n, 0.0002, 0.003)), 'bp', 2800 + r * 1400, 2);
  return scale(s, vel * 0.6);
}

function slide(dur = 0.14, vel = 0.4, seed = 80) {
  const n = Math.round(dur * SR);
  return scale(sweepBP(mul(white(n, seed), env(n, dur * 0.3, dur * 0.25)), 1200, 3200, 1.4), vel);
}

// ---------- the score ----------

const B = 0.5; // one beat at 120 BPM

// Room tone in the quiet world of the book (first two seconds).
{
  const n = Math.round(2.2 * SR);
  const room = biquad(white(n, 99), 'lp', 700);
  for (let i = 0; i < n; i++)
    room[i] *=
      0.04 * Math.min(1, i / (0.02 * SR)) * (i > 1.0 * SR ? Math.exp(-(i - SR) / (0.08 * SR)) : 1);
  place(room, 0, { gain: 1, rev: 0 });
}

// 1 — Page: the marker, the pull-back, the words of the command.
place(
  markerSqueak(T.highlight[1] - Math.max(0, T.highlight[0]) + 0.06),
  Math.max(0, T.highlight[0]),
  { gain: 1.8, pan: 0.15, rev: 0.06 },
);
place(whoosh(0.34, 300, 1400, 0.4, 21), T.pullBack[0], { pan: 0, rev: 0.1 });
T.words.forEach((t, i) =>
  place(wood(0.9, 0.75 + i * 0.12, 90 + i), t, { pan: -0.2 + i * 0.2, rev: 0.14 }),
);
// The book closes: air accelerating, paper, then the slam on beat 3.
place(
  whoosh(T.close[1] - T.close[0], 200, 2200, 0.8, 22, (k) => k ** 2.2),
  T.close[0],
  { rev: 0.08 },
);
place(paperFlip(0.3, 0.35, 23), T.close[1] - 0.26, { pan: -0.3, rev: 0.05 });
place(bookThud(1), T.impact, { gain: 1, rev: 0.22 });

// 4 — Eyes in the dark: two bubbles left and right, the first notes of the film.
place(pop(420, 900, 0.7), T.eyeL, { pan: -0.45, rev: 0.25 });
place(pop(480, 1000, 0.7), T.eyeR, { pan: 0.45, rev: 0.25 });
place(feltPiano('C5', 0.9, 0.55, 3), T.eyeL, { pan: -0.3, rev: 0.35 });
place(feltPiano('F5', 0.9, 0.55, 4), T.eyeR, { pan: 0.3, rev: 0.35 });
['A4', 'C5', 'E5'].forEach((n, i) =>
  place(marimba(n, 0.55, 5 + i), T.open[i], { pan: -0.2 + 0.2 * i, rev: 0.25 }),
);
place(wood(0.25, 1.6, 7), T.blink, { rev: 0.1 });
place(wood(0.2, 1.75, 8), T.blink + 0.07, { rev: 0.1 });

// 5 — The light: an airy rise, Bubo's curious pop, the title settling, Bubo's hop.
place(
  whoosh(T.iris[1] - T.iris[0] + 0.1, 500, 4500, 0.28, 24, (k) => k ** 0.8),
  T.iris[0] - 0.05,
  { rev: 0.3 },
);
place(pop(600, 950, 0.45), T.curious, { pan: 0.1, rev: 0.2 });
place(whoosh(0.4, 1800, 700, 0.14, 25), T.heading[0], { pan: -0.3, rev: 0.15 });
place(whoosh(0.3, 600, 1600, 0.12, 26), T.notesHop[0], { pan: 0.4, rev: 0.1 });
place(tap(0.5, 27), T.notesHop[1], { pan: 0.45, rev: 0.1 });
[0, 0.06, 0.12].forEach((d, i) =>
  place(thock(0.32, 61 + i), T.ui[0] + d + 0.04, { pan: -0.1 + i * 0.1, rev: 0.1 }),
);

// The groove: 120 BPM, F major. Bars from 2.0 s (bar 2) to 12.0 s.
const chords = [
  { at: 2, root: 'F2', notes: ['C4', 'E4', 'G4', 'A4'] },
  { at: 4, root: 'D2', notes: ['C4', 'F4', 'A4', 'E5'] },
  { at: 6, root: 'Bb1', notes: ['D4', 'F4', 'A4', 'C5'] },
  { at: 8, root: 'C2', notes: ['E4', 'G4', 'A4', 'D5'] },
  { at: 10, root: 'F2', notes: ['C4', 'E4', 'G4', 'A4', 'C5'] },
];
chords.forEach((c, ci) => {
  // Piano: a soft chord on 1, a lighter re-strike on the "and" of 3.
  c.notes.forEach((n, i) => {
    place(feltPiano(n, 0.7, 0.3, 100 + ci * 10 + i), c.at, { pan: -0.25 + i * 0.15, rev: 0.3 });
    if (ci > 0)
      place(feltPiano(n, 0.3, 0.17, 200 + ci * 10 + i), c.at + 2.5 * B, {
        pan: -0.25 + i * 0.15,
        rev: 0.3,
      });
  });
  // Bass: root on 1, root on the "and" of 2, fifth on 4.
  const fifth = { F2: 'C3', D2: 'A2', Bb1: 'F2', C2: 'G2' }[c.root];
  place(bass(c.root, 0.6, 0.85), c.at, { rev: 0.04 });
  place(bass(c.root, 0.22, 0.6), c.at + 1.5 * B, { rev: 0.04 });
  place(bass(fifth, 0.4, 0.7), c.at + 3 * B, { rev: 0.04 });
});
// Drums from bar 2 to the end of bar 6, a little busier in bar 5 (time flies).
// Bar 2 is light (kick and air), the backbeat joins at 3.0, bar 5 is the busiest, bar 6 opens up.
for (let t = 2; t < 12 - 1e-6; t += B) {
  const beat = Math.round((t - 2) / B) % 4;
  const lift = t < 4 ? 0.7 : t >= 10 ? 0.8 : 1;
  if (beat === 0 || beat === 2) place(kick((beat === 0 ? 0.85 : 0.62) * lift), t, { rev: 0.03 });
  if ((beat === 1 || beat === 3) && t >= 3)
    place(wood(0.5 * lift, 1, 400 + Math.round(t * 10)), t, { pan: 0.15, rev: 0.14 });
}
for (let t = 2.5; t < 12 - 1e-6; t += B / 4) {
  const sixteenth = Math.round((t - 2) / (B / 4)) % 4;
  const busy = t >= 8 && t < 10 ? 1.4 : t < 4 ? 0.6 : 1;
  const v = (sixteenth === 2 ? 0.5 : sixteenth === 0 ? 0.32 : 0.2) * busy;
  place(shaker(v, 500 + Math.round(t * 100)), t, { pan: 0.35, rev: 0.05 });
}

// 6 — Typing: each word a marimba note; the words that flew in from the book are accented.
const typeNotes = ['A4', 'C5', 'A4', 'D5', 'E5', 'F5'];
const flown = new Set([1, 4, 5]);
T.type.forEach((t, i) => {
  place(marimba(typeNotes[i], flown.has(i) ? 0.75 : 0.45, 600 + i), t, {
    pan: -0.1 + i * 0.06,
    rev: 0.22,
  });
  if (flown.has(i)) place(whoosh(0.2, 900, 2600, 0.1, 610 + i), t - 0.2, { pan: 0.3, rev: 0.1 });
  else
    for (let k = 0; k < 4; k++)
      place(keyClick(0.35, 620 + i * 10 + k), t + k * 0.04, { pan: 0.1, rev: 0.05 });
});
for (let k = 0; k < 14; k++)
  place(keyClick(0.22, 700 + k), T.fastFill[0] + k * 0.022, { pan: 0.15, rev: 0.04 });
place(thock(0.6, 710), T.conferir, { pan: -0.1, rev: 0.1 });
place(marimba('A5', 0.6, 711), T.idea, { pan: 0.35, rev: 0.35 });
place(marimba('E6', 0.5, 712), T.idea + 0.06, { pan: 0.4, rev: 0.35 });
place(thock(0.75, 713), T.salvar, { pan: 0.2, rev: 0.1 });
place(marimba('C6', 0.55, 714), T.salvar + 0.02, { pan: 0.2, rev: 0.3 });

// 7 — The screen turns like a page.
place(paperFlip(T.flipOut[1] - T.flipOut[0], 0.7, 720, 1), T.flipOut[0], { pan: -0.2, rev: 0.15 });
place(whoosh(0.5, 400, 1800, 0.2, 721), T.flipOut[0] + 0.05, { pan: -0.4, rev: 0.15 });
place(tap(0.45, 722), T.padHop[1], { pan: 0.35, rev: 0.1 });

// 8 — The days: a veil slides off the note, "Lembrei" chimes climb a step each time.
const chime = [
  ['D5', 'F5'],
  ['F5', 'Bb5'],
  ['G5', 'C6'],
  ['A5', 'D6'],
  ['E6', 'G6', 'C7'],
];
T.days.forEach((d, i) => {
  place(tap(0.45, 800 + i), d.reveal, { pan: 0, rev: 0.08 });
  place(slide(0.14, 0.18, 810 + i), d.reveal + 0.01, { pan: 0.2, rev: 0.1 });
  place(thock(0.7, 820 + i), d.grade, { pan: -0.1, rev: 0.1 });
  chime[i].forEach((n, k) =>
    place(marimba(n, 0.62 + 0.05 * i, 830 + i * 5 + k), d.grade + 0.02 + k * 0.0625, {
      pan: -0.2 + k * 0.25,
      rev: 0.3,
    }),
  );
});
// Page turns: single turns are full flips; fast runs become a flutter and a marimba run.
T.flips.forEach((run, ri) => {
  for (let i = 0; i < run.count; i++) {
    const t = run.start + i * run.gap;
    const v = run.count === 1 ? 0.6 : run.count < 10 ? 0.4 : 0.26;
    place(paperFlip(Math.min(0.24, run.dur), v, 900 + ri * 100 + i, 1 + (i % 3) * 0.08), t + 0.03, {
      pan: -0.3 + (i % 5) * 0.12,
      rev: 0.12,
    });
  }
  if (run.count >= 6) {
    const scaleNotes = ['F4', 'G4', 'A4', 'C5', 'D5', 'F5', 'G5', 'A5', 'C6', 'D6', 'F6'];
    const n = Math.min(scaleNotes.length, run.count >= 30 ? 11 : run.count >= 15 ? 8 : 6);
    const span = run.gap * (run.count - 1) + run.dur * 0.5;
    for (let k = 0; k < n; k++)
      place(
        marimba(scaleNotes[k], 0.32 + k * 0.02, 1000 + ri * 20 + k),
        run.start + (span * k) / n,
        { pan: -0.4 + (0.8 * k) / n, rev: 0.25 },
      );
  }
});

// 9 — The big jump and "Isso ficou com você.": arrival on F, words as soft wood, XP sparkle.
place(
  whoosh(T.bigJump[1] - T.bigJump[0], 500, 3000, 0.25, 1100, (k) => Math.sin((Math.PI * k) / 2)),
  T.bigJump[0],
  { pan: -0.2, rev: 0.2 },
);
place(paperFlip(T.summaryFlip[1] - T.summaryFlip[0], 0.5, 1101), T.summaryFlip[0], {
  pan: -0.3,
  rev: 0.15,
});
place(kick(0.6), T.bigJump[1], { rev: 0.05 });
['F5', 'A5', 'C6', 'F6'].forEach((n, k) =>
  place(marimba(n, 0.55, 1110 + k), 10 + k * 0.04, { pan: -0.3 + k * 0.2, rev: 0.35 }),
);
['F2', 'C3', 'A3', 'E4', 'G4', 'C5'].forEach((n, k) =>
  place(feltPiano(n, 1.6, 0.55, 1120 + k), 10, { pan: -0.3 + k * 0.12, rev: 0.4 }),
);
T.stays.forEach((t, i) =>
  place(wood(0.35, 0.9 + i * 0.1, 1130 + i), t, { pan: -0.15 + i * 0.1, rev: 0.15 }),
);
place(marimba('A6', 0.45, 1140), T.xp, { pan: 0.5, rev: 0.4 });
place(marimba('C7', 0.4, 1141), T.xp + 0.07, { pan: 0.55, rev: 0.4 });
place(pop(700, 1300, 0.35), T.xp, { pan: 0.5, rev: 0.2 });

// 10 — Off the page, the cover closes on the downbeat, the book flies into the wing.
place(whoosh(0.4, 700, 2000, 0.16, 1200), T.hopOff[0], { pan: 0, rev: 0.12 });
place(
  whoosh(T.coverClose[1] - T.coverClose[0], 250, 1500, 0.35, 1201, (k) => k ** 2),
  T.coverClose[0],
  { pan: -0.35, rev: 0.1 },
);
place(bookThud(0.55, 1202), T.coverClose[1], { rev: 0.25 });
place(bass('Bb1', 0.9, 0.8), 12, { rev: 0.05 });
['D4', 'F4', 'A4', 'C5'].forEach((n, k) =>
  place(feltPiano(n, 0.9, 0.35, 1210 + k), 12, { pan: -0.2 + k * 0.13, rev: 0.4 }),
);
place(
  whoosh(T.bookFly[1] - T.bookFly[0], 600, 2400, 0.18, 1203, (k) => Math.sin(Math.PI * k)),
  T.bookFly[0],
  { pan: -0.2, rev: 0.2 },
);
place(tap(0.6, 1204), T.catch, { rev: 0.1 });
place(pop(380, 700, 0.4), T.catch, { rev: 0.2 });
place(bass('C2', 0.9, 0.75), 13, { rev: 0.05 });
['E4', 'G4', 'Bb4', 'D5'].forEach((n, k) =>
  place(feltPiano(n, 0.8, 0.32, 1220 + k), 13, { pan: -0.2 + k * 0.13, rev: 0.4 }),
);
// Pickup into the last bar.
['C5', 'D5', 'E5', 'G5'].forEach((n, k) =>
  place(marimba(n, 0.38 + k * 0.05, 1230 + k), 13.5 + k * 0.125, { pan: -0.3 + k * 0.2, rev: 0.3 }),
);

// 11 — The logo on the downbeat: the resolved F chord rings out.
place(kick(0.7), T.logo, { rev: 0.05 });
place(bass('F1', 2.2, 0.9), T.logo, { rev: 0.06 });
['F3', 'C4', 'A4', 'E5', 'G5', 'C6'].forEach((n, k) =>
  place(feltPiano(n, 2.3, 0.6, 1300 + k), T.logo + k * 0.012, { pan: -0.35 + k * 0.14, rev: 0.45 }),
);
['F5', 'C6', 'F6'].forEach((n, k) =>
  place(marimba(n, 0.5, 1310 + k), T.logo + 0.02 + k * 0.05, { pan: -0.2 + k * 0.2, rev: 0.45 }),
);
place(wood(0.3, 1.2, 1320), T.tagline, { pan: 0.1, rev: 0.2 });

// ---------- reverb (Freeverb) ----------
function freeverb(inp, { room = 0.82, damp = 0.35, spread = 23 } = {}) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((n) =>
    Math.round((n + spread) * (SR / 44100)),
  );
  const aps = [556, 441, 341, 225].map((n) => Math.round((n + spread) * (SR / 44100)));
  const out = new Float32Array(inp.length);
  const cb = combs.map((n) => ({ buf: new Float32Array(n), i: 0, store: 0 }));
  const ab = aps.map((n) => ({ buf: new Float32Array(n), i: 0 }));
  for (let s = 0; s < inp.length; s++) {
    const x = inp[s] * 0.015;
    let acc = 0;
    for (const c of cb) {
      const y = c.buf[c.i];
      c.store = y * (1 - damp) + c.store * damp;
      c.buf[c.i] = x + c.store * room;
      c.i = (c.i + 1) % c.buf.length;
      acc += y;
    }
    for (const a of ab) {
      const b = a.buf[a.i];
      const y = -acc + b;
      a.buf[a.i] = acc + b * 0.5;
      a.i = (a.i + 1) % a.buf.length;
      acc = y;
    }
    out[s] = acc;
  }
  return out;
}
const wetL = freeverb(send.L, { spread: 0 });
const wetR = freeverb(send.R, { spread: 23 });

// ---------- mix bus: gentle glue compression and a soft ceiling ----------
const L = new Float32Array(LEN);
const R = new Float32Array(LEN);
for (let i = 0; i < LEN; i++) {
  L[i] = dry.L[i] + wetL[i] * 1.6;
  R[i] = dry.R[i] + wetR[i] * 1.6;
}
const hpL = biquad(L, 'hp', 28);
const hpR = biquad(R, 'hp', 28);
let envl = 0;
const att = Math.exp(-1 / (0.01 * SR));
const relc = Math.exp(-1 / (0.15 * SR));
for (let i = 0; i < LEN; i++) {
  const lvl = Math.max(Math.abs(hpL[i]), Math.abs(hpR[i]));
  envl = lvl > envl ? att * envl + (1 - att) * lvl : relc * envl + (1 - relc) * lvl;
  const thr = 0.35;
  const g = envl > thr ? (thr + (envl - thr) / 2.5) / envl : 1;
  hpL[i] = Math.tanh(hpL[i] * g * 1.05) / 1.05;
  hpR[i] = Math.tanh(hpR[i] * g * 1.05) / 1.05;
}
// Fade the very end of the tail.
const fade = Math.round(0.35 * SR);
for (let i = 0; i < fade; i++) {
  const k = 1 - i / fade;
  hpL[LEN - fade + i] *= k;
  hpR[LEN - fade + i] *= k;
}

// ---------- write WAV (32-bit float) ----------
function writeWav(file, chans) {
  const n = chans[0].length;
  const data = Buffer.alloc(n * chans.length * 4);
  for (let i = 0; i < n; i++)
    for (let c = 0; c < chans.length; c++)
      data.writeFloatLE(chans[c][i], (i * chans.length + c) * 4);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(3, 20);
  h.writeUInt16LE(chans.length, 22);
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * chans.length * 4, 28);
  h.writeUInt16LE(chans.length * 4, 32);
  h.writeUInt16LE(32, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([h, data]));
}
let peak = 0;
for (let i = 0; i < LEN; i++) peak = Math.max(peak, Math.abs(hpL[i]), Math.abs(hpR[i]));
const out = path.join(root, 'build/audio/mix.wav');
writeWav(out, [hpL, hpR]);
console.log(
  `audio: ${path.relative(root, out)} — ${(LEN / SR).toFixed(2)} s, peak ${(20 * Math.log10(peak)).toFixed(1)} dBFS`,
);
