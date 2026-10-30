// Bubo components rebuilt from apps/mobile/src/design-system for the film: same tokens, same
// geometry (pt × PT), same copy. Each takes its layout in master pixels and a press/visibility
// state so motion can drive it frame by frame.
import { icon, raised, rrect, setText, wrap } from './draw.js';
import { C, PT, radii, sizes, type } from './tokens.js';

const px = (pt) => pt * PT;

export function textStyle(variant, color = C.ink, extra = {}) {
  const v = type[variant];
  return { weight: v.weight, size: px(v.size), track: px(v.track), color, ...extra };
}

/** Button (Button.tsx): pill, rim 5 pt, face sinks on press. Returns the face rectangle. */
export function button(
  g,
  {
    x,
    y,
    w,
    label,
    icon: ic = null,
    variant = 'primary',
    size = 'lg',
    press = 0,
    compact = false,
    alpha = 1,
  },
) {
  const h = px(size === 'lg' ? sizes.ctaHeight : sizes.touchTarget);
  const pal = {
    primary: { face: C.purple, border: C.purple, rim: C.purpleDeep, text: C.white },
    success: { face: C.green, border: C.green, rim: C.greenRim, text: C.white },
    secondary: { face: C.white, border: C.line, rim: C.secondaryRim, text: C.ink },
  }[variant];
  g.save();
  g.globalAlpha *= alpha;
  const fy = raised(g, {
    x,
    y,
    w,
    h,
    r: h / 2,
    face: pal.face,
    border: pal.border,
    rim: pal.rim,
    depth: px(sizes.rim),
    press,
  });
  const st = textStyle(compact ? 'label' : 'labelLg', pal.text);
  setText(g, st);
  const tw = label ? g.measureText(label).width : 0;
  const iconSize = px(compact ? 18 : 20);
  const gap = px(compact ? 4 : 8);
  const total = (ic ? iconSize + (label ? gap : 0) : 0) + tw;
  let cx = x + w / 2 - total / 2;
  const cy = fy + h / 2;
  if (ic) {
    icon(g, ic, cx + iconSize / 2, cy, iconSize, pal.text);
    cx += iconSize + gap;
  }
  if (label) {
    setText(g, { ...st, baseline: 'middle' });
    g.fillText(label, cx, cy + 1);
  }
  g.restore();
  return { x, y: fy, w, h };
}

/** Card (Card.tsx): white face, 2 pt lineSoft stroke, 4 pt solid rim, radius 24 pt. */
export function card(g, { x, y, w, h, tone = 'default', press = 0 }) {
  return raised(g, {
    x,
    y,
    w,
    h,
    r: px(radii.card),
    face: tone === 'muted' ? C.lavenderMuted : C.white,
    border: C.lineSoft,
    rim: C.line,
    depth: px(sizes.cardRim),
    press,
  });
}

/** Chip (Chip.tsx). Returns its width. */
export function chip(
  g,
  { x, y, label, tone = 'primary', icon: ic = null, eyebrow = false, align = 'left' },
) {
  const tones = {
    primary: { bg: C.purpleSoft, fg: C.purple },
    gold: { bg: C.goldSoft, fg: C.ink },
    orange: { bg: C.orangeSoft, fg: C.ink },
    success: { bg: C.green, fg: C.white },
  }[tone];
  const st = textStyle(eyebrow ? 'caption' : 'label', tones.fg);
  setText(g, st);
  const str = eyebrow ? label.toUpperCase() : label;
  const tw = g.measureText(str).width;
  const iconSize = px(16);
  const padX = px(12);
  const h = px(type[eyebrow ? 'caption' : 'label'].line) + px(12);
  const w = padX * 2 + tw + (ic ? iconSize + px(4) : 0);
  const left = align === 'center' ? x - w / 2 : x;
  g.fillStyle = tones.bg;
  rrect(g, left, y, w, h, h / 2);
  g.fill();
  let cx = left + padX;
  if (ic) {
    icon(g, ic, cx + iconSize / 2, y + h / 2, iconSize, tones.fg);
    cx += iconSize + px(4);
  }
  setText(g, { ...st, baseline: 'middle' });
  g.fillText(str, cx, y + h / 2 + 1);
  return { w, h };
}

