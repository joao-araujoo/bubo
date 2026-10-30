// Shots 1–5: the page, the book closing, the dark, the eyes, the light.
import { applyCam, cam, mixCam, project } from '../lib/camera.js';
import { makeCanvas, setText } from '../lib/draw.js';
import { clamp, ease, fbm1, lerp, noise1, seg, shake, spring } from '../lib/math.js';
import { drawBubo } from '../lib/mascot.js';
import { drawSheetShadow, hingeSheet } from '../lib/paper.js';
import { C, H, SERIF, W } from '../lib/tokens.js';
import {
  BOOK,
  LEFT_BOARD,
  PAGE,
  RIGHT_BOARD,
  RIGHT_PAGE,
  buildCover,
  buildLeftSheetFront,
  buildRightPage,
  cloth,
} from './book.js';
import { poseT } from './clock.js';
import { T } from './timeline.js';
import { kineticLine } from './type.js';

let R = null;

function blurredCopy(src, px) {
  const { c, g } = makeCanvas(src.width, src.height);
  g.filter = `blur(${px}px)`;
  g.drawImage(src, 0, 0);
  return c;
}

export function initOpening(paper) {
  const page = buildRightPage({ withPhrase: true });
  const bare = buildRightPage({ withPhrase: false });
  const dark = makeCanvas(W, H);
  dark.g.drawImage(cloth(W, H, 21), 0, 0);
  const v = dark.g.createRadialGradient(W / 2, H * 0.5, 120, W / 2, H * 0.5, H * 0.75);
  v.addColorStop(0, 'rgba(60,22,110,0.0)');
  v.addColorStop(1, 'rgba(8,2,18,0.72)');
  dark.g.fillStyle = v;
  dark.g.fillRect(0, 0, W, H);
  paper.texture('leftFront', buildLeftSheetFront());
  paper.texture('cover', buildCover(2));
  R = {
    page,
    bare,
    pageBlur: blurredCopy(page.canvas, 9),
    bareBlur: blurredCopy(bare.canvas, 9),
    dark: dark.c,
    layer: makeCanvas(W, H),
  };
  return R;
}

// ---------- cameras ----------

function phraseWorld() {
  const p = R.page.phrase;
  return { x: RIGHT_PAGE.x + p.x, y: RIGHT_PAGE.y + p.y, w: p.w };
}

export function openingCam(t) {
  const ph = phraseWorld();
  const hk = ease.outCubic(seg(t, -0.2, 0.5));
  // Macro: the frame stays inside the page (no table visible), drifting with the marker.
  const zoom = lerp(3.35, 3.6, seg(t, -0.1, 0.4));
  const hw = W / 2 / zoom + 24;
  const hh = H / 2 / zoom + 24;
  const mx = Math.min(
    Math.max(lerp(ph.x + ph.w * 0.2, ph.x + ph.w * 0.55, hk), RIGHT_PAGE.x + hw),
    RIGHT_PAGE.x + PAGE.w - hw,
  );
  const my = Math.min(Math.max(ph.y - 4, RIGHT_PAGE.y + hh), RIGHT_PAGE.y + PAGE.h - hh);
  const macro = cam(mx, my, zoom, lerp(-0.03, -0.018, seg(t, 0, 0.4)), 1700);
  const wide = cam(
    BOOK.cx + 30 * seg(t, 0.6, 1),
    BOOK.cy - 70,
    lerp(0.97, 1.06, ease.inOutSine(seg(t, 0.6, 0.98))),
    0,
    1700,
  );
  let c = mixCam(macro, wide, ease.inOutCubic(seg(t, T.pullBack[0], T.pullBack[1])));
  // Into the dark cloth above the title, so the title falls out of the frame below.
  const crash = cam(RIGHT_BOARD.x + RIGHT_BOARD.w / 2, RIGHT_BOARD.y + 200, 6.4, 0.02, 1700);
  c = mixCam(c, crash, ease.inOutCubic(seg(t, T.crash[0], T.crash[1])));
  const sh = shake(t, T.impact, 26, 10, 4);
  return { ...c, x: c.x + sh.x / c.zoom, y: c.y + sh.y / c.zoom, rot: c.rot + sh.r };
}

// ---------- the closing half ----------

