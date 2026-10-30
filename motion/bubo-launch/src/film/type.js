// Kinetic typography: lines of words that land one by one on the beat with a spring, squash on
// impact and can be clipped/recoloured. Pure functions of t.
import { setText } from '../lib/draw.js';
import { clamp, spring } from '../lib/math.js';
import { FONT } from '../lib/tokens.js';

/** Draws a centred word, pulling a trailing period in by an optical kern. */
export function drawKerned(g, word, size) {
  if (!word.endsWith('.') || word.length < 2) {
    g.fillText(word, 0, 0);
    return;
  }
  const body = word.slice(0, -1);
  const full = g.measureText(word).width;
  const bw = g.measureText(body).width;
  const kern = size * 0.05;
  const align = g.textAlign;
  g.textAlign = 'left';
  g.fillText(body, -full / 2 + kern / 2, 0);
  g.fillText('.', -full / 2 + bw - kern / 2, 0);
  g.textAlign = align;
}

/** Measures a line split into words; returns word offsets relative to the line start. */
export function layoutWords(g, words, { size, weight = 800, track = -0.02 }) {
  setText(g, { weight, size, track: track * size });
  const space = g.measureText(' ').width;
  let x = 0;
  const items = words.map((word) => {
    const w = g.measureText(word).width;
    const item = { word, x, w };
    x += w + space;
    return item;
  });
  return { items, width: x - space };
}

/**
 * Draws a kinetic line. `times[i]` is when word i lands. Words spring up from below with a
 * tiny overshoot; before landing they are invisible (a 3-frame alpha ramp avoids popping).
 * squash: {t0, amount} applies a vertical squash to the whole line (impact).
 */
export function kineticLine(
  g,
  t,
  {
    words,
    times,
    x,
    y,
    size,
    color,
    weight = 800,
    align = 'center',
    squash = null,
    scale = 1,
    alpha = 1,
    rise = 0.32,
  },
) {
  const lay = layoutWords(g, words, { size, weight });
  const left = align === 'center' ? x - (lay.width * scale) / 2 : x;
  g.save();
  g.translate(left, y);
  g.scale(scale, scale);
  if (squash) {
    const k = t - squash.t0;
    if (k >= 0) {
      const s = squash.amount * Math.exp(-k * 9) * Math.cos(k * 34);
      g.translate(lay.width / 2, 0);
      g.scale(1 + s * 0.25, 1 - s);
      g.translate(-lay.width / 2, 0);
    }
  }
  lay.items.forEach((item, i) => {
    const k = t - times[i];
    if (k < -0.001) return;
    const p = spring(k, 3.4, 0.52);
    const a = clamp(k / 0.05) * alpha;
    const dy = (1 - p) * size * rise;
    const sc = 0.82 + 0.18 * p;
    g.save();
    g.globalAlpha *= a;
    g.translate(item.x + item.w / 2, dy);
    g.scale(sc, sc);
    setText(g, { weight, size, color, track: -0.02 * size, align: 'center' });
    drawKerned(g, item.word, size);
    g.restore();
  });
  g.restore();
  return lay;
}

export { FONT };
