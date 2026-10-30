// Shots 8–9: the memory comes back on the days the real SM-2 schedule brings it back
// (packages/scoring/src/retention.ts with "Lembrei" every time: 1, 2, 8, 23, 61). Each review
// page is the real review card (apps/mobile/src/app/revisao.tsx): "Hora de lembrar", the prompt
// the API generates ("O que ficou com você de “Dom Casmurro” (págs. 61–68)?"), "Sua nota",
// Lembrei / Quase / Esqueci. Days without a review show the app's real empty state. The pages
// are a book of days turning in WebGL; Bubo perches on its top edge and skips each page.
import { applyCam, cam } from '../lib/camera.js';
import { icon, makeCanvas, rrect, setText, wrap } from '../lib/draw.js';
import { clamp, ease, hop, lerp, seg } from '../lib/math.js';
import { drawBubo, drawContact } from '../lib/mascot.js';
import { hingeSheet } from '../lib/paper.js';
import { C, H, W, type } from '../lib/tokens.js';
import { button, chip, px, textStyle } from '../lib/ui.js';
import { drawLavender } from './opening.js';
import { L as RL, drawTouch, pageTurnAngle } from './recall.js';
import { poseT } from './clock.js';
import { T } from './timeline.js';

export const PAD = { x: 104, y: 600, w: 912, h: 1210 };
export const SPINE = { x: PAD.x - 44, w: 60 };
const TEX = 1.25;
const PROMPT = 'O que ficou com você de “Dom Casmurro” (págs. 61–68)?';
const NOTE = 'Ideia: Os olhos de Capitu: de ressaca.';
/** How much of the note's ink is left when the card comes back (it fades less each time). */
const INK0 = { 1: 0.2, 2: 0.4, 8: 0.56, 23: 0.72, 61: 0.86 };
const LEFT = 64;
const RIGHT = 44;

let pages = null;

const FLIGHT_SLOTS = 10;

export function initReview() {
  pages = Array.from({ length: FLIGHT_SLOTS + 1 }, () =>
    makeCanvas(Math.round(PAD.w * TEX), Math.round(PAD.h * TEX)),
  );
}

// ---------- schedule ----------

function dayInfo(day) {
  return T.days.find((d) => d.day === day) ?? null;
}

function allTurns() {
  const out = [];
  for (const run of T.flips) {
    for (let i = 0; i < run.count; i++)
      out.push({ day: run.from + i, start: run.start + i * run.gap, dur: run.dur });
  }
  out.push({ day: 61, start: T.summaryFlip[0], dur: T.summaryFlip[1] - T.summaryFlip[0] });
  return out;
}
const TURNS = allTurns();

function pageState(day, t) {
  const d = dayInfo(day);
  if (!d) return { quiet: true };
  const pr = (t0) => {
    const k = t - t0;
    if (k < -0.05 || k > 0.18) return 0;
    if (k < 0) return 1 + k / 0.05;
    return 1 - ease.outCubic(clamp((k - 0.04) / 0.14));
  };
  return {
    quiet: false,
    revealed: ease.outCubic(seg(t, d.reveal, d.reveal + 0.12)),
    ink:
      t < d.grade ? INK0[day] : lerp(INK0[day], 1, ease.outCubic(seg(t, d.grade, d.grade + 0.16))),
    inkPulse:
      t >= d.grade ? Math.exp(-(t - d.grade) * 7) * Math.max(0, Math.sin((t - d.grade) * 18)) : 0,
    graded: seg(t, d.grade + 0.03, d.grade + 0.11),
    pressReveal: pr(d.reveal),
    pressGrade: pr(d.grade),
  };
}

// ---------- one page (page-local px) ----------

