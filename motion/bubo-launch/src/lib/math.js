// Pure, closed-form motion maths. Every function here is a function of its arguments only:
// no state, no Math.random, no accumulated physics. That is what makes window.seek(t) exact.

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, k) => a + (b - a) * k;
export const invLerp = (a, b, x) => clamp((x - a) / (b - a));
/** Progress of t through [t0, t1], clamped to 0..1. */
export const seg = (t, t0, t1) => clamp((t - t0) / (t1 - t0));
export const remap = (x, a0, a1, b0, b1) => b0 + (b1 - b0) * clamp((x - a0) / (a1 - a0));
export const smoothstep = (a, b, x) => {
  const k = clamp((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
export const TAU = Math.PI * 2;

export const ease = {
  linear: (k) => k,
  inQuad: (k) => k * k,
  outQuad: (k) => 1 - (1 - k) * (1 - k),
  inCubic: (k) => k * k * k,
  outCubic: (k) => 1 - (1 - k) ** 3,
  inOutCubic: (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2),
  inQuart: (k) => k ** 4,
  outQuart: (k) => 1 - (1 - k) ** 4,
  inOutQuart: (k) => (k < 0.5 ? 8 * k ** 4 : 1 - (-2 * k + 2) ** 4 / 2),
  outQuint: (k) => 1 - (1 - k) ** 5,
  inExpo: (k) => (k <= 0 ? 0 : 2 ** (10 * k - 10)),
  outExpo: (k) => (k >= 1 ? 1 : 1 - 2 ** (-10 * k)),
  inOutExpo: (k) =>
    k <= 0 ? 0 : k >= 1 ? 1 : k < 0.5 ? 2 ** (20 * k - 10) / 2 : (2 - 2 ** (-20 * k + 10)) / 2,
  inOutSine: (k) => -(Math.cos(Math.PI * k) - 1) / 2,
  outSine: (k) => Math.sin((k * Math.PI) / 2),
  inSine: (k) => 1 - Math.cos((k * Math.PI) / 2),
  outBack: (k, s = 1.70158) => 1 + (s + 1) * (k - 1) ** 3 + s * (k - 1) ** 2,
  inBack: (k, s = 1.70158) => (s + 1) * k * k * k - s * k * k,
};

/**
 * Damped spring from 0 to 1, evaluated in closed form at time `t` (seconds since release).
 * `freq` is the undamped frequency in Hz, `damping` the damping ratio (1 = critical).
 */
export function spring(t, freq = 2.2, damping = 0.55) {
  if (t <= 0) return 0;
  const w = TAU * freq;
  if (damping >= 1) {
    return 1 - (1 + w * t) * Math.exp(-w * t);
  }
  const wd = w * Math.sqrt(1 - damping * damping);
  const e = Math.exp(-damping * w * t);
  return 1 - e * (Math.cos(wd * t) + ((damping * w) / wd) * Math.sin(wd * t));
}

/** Spring velocity (derivative of spring), handy for squash proportional to speed. */
export function springVel(t, freq = 2.2, damping = 0.55) {
  const h = 1 / 960;
  return (spring(t + h, freq, damping) - spring(t - h, freq, damping)) / (2 * h);
}

/** Decaying oscillation (impact wobble): starts at 0, rings, settles to 0. */
export function wobble(t, freq = 6, decay = 6) {
  if (t <= 0) return 0;
  return Math.sin(TAU * freq * t) * Math.exp(-decay * t);
}

/** Ballistic hop: 0 at t=0 and t=1, peak 1 at t=0.5. */
export const hop = (k) => (k <= 0 || k >= 1 ? 0 : 4 * k * (1 - k));

// ---------- deterministic randomness ----------

/** Integer hash → [0, 1). Same inputs, same output, forever. */
export function hash(...values) {
  let h = 2166136261 >>> 0;
  for (const v of values) {
    let x = Math.floor(v * 1000003) | 0;
    h ^= x;
    h = Math.imul(h, 16777619);
    x = (x ^ (x >>> 15)) >>> 0;
    h ^= x;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
  }
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Seeded PRNG (mulberry32) for building static things such as textures. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth 1D value noise in [-1, 1]. */
export function noise1(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  const a = hash(i, seed) * 2 - 1;
  const b = hash(i + 1, seed) * 2 - 1;
  return a + (b - a) * u;
}

/** Fractal 1D noise, still a pure function of x. */
export function fbm1(x, seed = 0, octaves = 3) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise1(x * freq, seed + o * 17);
    amp *= 0.5;
    freq *= 2;
  }
  return sum;
}

/** Camera shake that only exists after `t0` and decays: returns {x, y, r}. */
export function shake(t, t0, amount = 18, decay = 9, seed = 3) {
  const k = t - t0;
  if (k < 0) return { x: 0, y: 0, r: 0 };
  const env = Math.exp(-decay * k);
  return {
    x: noise1(k * 38, seed) * amount * env,
    y: noise1(k * 41, seed + 5) * amount * env,
    r: noise1(k * 29, seed + 9) * 0.012 * env,
  };
}