function closingSheet(t, c) {
  const k = seg(t, T.close[0], T.close[1]);
  // Lifted by hand at first, then falling under its own weight.
  const phi = Math.PI * (0.12 * k + 0.88 * k ** 2.6);
  const lag = 0.7 * Math.sin(Math.PI * Math.min(k, 1)) ** 1.4;
  const twist = 0.16 * Math.sin(Math.PI * k);
  return hingeSheet({
    rect: LEFT_BOARD,
    hinge: 'right',
    cam: c,
    nx: 60,
    ny: 44,
    angle: (s, q) => phi - lag * s ** 1.7 + twist * (0.5 - q) * s,
  });
}

// ---------- highlight ----------

function drawHighlight(g, t) {
  const ph = R.page.phrase;
  const p = ease.inOutSine(seg(t, T.highlight[0], T.highlight[1]));
  if (p <= 0) return;
  const x0 = RIGHT_PAGE.x + ph.x - 5;
  const x1 = x0 + (ph.w + 10) * p;
  const yTop = RIGHT_PAGE.y + ph.y - 17;
  const yBot = RIGHT_PAGE.y + ph.y + 6;
  g.save();
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = 'rgba(167,139,250,0.62)';
  g.beginPath();
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const x = lerp(x0, x1, i / steps);
    const y = yTop + fbm1(x * 0.05, 3) * 1.6 - (i === 0 ? 0 : 0);
    if (i === 0) g.moveTo(x + 3, y + 2);
    else g.lineTo(x, y);
  }
  // Chisel tip: a slanted end.
  g.lineTo(x1 + 3, yBot - 2);
  for (let i = steps; i >= 0; i--) {
    const x = lerp(x0, x1, i / steps);
    g.lineTo(x, yBot + fbm1(x * 0.05, 9) * 1.6);
  }
  g.closePath();
  g.fill();
  // Ink pools where the marker landed and where it is now.
  g.fillStyle = 'rgba(124,58,237,0.16)';
  g.beginPath();
  g.ellipse(x0 + 4, (yTop + yBot) / 2, 5, 11, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

// ---------- the book in the world ----------

function drawBookBase(g, t, lifted) {
  // Right cover board under the pages, page-block edges (thickness), then the page.
  g.fillStyle = C.bookCloth;
  g.beginPath();
  g.roundRect(RIGHT_BOARD.x, RIGHT_BOARD.y, RIGHT_BOARD.w, RIGHT_BOARD.h, [0, 10, 10, 0]);
  g.fill();
  g.fillStyle = C.paperEdge;
  g.fillRect(RIGHT_PAGE.x + 6, RIGHT_PAGE.y + 4, PAGE.w, PAGE.h);
  for (let i = 0; i < 5; i++) {
    g.fillStyle = i % 2 ? '#EDE4D3' : '#D8CCB6';
    g.fillRect(RIGHT_PAGE.x + PAGE.w + i * 1.2, RIGHT_PAGE.y + 2 + i, 1.2, PAGE.h - 2);
  }
  const src = lifted ? R.bare.canvas : R.page.canvas;
  g.drawImage(src, RIGHT_PAGE.x, RIGHT_PAGE.y, PAGE.w, PAGE.h);
  drawHighlight(g, t);
}

function drawDof(g, t, c, lifted, amount) {
  if (amount <= 0.01) return;
  const L = R.layer;
  L.g.setTransform(1, 0, 0, 1, 0, 0);
  L.g.globalCompositeOperation = 'source-over';
  L.g.clearRect(0, 0, W, H);
  L.g.save();
  applyCam(L.g, c);
  L.g.drawImage(lifted ? R.bareBlur : R.pageBlur, RIGHT_PAGE.x, RIGHT_PAGE.y, PAGE.w, PAGE.h);
  drawHighlight(L.g, t);
  L.g.restore();
  const ph = phraseWorld();
  const focus = project(c, ph.x, ph.y - 6, 0).y;
  L.g.globalCompositeOperation = 'destination-out';
  const grad = L.g.createLinearGradient(0, focus - 360, 0, focus + 360);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.36, 'rgba(0,0,0,1)');
  grad.addColorStop(0.64, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  L.g.fillStyle = grad;
  L.g.fillRect(0, 0, W, H);
  g.save();
  g.globalAlpha = amount;
  g.drawImage(L.c, 0, 0);
  g.restore();
}

// ---------- the words that escape ----------

const WORD_TARGET = { y: 1772, size: 66 };

/** Screen-space state of the three escaping words at time t. */
export function escapedWords(g, t, c) {
  const ph = R.page.phrase;
  setText(g, { weight: 400, size: WORD_TARGET.size, family: SERIF, style: 'italic' });
  const space = g.measureText(' ').width;
  const widths = ph.words.map((w) => g.measureText(w.word).width);
  const total = widths.reduce((a, b) => a + b, 0) + space * 2;
  let tx = W / 2 - total / 2;
  return ph.words.map((wd, i) => {
    const t0 = T.lift[0] + i * 0.05;
    const k = ease.outCubic(seg(t, t0, t0 + 0.55));
    const z = 420 * k;
    const wx = RIGHT_PAGE.x + wd.x + wd.w / 2 + noise1(t * 2 + i, 4) * 6 * k;
    const wy = RIGHT_PAGE.y + wd.y - 6 - 30 * k;
    const p = project(c, wx, wy, z);
    const worldSize = ph.size * c.zoom * p.s;
    const target = { x: tx + widths[i] / 2, y: WORD_TARGET.y };
    tx += widths[i] + space;
    const b = ease.inOutCubic(seg(t, 0.8, 1.06));
    return {
      word: wd.word,
      x: lerp(p.x, target.x, b),
      y: lerp(p.y, target.y, b),
      size: Math.exp(lerp(Math.log(worldSize), Math.log(WORD_TARGET.size), b)),
      rot: lerp(c.rot, 0, b) + noise1(t * 1.3 + i * 3, 8) * 0.06 * k * (1 - b),
      z,
      ink: poseT(t),
      italic: b,
    };
  });
}

export function drawWord(g, w, { alpha = 1, color = null, blur = 0 } = {}) {
  g.save();
  g.globalAlpha *= alpha;
  if (blur > 0.2) g.filter = `blur(${blur.toFixed(2)}px)`;
  g.translate(w.x, w.y);
  g.rotate(w.rot);
  // Ink on paper, purple once airborne, lavender in the dark.
  const col = color ?? (w.ink < 0.6 ? '#2A2118' : w.ink < 0.93 ? C.purple : C.purpleOnDark);
  setText(g, {
    weight: 400,
    size: w.size,
    family: SERIF,
    style: w.italic > 0.5 ? 'italic' : 'normal',
    color: col,
    align: 'center',
  });
  g.fillText(w.word, 0, 0);
  g.restore();
}

// ---------- headline ("Feche o livro." / "Abra a memória.") ----------

export const HEAD = {
  line1: { words: ['Feche', 'o', 'livro.'], y: 420 },
  line2: { words: ['Abra', 'a', 'memória.'], y: 572 },
  size: 124,
};

function bgNight(g, c) {
  g.fillStyle = C.purpleNight;
  g.fillRect(0, 0, W, H);
  const p = project(c, BOOK.cx, BOOK.cy, 0);
  const r = 900 * c.zoom;
  const grad = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(r, 10));
  grad.addColorStop(0, '#6A32C9');
  grad.addColorStop(0.55, '#4A1E98');
  grad.addColorStop(1, '#2A0D5E');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
}

