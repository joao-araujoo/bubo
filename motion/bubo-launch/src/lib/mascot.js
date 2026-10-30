// Bubo, the character. Only official PNGs are drawn; acting comes from replacement animation
// (choosing the official pose for the beat), whole-body squash & stretch around the feet,
// arcs and contact shadows. Pixels are never redrawn or recoloured.
import { assets } from './assets.js';

/**
 * Per pose: feet anchor (x = centre of the body, y = bottom of the feet) and the eye midpoint,
 * measured from the 1254 px official files (src/tools/analyze.html).
 */
export const POSE_META = {
  main: { ax: 640, ay: 1225, ex: 630, ey: 510 },
  neutral: { ax: 622, ay: 1167, ex: 620, ey: 520 },
  happy: { ax: 660, ay: 1170, ex: 641, ey: 517 },
  celebrating: { ax: 640, ay: 1193, ex: 670, ey: 598 },
  curious: { ax: 660, ay: 1183, ex: 670, ey: 585 },
  thinking: { ax: 620, ay: 1212, ex: 620, ey: 520 },
  surprised: { ax: 640, ay: 1216, ex: 675, ey: 601 },
  focused: { ax: 627, ay: 1154, ex: 618, ey: 553 },
  reading: { ax: 636, ay: 1142, ex: 636, ey: 540 },
  cheering: { ax: 660, ay: 1208, ex: 655, ey: 506 },
  confident: { ax: 650, ay: 1212, ex: 707, ey: 475 },
  'taking-notes': { ax: 640, ay: 1227, ex: 709, ey: 508 },
  idea: { ax: 650, ay: 1232, ex: 703, ey: 612 },
  achievement: { ax: 640, ay: 1200, ex: 665, ey: 504 },
  review: { ax: 650, ay: 1140, ex: 700, ey: 600 },
  'deep-reading': { ax: 646, ay: 1196, ex: 640, ey: 520 },
};

/**
 * Draws a pose with its feet at (x, y). `size` is the on-screen size of the 1254 px square.
 * squash > 0 flattens (landing), < 0 stretches (take-off); volume is preserved.
 */
export function drawBubo(
  g,
  pose,
  { x, y, size, rot = 0, squash = 0, alpha = 1, flip = false, lean = 0 },
) {
  const img = assets.mascot[pose];
  const m = POSE_META[pose];
  const s = size / 1254;
  const sy = 1 - squash;
  const sx = 1 / Math.max(0.2, sy);
  g.save();
  g.globalAlpha *= alpha;
  g.translate(x, y);
  g.rotate(rot);
  if (lean) g.transform(1, 0, lean, 1, 0, 0);
  g.scale(sx * (flip ? -1 : 1), sy);
  g.drawImage(img, -m.ax * s, -m.ay * s, 1254 * s, 1254 * s);
  g.restore();
}

/** Soft contact shadow under the feet; `air` 0..1 lifts and fades it. */
export function drawContact(
  g,
  { x, y, size, air = 0, color = 'rgba(59,22,128,', strength = 0.22 },
) {
  const w = size * 0.42 * (1 - air * 0.45);
  const h = w * 0.16;
  const a = strength * (1 - air * 0.7);
  const grad = g.createRadialGradient(x, y, 0, x, y, w);
  grad.addColorStop(0, `${color}${a})`);
  grad.addColorStop(1, `${color}0)`);
  g.save();
  g.translate(x, y);
  g.scale(1, h / w);
  g.translate(-x, -y);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, w, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** Screen position of the eye midpoint for a pose drawn with drawBubo (no rotation). */
export function eyePoint(pose, { x, y, size }) {
  const m = POSE_META[pose];
  const s = size / 1254;
  return { x: x + (m.ex - m.ax) * s, y: y + (m.ey - m.ay) * s };
}
