// Shots 5–7: the headline lands as the real title of the recall screen
// (apps/mobile/src/app/sessao/[id].tsx → FinishStep), the escaped words become the reader's own
// words in "1. Qual ideia, cena ou imagem ficou?", Conferir, Salvar sessão, and the whole screen
// turns like a book page to reveal the days.
import { applyCam, cam, mixCam } from '../lib/camera.js';
import { icon, makeCanvas, setText, wrap } from '../lib/draw.js';
import { clamp, ease, hop, lerp, seg, spring } from '../lib/math.js';
import { drawBubo, drawContact } from '../lib/mascot.js';
import { drawSheetShadow, hingeSheet } from '../lib/paper.js';
import { C, H, W, type } from '../lib/tokens.js';
import { button, card, field, px, textStyle } from '../lib/ui.js';
import {
  HEAD,
  drawLavender,
  drawLitBubo,
  drawWord,
  escapedWords,
  eyeRig,
  openingCam,
} from './opening.js';
import { poseT } from './clock.js';
import { T } from './timeline.js';
import { drawKerned, layoutWords } from './type.js';

const GUTTER = px(16);
const CONTENT_W = W - GUTTER * 2;
const TOP = 196;
const FIELD_H = 70;

export const L = {
  heading: { x: GUTTER, y1: TOP + px(24), y2: TOP + px(56), size: px(24) },
  f1: { y: TOP + px(88) },
  f2: { y: TOP + px(198) },
  f3: { y: TOP + px(308) },
  assess: { y: TOP + px(420) },
  bubo: { x: 862, y: TOP + px(56) + 4, size: 330 },
};
const BTN_Y = H - px(16) - px(5) - px(56);

const ANSWER = ['Os', 'olhos', 'de', 'Capitu:', 'de', 'ressaca.'];
/** Answer word index → escaped word index (escaped: Olhos, de, ressaca). */
const FLOWN = { 1: 0, 4: 1, 5: 2 };
const DETAIL = 'Uma força que puxa para dentro, como a maré.';
const LINK = 'Bentinho já tem medo de se perder nela?';

let screen = null;

export function initRecall(paper) {
  screen = makeCanvas(W, H);
  paper.texture('paperBack', paperBack());
}