/** Shots 1–2 (t < ~1.1): page macro, pull back, the book closes, crash into the cover. */
export function drawOpening(g, t, paper) {
  const c = openingCam(t);
  const lifted = t >= T.lift[0];
  bgNight(g, c);
  // Soft shadow of the whole book on the table.
  g.save();
  applyCam(g, c);
  g.fillStyle = 'rgba(20,6,40,0.35)';
  g.filter = `blur(${Math.max(4, 22 * c.zoom)}px)`;
  g.fillRect(LEFT_BOARD.x + 10, LEFT_BOARD.y + 18, LEFT_BOARD.w + RIGHT_BOARD.w, LEFT_BOARD.h);
  g.filter = 'none';
  drawBookBase(g, t, lifted);
  g.restore();
  drawDof(g, t, c, lifted, 1 - ease.outCubic(seg(t, T.pullBack[0], T.pullBack[0] + 0.22)));
  // Focus pull: when the command lands, the page falls out of focus behind it.
  const pull = ease.inOutSine(seg(t, 0.1, 0.26)) * (1 - ease.inOutCubic(seg(t, 0.44, 0.6)));
  if (pull > 0) {
    g.save();
    applyCam(g, c);
    g.globalAlpha = pull;
    g.drawImage(lifted ? R.bareBlur : R.pageBlur, RIGHT_PAGE.x, RIGHT_PAGE.y, PAGE.w, PAGE.h);
    g.restore();
  }
  // The closing half and its shadow.
  const mesh = closingSheet(t, c);
  drawSheetShadow(g, mesh, { strength: 0.5, blur: 18 });
  paper.clear();
  paper.draw(mesh, {
    front: 'leftFront',
    back: 'cover',
    diffuse: 0.55,
    spec: 0.3,
    ao: 0.4,
    light: [-0.3, -0.5, 1],
  });
  g.drawImage(paper.canvas, 0, 0);
  // Escaping words (with their shadow on the page while they are low).
  if (lifted) {
    const words = escapedWords(g, t, c);
    for (const w of words) {
      const sh = clamp(1 - seg(t, 0.75, 0.92));
      if (sh > 0) {
        g.save();
        g.filter = `blur(${4 + w.z * 0.04}px)`;
        drawWord(
          g,
          { ...w, x: w.x + w.z * 0.18, y: w.y + w.z * 0.3 },
          { alpha: 0.25 * sh, color: '#3B2A1A' },
        );
        g.restore();
      }
      drawWord(g, w);
    }
  }
  // The dark arrives with the crash zoom.
  const d = seg(t, 1.03, 1.065);
  if (d > 0) {
    g.save();
    g.globalAlpha = d;
    g.drawImage(R.dark, 0, 0);
    g.restore();
  }
}