function pageBase(g) {
  g.fillStyle = C.white;
  rrect(g, -30, 0, PAD.w + 30, PAD.h, px(24));
  g.fill();
  // Gutter shade near the spine.
  const gr = g.createLinearGradient(0, 0, 70, 0);
  gr.addColorStop(0, 'rgba(91,33,182,0.10)');
  gr.addColorStop(1, 'rgba(91,33,182,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 70, PAD.h);
}

function drawQuietPage(g, day) {
  setText(g, { weight: 800, size: 150, color: C.purpleLight, track: -4 });
  g.fillText(`dia ${day}`, LEFT - 6, 236);
  setText(g, textStyle('title', C.inkMuted));
  g.fillText('Nada para revisar agora', LEFT, 410);
  setText(g, textStyle('body', C.inkMuted));
  g.fillText('Seus cards voltam no dia certo.', LEFT, 410 + px(30));
}

function layoutPrompt(g) {
  const cw = PAD.w - LEFT - RIGHT;
  const lines = wrap(g, PROMPT, cw, textStyle('title'));
  const ny = 400 + lines.length * px(type.title.line) - 10;
  return { cw, lines, ny, nh: 230, ay: ny + 230 + 40 };
}

function drawReviewPage(g, day, st) {
  const { cw, lines, ny, nh, ay } = layoutPrompt(g);
  setText(g, textStyle('caption', C.purpleInk, { track: px(1.3) }));
  g.fillText('HORA DE LEMBRAR', LEFT, 86);
  setText(g, { weight: 800, size: 150, color: C.purple, track: -4 });
  g.fillText(`dia ${day}`, LEFT - 6, 236);
  chip(g, { x: LEFT, y: 270, label: 'Dom Casmurro', icon: 'menu-book' });
  setText(g, textStyle('title'));
  lines.forEach((ln, i) => g.fillText(ln, LEFT, 400 + i * px(type.title.line)));
  // Sua nota — its ink fades between reviews and comes back on "Lembrei".
  g.fillStyle = C.purpleSoft;
  rrect(g, LEFT, ny, cw, nh, px(16));
  g.fill();
  setText(g, textStyle('caption', C.purple, { track: px(0.44) }));
  g.fillText('SUA NOTA', LEFT + px(16), ny + 64);
  const nst = textStyle('bodyLg');
  const nlines = wrap(g, NOTE, cw - px(32), nst);
  g.save();
  g.beginPath();
  g.rect(LEFT, ny, cw, nh);
  g.clip();
  const pulse = 1 + 0.06 * st.inkPulse;
  nlines.forEach((ln, i) => {
    g.save();
    g.translate(LEFT + px(16), ny + 128 + i * px(type.bodyLg.line));
    g.scale(pulse, pulse);
    setText(g, { ...nst, color: `rgba(33,21,47,${st.ink})` });
    g.fillText(ln, 0, 0);
    g.restore();
  });
  if (st.revealed < 1) {
    // "Sem espiar": a veil slides off the note when the reader asks to see it.
    const vx = LEFT + cw * ease.inOutCubic(st.revealed);
    g.fillStyle = C.lavenderMuted;
    rrect(g, vx, ny, cw, nh, px(16));
    g.fill();
    g.strokeStyle = C.lineSoft;
    g.lineWidth = px(2);
    g.stroke();
    icon(g, 'visibility-off', vx + px(16) + px(12), ny + nh / 2, px(24), C.inkMuted);
    setText(g, textStyle('body', C.inkMuted));
    g.fillText('Sem espiar: tente lembrar antes.', vx + px(16 + 24 + 10), ny + nh / 2 + px(5));
  }
  g.restore();
  if (st.graded > 0) {
    g.save();
    g.globalAlpha = st.graded;
    g.fillStyle = C.green;
    g.fillRect(LEFT, ay, px(2), 150);
    icon(g, 'check', LEFT + px(14) + px(12), ay + 34, px(24), C.green);
    setText(g, textStyle('labelLg'));
    g.fillText('Lembrei · revisão salva', LEFT + px(14 + 24 + 8), ay + 46);
    const mst = textStyle('bodySm');
    const mlines = wrap(
      g,
      'A ideia ficou com você. Continue cultivando essa lembrança.',
      cw - px(24),
      mst,
    );
    setText(g, mst);
    mlines.forEach((ln, i) => g.fillText(ln, LEFT + px(14), ay + 104 + i * px(type.bodySm.line)));
    g.restore();
  } else if (st.revealed >= 1) {
    setText(g, textStyle('label', C.inkMuted, { align: 'center' }));
    g.fillText('Quanto você lembrou?', LEFT + cw / 2, ay + 26);
    const gap = px(4);
    const bw = (cw - gap * 2) / 3;
    const by = ay + 50;
    button(g, {
      x: LEFT,
      y: by,
      w: bw,
      label: 'Lembrei',
      icon: 'check',
      variant: 'primary',
      size: 'md',
      compact: true,
      press: st.pressGrade,
    });
    button(g, {
      x: LEFT + bw + gap,
      y: by,
      w: bw,
      label: 'Quase',
      icon: 'psychology',
      variant: 'secondary',
      size: 'md',
      compact: true,
    });
    button(g, {
      x: LEFT + (bw + gap) * 2,
      y: by,
      w: bw,
      label: 'Esqueci',
      icon: 'replay',
      variant: 'secondary',
      size: 'md',
      compact: true,
    });
  } else {
    button(g, {
      x: LEFT,
      y: ay + 30,
      w: cw,
      label: 'Mostrar minha nota',
      icon: 'visibility',
      variant: 'primary',
      size: 'lg',
      press: st.pressReveal,
    });
  }
}

function buttonSpots() {
  const { g } = makeCanvas(4, 4);
  const { cw, ay } = layoutPrompt(g);
  const bw = (cw - px(4) * 2) / 3;
  return {
    reveal: { x: PAD.x + LEFT + cw / 2, y: PAD.y + ay + 30 + px(28) },
    grade: { x: PAD.x + LEFT + bw / 2, y: PAD.y + ay + 50 + px(24) },
  };
}
let SPOTS = null;

/** The summary page: "Isso ficou com você." (review summary title in revisao.tsx). */
export function drawSummaryPage(g, t) {
  const words = ['Isso', 'ficou', 'com', 'você.'];
  setText(g, { weight: 800, size: 118, color: C.ink, track: -2.6 });
  const space = g.measureText(' ').width;
  [
    [0, 1],
    [2, 3],
  ].forEach((ln, li) => {
    const ws = ln.map((i) => words[i]);
    const widths = ws.map((w) => g.measureText(w).width);
    const total = widths.reduce((a, b) => a + b, 0) + space * (ws.length - 1);
    let x = (PAD.w + 20) / 2 - total / 2;
    ln.forEach((wi, k) => {
      const kk = t - T.stays[wi];
      if (kk >= 0) {
        const p = 1 - Math.exp(-kk * 14) * Math.cos(kk * 22);
        g.save();
        g.globalAlpha = clamp(kk / 0.05);
        g.translate(x + widths[k] / 2, 210 + li * 134 + (1 - p) * 46);
        g.scale(0.82 + 0.18 * p, 0.82 + 0.18 * p);
        setText(g, { weight: 800, size: 118, color: C.ink, track: -2.6, align: 'center' });
        g.fillText(ws[k], 0, 0);
        g.restore();
      }
      x += widths[k] + space;
    });
  });
}

function renderPageTexture(paper, slot, day, t) {
  const p = pages[slot];
  p.g.setTransform(1, 0, 0, 1, 0, 0);
  p.g.clearRect(0, 0, p.c.width, p.c.height);
  p.g.scale(TEX, TEX);
  pageBase(p.g);
  if (day === 'summary') drawSummaryPage(p.g, t);
  else {
    const st = pageState(day, t);
    if (st.quiet) drawQuietPage(p.g, day);
    else drawReviewPage(p.g, day, st);
  }
  paper.texture(`page${slot}`, p.c);
  return `page${slot}`;
}

/**
 * A page in flight never changes (its state is frozen when it starts to turn), so its texture is
 * cached per day in a small LRU. A cache hit is pixel-identical to a fresh render, so the cache
 * cannot make a frame depend on the frames before it.
 */
const flightCache = new Map();
let flightClock = 0;

function flightTexture(paper, f) {
  flightClock += 1;
  const hit = flightCache.get(f.day);
  if (hit) {
    hit.used = flightClock;
    return hit.id;
  }
  const taken = new Set([...flightCache.values()].map((v) => v.slot));
  let slot = 1;
  while (taken.has(slot) && slot <= FLIGHT_SLOTS) slot += 1;
  if (slot > FLIGHT_SLOTS) {
    const [day, lru] = [...flightCache.entries()].sort((a, b) => a[1].used - b[1].used)[0];
    flightCache.delete(day);
    slot = lru.slot;
  }
  const id = renderPageTexture(paper, slot, f.day, f.start);
  flightCache.set(f.day, { slot, id, used: flightClock });
  return id;
}

// ---------- the book of days ----------

export function reviewCam() {
  return cam(W / 2, H / 2, 1, 0, 3200);
}

/** The resting top page: the one under the most recent page that started to turn. */
function topDay(t) {
  let day = 1;
  for (const f of TURNS) if (t >= f.start) day = f.day === 61 ? 'summary' : f.day + 1;
  return day;
}

function drawPadBody(g) {
  g.save();
  g.fillStyle = 'rgba(59,22,128,0.16)';
  g.filter = 'blur(34px)';
  g.fillRect(PAD.x + 10, PAD.y + 70, PAD.w, PAD.h);
  g.restore();
  // Stack of pages (the Raised rim, read as paper edges).
  for (let i = 7; i >= 1; i--) {
    g.fillStyle = i % 2 ? C.line : '#F4EFFC';
    rrect(g, PAD.x - 20, PAD.y + i * 3.4, PAD.w + 20 - i * 0.3, PAD.h, px(24));
    g.fill();
  }
}

function drawSpine(g) {
  g.fillStyle = C.purpleDeep;
  rrect(g, SPINE.x, PAD.y - 10 + 8, SPINE.w, PAD.h + 30, 20);
  g.fill();
  g.fillStyle = C.purple;
  rrect(g, SPINE.x, PAD.y - 10, SPINE.w, PAD.h + 28, 20);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.2)';
  rrect(g, SPINE.x + 10, PAD.y + 10, 8, PAD.h - 20, 4);
  g.fill();
}