function paperBack() {
  const { c, g } = makeCanvas(540, 960);
  g.fillStyle = '#FBF8FF';
  g.fillRect(0, 0, 540, 960);
  const grad = g.createLinearGradient(0, 0, 540, 0);
  grad.addColorStop(0, 'rgba(237,228,255,0.9)');
  grad.addColorStop(1, 'rgba(237,228,255,0.0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 540, 960);
  return c;
}

// ---------- timing helpers ----------

function rise(t, t0) {
  const k = t - t0;
  if (k < 0) return { a: 0, dy: 180 };
  return { a: clamp(k / 0.08), dy: (1 - spring(k, 2.6, 0.62)) * 180 };
}

export function recallCam(t) {
  const a = cam(W / 2, H / 2, 1, 0, 2600);
  const zoom = 1.22;
  const b = cam(30 + W / 2 / zoom, 770, zoom, 0, 2600);
  const k = ease.inOutCubic(seg(t, 3.0, 3.34)) * (1 - ease.inOutCubic(seg(t, 4.5, 4.78)));
  return mixCam(a, b, k);
}

function typed(t) {
  const words = [];
  ANSWER.forEach((w, i) => {
    const t0 = T.type[i];
    if (t < t0) return;
    if (FLOWN[i] !== undefined) words.push(w);
    else {
      const n = Math.min(w.length, Math.floor(((t - t0) / 0.16) * w.length) + 1);
      words.push(w.slice(0, n));
    }
  });
  return words;
}

function fastText(t, str, t0, t1) {
  const n = Math.round(clamp((t - t0) / (t1 - t0)) * str.length);
  return str.slice(0, n);
}

function boxTop(y) {
  return y + px(18) + px(4);
}

// ---------- the screen ----------

/** Draws the recall screen content (no camera); used live and as the page-turn texture. */
export function drawRecallScreen(g, t, { headingDrawn = true } = {}) {
  drawLavender(g);
  if (headingDrawn) {
    drawHeadingLine(g, HEAD.line1.words, L.heading.x, L.heading.y1, L.heading.size);
    drawHeadingLine(g, HEAD.line2.words, L.heading.x, L.heading.y2, L.heading.size);
  }
  const items = [
    { t0: T.ui[0], draw: drawField1 },
    { t0: T.ui[0] + 0.06, draw: drawField2 },
    { t0: T.ui[0] + 0.12, draw: drawField3 },
    { t0: T.conferir + 0.03, draw: drawAssessment },
  ];
  for (const it of items) {
    const r = rise(t, it.t0);
    if (r.a <= 0) continue;
    g.save();
    g.globalAlpha *= r.a;
    g.translate(0, r.dy);
    it.draw(g, t);
    g.restore();
  }
  drawFooter(g, t);
}

export function field1Geometry() {
  const by = boxTop(L.f1.y);
  return { tx: GUTTER + px(12 + 12 + 12 + 8), ty: by + px(16) + px(15), by };
}

function drawField1(g, t) {
  const words = typed(t);
  const focus = seg(t, 3.05, 3.2) * (1 - seg(t, 4.55, 4.65));
  const caret = t > 3.05 && t < 4.6 ? (Math.floor(t * 4) % 2 === 0 ? 1 : 0) : -1;
  field(g, {
    x: GUTTER,
    y: L.f1.y,
    w: CONTENT_W,
    label: '1. Qual ideia, cena ou imagem ficou?',
    ic: 'edit-note',
    lines: words.length ? [words.join(' ')] : [],
    placeholder: words.length ? '' : 'Conte com suas palavras o que você lembra.',
    minH: FIELD_H,
    focus,
    caret,
  });
}

function drawField2(g, t) {
  const st = textStyle('body');
  const text = fastText(t, DETAIL, T.fastFill[0], T.fastFill[0] + 0.18);
  const lines = text ? wrap(g, text, CONTENT_W - px(60), st) : [];
  field(g, {
    x: GUTTER,
    y: L.f2.y,
    w: CONTENT_W,
    label: '2. Que detalhe ajuda a lembrar disso?',
    ic: 'search',
    lines,
    placeholder: 'Uma ação, um exemplo, um argumento…',
    minH: FIELD_H,
  });
}

function drawField3(g, t) {
  const st = textStyle('body');
  const text = fastText(t, LINK, T.fastFill[0] + 0.12, T.fastFill[1]);
  const lines = text ? wrap(g, text, CONTENT_W - px(60), st) : [];
  field(g, {
    x: GUTTER,
    y: L.f3.y,
    w: CONTENT_W,
    label: '3. Que ligação ou dúvida surgiu?',
    ic: 'psychology',
    lines,
    placeholder: 'O que isso explica ou faz você perguntar?',
    minH: FIELD_H,
  });
}

function drawAssessment(g) {
  const y = L.assess.y;
  const h = px(98);
  card(g, { x: GUTTER, y, w: CONTENT_W, h });
  icon(g, 'check-circle', GUTTER + px(16) + px(12), y + px(16) + px(12), px(24), C.green);
  setText(g, textStyle('titleSm'));
  g.fillText('Recordação pronta para guardar', GUTTER + px(16 + 24 + 8), y + px(16) + px(18));
  const st = textStyle('bodySm', C.inkMuted);
  const lines = wrap(
    g,
    'Exercício preenchido! Amanhã, tente lembrar de novo antes de abrir sua nota.',
    CONTENT_W - px(32),
    st,
  );
  setText(g, st);
  lines.forEach((ln, i) =>
    g.fillText(ln, GUTTER + px(16), y + px(16 + 24 + 16) + i * px(type.bodySm.line)),
  );
}

export function footerButtons() {
  const gap = px(8);
  const iconW = px(56);
  const rest = CONTENT_W - iconW - gap * 2;
  const w1 = rest / 2.2;
  const w2 = rest - w1;
  return {
    discard: { x: GUTTER, y: BTN_Y, w: iconW },
    conferir: { x: GUTTER + iconW + gap, y: BTN_Y, w: w1 },
    salvar: { x: GUTTER + iconW + gap * 2 + w1, y: BTN_Y, w: w2 },
  };
}

export function pressAt(t, t0) {
  const k = t - t0;
  if (k < -0.06 || k > 0.2) return 0;
  if (k < 0) return 1 + k / 0.06;
  return 1 - ease.outCubic(clamp((k - 0.06) / 0.14));
}

function drawFooter(g, t) {
  const r = rise(t, T.ui[0] + 0.18);
  if (r.a <= 0) return;
  g.save();
  g.globalAlpha *= r.a;
  g.translate(0, r.dy * 0.6);
  g.fillStyle = C.lavender;
  g.fillRect(0, BTN_Y - px(16), W, H);
  g.fillStyle = C.lineSoft;
  g.fillRect(0, BTN_Y - px(16), W, px(1));
  const b = footerButtons();
  button(g, {
    ...b.discard,
    label: '',
    icon: 'delete-outline',
    variant: 'secondary',
    compact: true,
  });
  button(g, {
    ...b.conferir,
    label: 'Conferir',
    icon: 'fact-check',
    variant: 'secondary',
    compact: true,
    press: pressAt(t, T.conferir),
  });
  button(g, {
    ...b.salvar,
    label: 'Salvar sessão',
    icon: 'check',
    variant: 'primary',
    compact: true,
    press: pressAt(t, T.salvar),
    alpha: t >= T.conferir + 0.05 ? 1 : 0.5,
  });
  g.restore();
}

// ---------- headline migration (big kinetic lines → the screen title) ----------

/** A heading line drawn word by word (same layout as the kinetic lines, optical kerning). */
function drawHeadingLine(g, words, x, y, size) {
  const lay = layoutWords(g, words, { size });
  for (const item of lay.items) {
    g.save();
    g.translate(x + item.x + item.w / 2, y);
    setText(g, { weight: 800, size, color: C.ink, track: -0.02 * size, align: 'center' });
    drawKerned(g, item.word, size);
    g.restore();
  }
}

export function drawMigratingHeadline(g, t) {
  const lines = [
    { words: HEAD.line1.words, from: HEAD.line1.y, to: L.heading.y1 },
    { words: HEAD.line2.words, from: HEAD.line2.y, to: L.heading.y2 },
  ];
  lines.forEach((ln, i) => {
    const kk = ease.inOutCubic(seg(t, T.heading[0] + i * 0.04, T.heading[1] + i * 0.04));
    const big = layoutWords(g, ln.words, { size: HEAD.size });
    const small = layoutWords(g, ln.words, { size: L.heading.size });
    const size = Math.exp(lerp(Math.log(HEAD.size), Math.log(L.heading.size), kk));
    const y = lerp(ln.from, ln.to, kk);
    big.items.forEach((item, w) => {
      const a = W / 2 - big.width / 2 + item.x + item.w / 2;
      const b = L.heading.x + small.items[w].x + small.items[w].w / 2;
      g.save();
      g.translate(lerp(a, b, kk), y);
      setText(g, { weight: 800, size, color: C.ink, track: -0.02 * size, align: 'center' });
      drawKerned(g, item.word, size);
      g.restore();
    });
  });
}

// ---------- Bubo during the recall ----------

export function drawRecallBubo(g, t, c) {
  if (t >= T.padHop[0]) return;
  if (t < T.notesHop[0] - 0.08) {
    drawLitBubo(g, t);
    return;
  }
  // From the centre of the light to the corner of the title, landing on "Abra a memória.".
  const rig = eyeRig(T.notesHop[0]);
  const from = { x: rig.feet.x + 14 * rig.s, y: rig.feet.y, size: rig.size };
  const to = L.bubo;
  if (t < T.notesHop[0]) {
    const a = seg(t, T.notesHop[0] - 0.08, T.notesHop[0]);
    drawBubo(g, 'curious', { ...from, squash: 0.16 * Math.sin(Math.PI * a * 0.5) });
    return;
  }
  const k = seg(t, T.notesHop[0], T.notesHop[1]);
  if (k < 1) {
    const e = ease.inOutCubic(k);
    drawBubo(g, 'curious', {
      x: lerp(from.x, to.x, e),
      y: lerp(from.y, to.y, e) - hop(k) * 240,
      size: lerp(from.size, to.size, e),
      squash: -0.12 * Math.sin(Math.PI * k),
      rot: 0.3 * Math.sin(Math.PI * k),
    });
    return;
  }
  const land = t - T.notesHop[1];
  const pose = poseT(t) >= T.idea ? 'idea' : 'taking-notes';
  const ki = t - T.idea;
  // Writing along on the beat; the idea pops when the recall is checked.
  const bob =
    t > 3.2 && t < T.idea ? Math.max(0, Math.sin(((t - 3.25) / 0.25) * Math.PI)) * 0.04 : 0;
  const sq =
    0.16 * Math.exp(-land * 9) * Math.cos(land * 28) +
    (t >= T.idea ? 0.16 * Math.exp(-ki * 8) * Math.cos(ki * 30) : bob);
  g.save();
  applyCam(g, c);
  drawContact(g, { x: to.x, y: to.y, size: to.size });
  drawBubo(g, pose, { x: to.x, y: to.y, size: to.size, squash: sq });
  g.restore();
}

// ---------- the escaped words become the reader's words ----------

function toScreen(c, x, y) {
  return { x: (x - c.x) * c.zoom + W / 2, y: (y - c.y) * c.zoom + H / 2 };
}

function hoverSpots(g, t) {
  const f = field1Geometry();
  setText(g, { weight: 400, size: 50, family: 'Literata', style: 'italic' });
  const names = ['Olhos', 'de', 'ressaca'];
  const space = g.measureText(' ').width;
  let x = f.tx + 210;
  return names.map((n, i) => {
    const w = g.measureText(n).width;
    const spot = {
      x: x + w / 2,
      y: f.ty + px(22) + 8 + Math.sin(t * 2.2 + i * 1.7) * 5,
      rot: Math.sin(t * 1.6 + i) * 0.04,
    };
    x += w + space;
    return spot;
  });
}

export function drawFlyingWords(g, t, c) {
  const f = field1Geometry();
  setText(g, textStyle('body'));
  const space = g.measureText(' ').width;
  const offs = [];
  let x = f.tx;
  for (const w of ANSWER) {
    offs.push(x);
    x += g.measureText(w).width + space;
  }
  const dark = escapedWords(g, 1.2, openingCam(1.2));
  const spots = hoverSpots(g, t);
  for (const [ai, fi] of Object.entries(FLOWN)) {
    const i = Number(ai);
    const land = T.type[i];
    if (t >= land) continue;
    const w = dark[fi];
    // 1) from the row in the dark to a spot inside the field, as the field rises.
    const kIn = ease.inOutCubic(seg(t, 2.5 + fi * 0.02, 3.0 + fi * 0.02));
    const drift = { x: w.x, y: w.y + Math.sin(t * 1.7 + w.x * 0.01) * 6 };
    const lift = rise(t, T.ui[0]);
    const spot = toScreen(c, spots[fi].x, spots[fi].y + lift.dy);
    let pos = { x: lerp(drift.x, spot.x, kIn), y: lerp(drift.y, spot.y, kIn) - hop(kIn) * 40 };
    let size = lerp(w.size, 50 * c.zoom, kIn);
    let rot = lerp(Math.sin(t * 1.1 + w.x) * 0.03, spots[fi].rot, kIn);
    // 2) on its beat, into the line of text.
    const kT = ease.inOutCubic(seg(t, land - 0.22, land));
    if (kT > 0) {
      setText(g, textStyle('body'));
      const ww = g.measureText(ANSWER[i]).width;
      const target = toScreen(c, offs[i] + ww / 2, f.ty - px(5));
      pos = { x: lerp(pos.x, target.x, kT), y: lerp(pos.y, target.y, kT) - hop(kT) * 70 };
      size = lerp(size, px(type.body.size) * c.zoom * 1.12, kT);
      rot = lerp(rot, 0, kT);
    }
    drawWord(g, { ...w, ...pos, size, rot, italic: 1 }, { color: C.purple });
  }
}

/** A ring where a flown word lands (the moment serif becomes sans). */
export function drawLandingPops(g, t, c) {
  const f = field1Geometry();
  setText(g, textStyle('body'));
  const space = g.measureText(' ').width;
  let x = f.tx;
  ANSWER.forEach((w, i) => {
    const ww = g.measureText(w).width;
    const k = t - T.type[i];
    if (FLOWN[i] !== undefined && k >= 0 && k < 0.24) {
      const p = toScreen(c, x + ww / 2, f.ty - px(6));
      const r = (ww / 2 + 14 + k * 140) * c.zoom;
      g.save();
      g.globalAlpha = (1 - k / 0.24) * 0.6;
      g.strokeStyle = C.purpleLight;
      g.lineWidth = 5;
      g.beginPath();
      g.ellipse(p.x, p.y, r, r * 0.42, 0, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
    x += ww + space;
  });
}

// ---------- the finger ----------

export function drawFinger(g, t, c) {
  const b = footerButtons();
  const bh = px(56);
  const pts = [
    { x: b.conferir.x + b.conferir.w / 2, y: b.conferir.y + bh / 2 },
    { x: b.salvar.x + b.salvar.w / 2, y: b.salvar.y + bh / 2 },
  ];
  if (t < T.conferir - 0.25 || t > T.salvar + 0.2) return;
  const enter = ease.outCubic(seg(t, T.conferir - 0.25, T.conferir - 0.06));
  const move = ease.inOutCubic(seg(t, T.conferir + 0.08, T.salvar - 0.05));
  const x = lerp(pts[0].x, pts[1].x, move) + 40;
  const y = lerp(pts[0].y, pts[1].y, move) + 30 - hop(move) * 60 + (1 - enter) * 300;
  const press = Math.max(pressAt(t, T.conferir), pressAt(t, T.salvar));
  const p = toScreen(c, x, y);
  const exit = seg(t, T.salvar + 0.08, T.salvar + 0.2);
  drawTouch(
    g,
    p.x,
    p.y + exit * 220,
    press,
    1 - exit,
    [T.conferir, T.salvar].map((t0) => t - t0),
  );
}

export function drawTouch(g, x, y, press, alpha, since = []) {
  g.save();
  g.globalAlpha = alpha;
  for (const k of since) {
    if (k < 0 || k > 0.35) continue;
    g.save();
    g.globalAlpha = alpha * (1 - k / 0.35) * 0.55;
    g.strokeStyle = C.purpleLight;
    g.lineWidth = 6;
    g.beginPath();
    g.arc(x, y, 46 + k * 260, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }
  const r = 44 * (1 - 0.14 * press);
  g.fillStyle = 'rgba(33,21,47,0.16)';
  g.beginPath();
  g.arc(x + 4, y + 8, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.94)';
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 5;
  g.strokeStyle = C.purple;
  g.stroke();
  g.restore();
}

// ---------- shot 7: the screen turns like a book page ----------

/**
 * Angle field of a page turned from its free (right) edge: the corner leads while it lifts,
 * the edge trails while it falls, the top corner travels a little ahead of the bottom one.
 */
export function pageTurnAngle(k) {
  const e = ease.inOutCubic(k);
  const phi = Math.PI * e;
  const bend = 1.1 * Math.sin(Math.PI * k);
  const twist = 0.3 * Math.sin(Math.PI * k);
  const lead = 1 - 2 * k;
  return (s, q) =>
    Math.min(Math.PI, Math.max(0, phi + bend * lead * s ** 1.7 + twist * (0.5 - q) * s));
}

export function recallTurnMesh(t, c) {
  const k = seg(t, T.flipOut[0], T.flipOut[1]);
  return hingeSheet({
    rect: { x: 0, y: 0, w: W, h: H },
    hinge: 'left',
    cam: c,
    nx: 64,
    ny: 40,
    angle: pageTurnAngle(k),
  });
}

/** Shots 5→7 compositor. During the turn the screen is a WebGL page. */
export function drawRecall(g, t, paper) {
  const c = recallCam(t);
  if (t < T.flipOut[0]) {
    g.save();
    applyCam(g, c);
    drawRecallScreen(g, t, { headingDrawn: t >= T.heading[1] + 0.05 });
    g.restore();
    if (t < T.heading[1] + 0.05) drawMigratingHeadline(g, t);
    drawLandingPops(g, t, c);
    drawFlyingWords(g, t, c);
    drawRecallBubo(g, t, c);
    drawFinger(g, t, c);
    return;
  }
  screen.g.setTransform(1, 0, 0, 1, 0, 0);
  drawRecallScreen(screen.g, t);
  paper.texture('recall', screen.c);
  const flat = cam(W / 2, H / 2, 1, 0, 3200);
  const mesh = recallTurnMesh(t, flat);
  drawSheetShadow(g, mesh, { strength: 0.3, blur: 30 });
  paper.clear();
  paper.draw(mesh, { front: 'recall', back: 'paperBack', diffuse: 0.7, spec: 0.35, ao: 0.2 });
  g.drawImage(paper.canvas, 0, 0);
}