// ---------- shots 3–5: dark, eyes, light ----------

const EYES = {
  pose: 'neutral',
  // Pupils in the 1254 px file and their midpoint.
  l: { x: 442, y: 520 },
  r: { x: 797, y: 519 },
  mid: { x: 619.5, y: 519.5 },
  ax: 622,
  ay: 1167,
};

/** Bubo's on-screen transform during shots 4–5: eye midpoint fixed, size pulls out. */
export function eyeRig(t) {
  const k = ease.inOutCubic(seg(t, T.pullOut[0], T.pullOut[1]));
  const size = Math.exp(lerp(Math.log(1342), Math.log(600), k));
  const ex = 540;
  const ey = lerp(975, 1000, k);
  const s = size / 1254;
  return {
    size,
    s,
    eye: { x: ex, y: ey },
    feet: { x: ex + (EYES.ax - EYES.mid.x) * s, y: ey + (EYES.ay - EYES.mid.y) * s },
    l: { x: ex + (EYES.l.x - EYES.mid.x) * s, y: ey + (EYES.l.y - EYES.mid.y) * s },
    r: { x: ex + (EYES.r.x - EYES.mid.x) * s, y: ey + (EYES.r.y - EYES.mid.y) * s },
  };
}

function openness(t, t0) {
  const o = clamp(spring(t - t0, 3.6, 0.48), 0, 1.25);
  const b = seg(t, T.blink, T.blink + 0.14);
  const blink = b > 0 && b < 1 ? Math.sin(Math.PI * b) ** 0.6 : 0;
  return o * (1 - 0.94 * blink);
}

function lensPath(g, cx, cy, w, h) {
  // A lens (vesica) of width w and height h: two circular arcs.
  const hw = w / 2;
  const hh = Math.max(h / 2, 0.5);
  const r = (hw * hw + hh * hh) / (2 * hh);
  const a = Math.asin(Math.min(1, hw / r));
  g.beginPath();
  g.arc(cx, cy + r - hh, r, -Math.PI / 2 - a, -Math.PI / 2 + a);
  g.arc(cx, cy - r + hh, r, Math.PI / 2 - a, Math.PI / 2 + a);
  g.closePath();
}

export function irisState(t) {
  const k = ease.inOutCubic(seg(t, T.iris[0], T.iris[1]));
  const rig = eyeRig(t);
  return { k, cx: rig.eye.x, cy: rig.eye.y, w: lerp(760, 4200, k), h: lerp(300, 4200, k ** 1.25) };
}

/** World revealed by the light: lavender canvas, soft floor light. */
export function drawLavender(g) {
  g.fillStyle = C.lavender;
  g.fillRect(-W, -H, W * 3, H * 3);
  const grad = g.createRadialGradient(W / 2, H * 0.52, 60, W / 2, H * 0.52, H * 0.7);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(1, 'rgba(237,228,255,0.0)');
  g.fillStyle = grad;
  g.fillRect(-W, -H, W * 3, H * 3);
}