const RECT = { x: PAD.x, y: PAD.y, w: PAD.w, h: PAD.h };

/** The book of days at time t, without Bubo (see drawReviewOverlay). */
export function drawReview(g, t, paper, c = reviewCam(t)) {
  drawLavender(g);
  g.save();
  applyCam(g, c);
  drawPadBody(g);
  g.restore();
  paper.clear();
  const restTex = renderPageTexture(paper, 0, topDay(t), t);
  const flat = hingeSheet({
    rect: RECT,
    hinge: 'left',
    cam: c,
    nx: 2,
    ny: 2,
    angle: () => 0,
    lift: -0.5,
  });
  paper.draw(flat, { front: restTex, back: 'paperBack', diffuse: 0, spec: 0, ao: 0 });
  // Pages in flight: when the days flutter, draw a spread across the whole arc (up to 10).
  const inFlight = TURNS.filter((f) => t >= f.start && t < f.start + f.dur);
  const turning =
    inFlight.length <= FLIGHT_SLOTS
      ? inFlight
      : Array.from(
          { length: FLIGHT_SLOTS },
          (_, i) => inFlight[Math.round((i * (inFlight.length - 1)) / (FLIGHT_SLOTS - 1))],
        );
  turning.forEach((f) => {
    const k = seg(t, f.start, f.start + f.dur);
    const tex = flightTexture(paper, f);
    const mesh = hingeSheet({
      rect: RECT,
      hinge: 'left',
      cam: c,
      nx: 40,
      ny: 30,
      angle: pageTurnAngle(k),
    });
    paper.draw(mesh, { front: tex, back: 'paperBack', diffuse: 0.75, spec: 0.32, ao: 0.25 });
  });
  g.drawImage(paper.canvas, 0, 0);
  g.save();
  applyCam(g, c);
  drawSpine(g);
  g.restore();
}