/**
 * TextField (TextField.tsx): label above, 14 pt radius box, 2 pt stroke (purple when focused,
 * with the soft focus ring), icon at the left. `lines` is the visible text (already wrapped).
 */
export function field(
  g,
  {
    x,
    y,
    w,
    label,
    ic,
    lines = [],
    placeholder = '',
    minH = 56,
    focus = 0,
    textAlpha = 1,
    caret = -1,
  },
) {
  setText(g, textStyle('label'));
  g.fillText(label, x, y + px(14));
  const by = y + px(18) + px(4);
  const bodyLine = px(type.body.line);
  const h = Math.max(px(minH), px(32) + Math.max(1, lines.length) * bodyLine);
  if (focus > 0) {
    g.save();
    g.globalAlpha = focus;
    g.fillStyle = C.purpleSoft;
    rrect(g, x - px(3), by - px(3), w + px(6), h + px(6), px(radii.input + 3));
    g.fill();
    g.restore();
  }
  g.fillStyle = C.white;
  rrect(g, x, by, w, h, px(radii.input));
  g.fill();
  g.lineWidth = px(sizes.borderWidth);
  g.strokeStyle = focus > 0.5 ? C.purple : C.line;
  rrect(g, x + px(1), by + px(1), w - px(2), h - px(2), px(radii.input - 1));
  g.stroke();
  const ix = x + px(12) + px(12);
  icon(g, ic, ix, by + px(16) + bodyLine / 2 - px(4), px(24), C.inkMuted);
  const tx = ix + px(12) + px(8);
  const ty = by + px(16) + px(15);
  if (!lines.length && placeholder) {
    setText(g, textStyle('body', C.inkMuted));
    g.fillText(placeholder, tx, ty);
  }
  g.save();
  g.globalAlpha *= textAlpha;
  setText(g, textStyle('body', C.ink));
  lines.forEach((ln, i) => g.fillText(ln, tx, ty + i * bodyLine));
  g.restore();
  if (caret >= 0 && lines.length) {
    const last = lines[lines.length - 1];
    setText(g, textStyle('body', C.ink));
    const cx = tx + g.measureText(last).width + px(2);
    if (caret > 0.5) {
      g.fillStyle = C.purple;
      g.fillRect(cx, ty + (lines.length - 1) * bodyLine - px(14), px(2), px(18));
    }
  }
  return { x, y: by, w, h, tx, ty, bottom: by + h };
}

/** InlineMessage (InlineMessage.tsx). */
export function inlineMessage(g, { x, y, w, tone = 'success', message, alpha = 1 }) {
  const tones = {
    success: { bg: C.purpleSoft, ic: 'check-circle', color: C.green },
    info: { bg: C.lavenderMuted, ic: 'info-outline', color: C.purple },
  }[tone];
  g.save();
  g.globalAlpha *= alpha;
  const lines = wrap(g, message, w - px(12 * 2 + 20 + 8), textStyle('bodySm'));
  const h = px(12) * 2 + lines.length * px(type.bodySm.line);
  g.fillStyle = tones.bg;
  rrect(g, x, y, w, h, px(radii.md));
  g.fill();
  icon(g, tones.ic, x + px(12) + px(10), y + px(12) + px(9), px(20), tones.color);
  setText(g, textStyle('bodySm'));
  lines.forEach((ln, i) =>
    g.fillText(ln, x + px(12 + 20 + 8), y + px(12) + px(13) + i * px(type.bodySm.line)),
  );
  g.restore();
  return { h };
}

export { px };
