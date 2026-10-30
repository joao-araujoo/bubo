// 2D drawing primitives shared by every scene. Stateless helpers over a CanvasRenderingContext2D.
import { assets } from './assets.js';
import { FONT, PT, SERIF } from './tokens.js';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  return { c, g };
}

export function font(weight, size, family = FONT, style = 'normal') {
  return `${style} ${weight} ${size}px ${family}`;
}

/** Sets the font, colour and tracking (`track` in px) for subsequent text calls. */
export function setText(
  g,
  {
    weight = 700,
    size = 40,
    family = FONT,
    style = 'normal',
    color = '#000',
    track = 0,
    align = 'left',
    baseline = 'alphabetic',
  },
) {
  g.font = font(weight, size, family, style);
  g.fillStyle = color;
  g.letterSpacing = `${track}px`;
  g.textAlign = align;
  g.textBaseline = baseline;
}

export function text(g, str, x, y, opts) {
  setText(g, opts);
  g.fillText(str, x, y);
}

export function measure(g, str, opts) {
  setText(g, opts);
  return g.measureText(str).width;
}

/** Greedy word wrap with the current font settings. */
export function wrap(g, str, maxWidth, opts) {
  setText(g, opts);
  const words = str.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (g.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export function rrect(g, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.roundRect(x, y, w, h, rr);
}

/**
 * The Bubo "Raised" primitive: a solid rim offset below the face, uniform 2 pt stroke on the
 * face, and a face that sinks onto the rim when pressed (press 0..1). Sizes in px.
 */
export function raised(g, { x, y, w, h, r, face, border, rim, depth, press = 0, stroke = 2 * PT }) {
  g.fillStyle = rim;
  rrect(g, x, y + depth, w, h, r);
  g.fill();
  const fy = y + press * depth;
  g.fillStyle = face;
  rrect(g, x, fy, w, h, r);
  g.fill();
  if (stroke > 0 && border) {
    g.strokeStyle = border;
    g.lineWidth = stroke;
    rrect(g, x + stroke / 2, fy + stroke / 2, w - stroke, h - stroke, r - stroke / 2);
    g.stroke();
  }
  return fy;
}

export function icon(g, name, x, y, size, color) {
  const code = assets.icons[name];
  if (code === undefined) throw new Error(`icon ${name}`);
  g.font = `${size}px MaterialIcons`;
  g.letterSpacing = '0px';
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String.fromCodePoint(code), x, y);
}

export { FONT, SERIF };