// ---------- Bubo on the top edge ----------

export const PERCH = { x: PAD.x + PAD.w * 0.68, y: PAD.y + 4, size: 430 };

function gradePose(day) {
  return { 1: 'confident', 2: 'happy', 8: 'cheering', 23: 'confident', 61: 'cheering' }[day];
}

/** When the free edge of a turning page passes under Bubo's feet (fraction of the turn). */
const SKIP_AT = 0.42;

export function padBuboState(t) {
  if (t < T.padHop[1]) {
    const k = seg(t, T.padHop[0], T.padHop[1]);
    const from = RL.bubo;
    const e = ease.inOutCubic(k);
    return {
      pose: k < 0.45 ? 'idea' : 'neutral',
      x: lerp(from.x, PERCH.x, e),
      y: lerp(from.y, PERCH.y, e) - hop(k) * 50,
      size: lerp(from.size, PERCH.size, e),
      squash: -0.12 * Math.sin(Math.PI * k),
      rot: -0.25 * Math.sin(Math.PI * k),
      air: Math.sin(Math.PI * k),
    };
  }
  let pose = 'neutral';
  let squash = 0;
  const land = t - T.padHop[1];
  squash += 0.16 * Math.exp(-land * 9) * Math.cos(land * 26);
  const first = T.days[0];
  if (t >= first.arrive - 0.02 && t < first.reveal) pose = 'curious';
  if (t >= first.reveal && t < first.grade) pose = 'thinking';
  for (const [t0, amount] of [
    [first.arrive - 0.02, 0.1],
    [first.reveal, 0.08],
  ]) {
    const k = t - t0;
    if (k >= 0 && k < 0.4) squash += amount * Math.exp(-k * 9) * Math.cos(k * 30);
  }
  for (const d of T.days) {
    const k = t - d.grade;
    if (k >= 0) {
      const next = T.days.find((x) => x.day > d.day);
      if (!next || t < next.arrive) pose = gradePose(d.day);
      if (k < 0.6) squash += 0.15 * Math.exp(-k * 8) * Math.cos(k * 30);
    }
  }
  // Skipping: one hop per page, timed so the page's edge passes under the feet mid-air.
  let height = 0;
  for (const f of TURNS) {
    if (f.day === 61) continue;
    const span = Math.max(f.dur * 0.5, 0.16);
    const mid = f.start + f.dur * SKIP_AT;
    const k = (t - (mid - span / 2)) / span;
    if (k > 0 && k < 1) height = Math.max(height, hop(k) * (f.dur > 0.25 ? 170 : 120));
  }
  const air = clamp(height / 150);
  let rot = 0;
  if (height > 3) {
    pose = t > 8.3 && t < 9.32 ? 'surprised' : 'happy';
    squash -= 0.1 * air;
    rot = Math.sin(t * 11) * 0.06 * air;
  }
  return { pose, x: PERCH.x, y: PERCH.y - height, size: PERCH.size, squash, rot, air };
}