export function drawDark(g, t, { headline = true, words = true } = {}) {
  g.drawImage(R.dark, 0, 0);
  const rig = eyeRig(t);
  // Eyes in the dark: two masks over the official pose, opening like lids.
  if (t >= T.eyeL) {
    const rr = 168 * rig.s * (1254 / 1254);
    for (const [eye, t0] of [
      [rig.l, T.eyeL],
      [rig.r, T.eyeR],
    ]) {
      const o = openness(t, t0);
      if (o <= 0.002) continue;
      g.save();
      g.beginPath();
      g.ellipse(eye.x, eye.y, rr * (1 + 0.04 * (1 - Math.min(o, 1))), rr * o, 0, 0, Math.PI * 2);
      g.clip();
      drawBubo(g, EYES.pose, { x: rig.feet.x, y: rig.feet.y, size: rig.size });
      g.restore();
    }
  }
  const iris = irisState(t);
  if (iris.k > 0) {
    g.save();
    lensPath(g, iris.cx, iris.cy, iris.w, iris.h);
    g.clip();
    drawLavender(g);
    drawLitBubo(g, t);
    g.restore();
    g.save();
    lensPath(g, iris.cx, iris.cy, iris.w, iris.h);
    g.strokeStyle = C.purpleLight;
    g.lineWidth = 7;
    g.stroke();
    g.restore();
  }
  if (headline) drawHeadline(g, t, iris);
  if (words) {
    for (const w of escapedWords(g, Math.min(t, 1.2), openingCam(Math.min(t, 1.2)))) {
      const drift = {
        ...w,
        y: w.y + Math.sin(t * 1.7 + w.x * 0.01) * 6,
        rot: Math.sin(t * 1.1 + w.x) * 0.03,
      };
      // In the dark the words start to fade (forgetting); when the eyes open, they come back.
      const fadeK =
        ease.inOutSine(seg(t, 1.1, 1.48)) * (1 - ease.outCubic(seg(t, T.eyeR, T.eyeR + 0.3)));
      const memory = 1 - 0.72 * fadeK;
      if (iris.k <= 0) {
        drawWord(g, drift, { alpha: memory, blur: 5 * fadeK });
        continue;
      }
      if (iris.k > 0) {
        g.save();
        g.beginPath();
        g.rect(0, 0, W, H);
        lensPath(g, iris.cx, iris.cy, iris.w, iris.h);
        g.clip('evenodd');
        drawWord(g, drift);
        g.restore();
        g.save();
        lensPath(g, iris.cx, iris.cy, iris.w, iris.h);
        g.clip();
        drawWord(g, drift, { color: C.purple, alpha: 0.85 });
        g.restore();
      } else drawWord(g, drift);
    }
  }
}

/** Bubo after the light: neutral → curious (replacement with squash). */
export function drawLitBubo(g, t) {
  const rig = eyeRig(t);
  const swap = poseT(t) >= T.curious;
  const k = t - T.curious;
  const sq = swap ? 0.13 * Math.exp(-k * 8) * Math.cos(k * 30) : 0;
  const pre = !swap ? 0.06 * seg(t, T.curious - 0.08, T.curious) : 0;
  drawBubo(g, swap ? 'curious' : 'neutral', {
    x: rig.feet.x + (swap ? 14 * rig.s : 0),
    y: rig.feet.y,
    size: rig.size,
    squash: sq + pre,
  });
}

/** The two headline lines; inside the light they are ink, outside white. */
export function drawHeadline(g, t, iris = null, override = null) {
  // Purple over the page, white once the purple table is behind the words.
  const color1 = C.purple;
  const mix = seg(t, 0.44, 0.56);
  const draw = (col) => {
    kineticLine(g, t, {
      words: HEAD.line1.words,
      times: T.words,
      x: W / 2,
      y: override?.y1 ?? HEAD.line1.y,
      size: override?.size ?? HEAD.size,
      color: col,
      squash: { t0: T.impact, amount: 0.16 },
    });
    if (t >= T.open[0] - 0.01)
      kineticLine(g, t, {
        words: HEAD.line2.words,
        times: T.open,
        x: W / 2,
        y: override?.y2 ?? HEAD.line2.y,
        size: override?.size ?? HEAD.size,
        color: col,
      });
  };
  if (!iris || iris.k <= 0) {
    if (mix > 0 && mix < 1) {
      g.save();
      g.globalAlpha = 1 - mix;
      draw(C.purple);
      g.restore();
      g.save();
      g.globalAlpha = mix;
      draw(C.white);
      g.restore();
    } else draw(mix >= 1 ? C.white : color1);
    return;
  }
  g.save();
  g.beginPath();
  g.rect(0, 0, W, H);
  lensPath(g, iris.cx, iris.cy, iris.w, iris.h);
  g.clip('evenodd');
  draw(C.white);
  g.restore();
  g.save();
  lensPath(g, iris.cx, iris.cy, iris.w, iris.h);
  g.clip();
  draw(C.ink);
  g.restore();
}