function drawPadBubo(g, t, c) {
  if (t >= T.bigJump[0]) return;
  const b = { ...padBuboState(t), pose: padBuboState(poseT(t)).pose };
  g.save();
  applyCam(g, c);
  if (t >= T.padHop[1] - 0.05)
    drawContact(g, { x: PERCH.x, y: PERCH.y, size: PERCH.size, air: b.air });
  drawBubo(g, b.pose, b);
  g.restore();
}

function drawReviewFinger(g, t, c) {
  SPOTS ??= buttonSpots();
  const day = T.days.find((d) => t >= d.reveal - 0.16 && t <= d.grade + 0.2);
  if (!day) return;
  const taps = [
    { t: day.reveal, ...SPOTS.reveal },
    { t: day.grade, ...SPOTS.grade },
  ];
  const first = day.reveal - 0.16;
  const last = day.grade + 0.2;
  let i = taps.findIndex((p) => p.t >= t - 0.05);
  if (i < 0) i = taps.length - 1;
  const cur = taps[i];
  const prev = taps[Math.max(0, i - 1)];
  const k = i === 0 ? 1 : ease.inOutCubic(seg(t, prev.t + 0.04, cur.t - 0.03));
  const x = lerp(prev.x, cur.x, k) + 30;
  const y = lerp(prev.y, cur.y, k) + 26 - hop(k) * 50;
  const press = taps.reduce((m, p) => {
    const kk = t - p.t;
    return kk > -0.04 && kk < 0.12 ? Math.max(m, kk < 0 ? 1 + kk / 0.04 : 1 - kk / 0.12) : m;
  }, 0);
  const enter = ease.outCubic(seg(t, first, first + 0.16));
  const exit = ease.inCubic(seg(t, last - 0.14, last));
  const sx = (x - c.x) * c.zoom + W / 2;
  const sy = (y - c.y) * c.zoom + H / 2 + (1 - enter) * 320 + exit * 320;
  drawTouch(
    g,
    sx,
    sy,
    press,
    1 - exit,
    taps.map((p) => t - p.t),
  );
}

/** Bubo and the finger, drawn above everything else in the pad shots. */
export function drawReviewOverlay(g, t) {
  const c = reviewCam(t);
  drawPadBubo(g, t, c);
  drawReviewFinger(g, t, c);
}

export { H };
