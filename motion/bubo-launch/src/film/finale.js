// Shots 9–11: Bubo's big jump into "Isso ficou com você.", the pad closes into the book, the
// book lands in Bubo's wing (official `main` pose holds a closed book) and the logo signs off.
import { applyCam, cam, mixCam } from '../lib/camera.js';
import { makeCanvas, rrect, setText } from '../lib/draw.js';
import { assets } from '../lib/assets.js';
import { clamp, ease, hop, lerp, seg, spring } from '../lib/math.js';
import { drawBubo, drawContact } from '../lib/mascot.js';
import { hingeSheet } from '../lib/paper.js';
import { C, H, SERIF, W } from '../lib/tokens.js';
import { chip } from '../lib/ui.js';
import { cloth } from './book.js';
import { drawLavender } from './opening.js';
import { PAD, PERCH, SPINE, drawReview, padBuboState, reviewCam } from './review.js';
import { poseT } from './clock.js';
import { T } from './timeline.js';

// The book in the official `main` pose (1254 px file): centre, size of the cover, tilt.
const MAIN_BOOK = { cx: 468, cy: 888, w: 318, rot: -0.2 };
const SUMMARY_SPOT = { x: 560, y: 1660, size: 640 };
const END = { x: 540, y: 1800, size: 900 };

let coverTex = null;

export function initFinale(paper) {
  const s = 1.25;
  const { c, g } = makeCanvas(Math.round(PAD.w * s), Math.round(PAD.h * s));
  g.drawImage(cloth(c.width, c.height, 31), 0, 0);
  g.scale(s, s);
  const gold = '#E7B84A';
  g.strokeStyle = 'rgba(231,184,74,0.55)';
  g.lineWidth = 2.4;
  g.strokeRect(54, 70, PAD.w - 108, PAD.h - 124);
  setText(g, { weight: 600, size: 28, family: SERIF, color: gold, track: 8, align: 'center' });
  g.fillText('MACHADO DE ASSIS', PAD.w / 2, 330);
  setText(g, { weight: 700, size: 104, family: SERIF, color: gold, track: 2, align: 'center' });
  g.fillText('Dom', PAD.w / 2, 520);
  g.fillText('Casmurro', PAD.w / 2, 640);
  g.fillStyle = gold;
  g.beginPath();
  g.moveTo(PAD.w / 2, 700);
  g.lineTo(PAD.w / 2 + 14, 714);
  g.lineTo(PAD.w / 2, 728);
  g.lineTo(PAD.w / 2 - 14, 714);
  g.closePath();
  g.fill();
  coverTex = c;
  paper.texture('padCover', c);
  paper.texture('padCoverInside', cloth(256, 256, 41));
}

// ---------- Bubo from the perch to the summary, then off the page ----------

function finaleBubo(t) {
  if (t < T.bigJump[1]) {
    const k = seg(t, T.bigJump[0], T.bigJump[1]);
    const from = padBuboState(T.bigJump[0]);
    const e = ease.inOutSine(k);
    return {
      pose: k < 0.15 ? 'cheering' : 'happy',
      x: lerp(from.x, SUMMARY_SPOT.x, e),
      y: lerp(from.y, SUMMARY_SPOT.y, e) - hop(k) * 520,
      size: lerp(from.size, SUMMARY_SPOT.size, e),
      squash: k < 0.12 ? 0.18 * Math.sin((k / 0.12) * Math.PI) : -0.14 * Math.sin(Math.PI * k),
      rot: -0.22 * Math.sin(Math.PI * k),
      air: Math.sin(Math.PI * k),
    };
  }
  if (t < T.hopOff[0]) {
    const k = t - T.bigJump[1];
    const beat = Math.max(0, Math.sin(((t - 10) / 0.5) * Math.PI * 2 - 0.4));
    return {
      pose: 'celebrating',
      ...SUMMARY_SPOT,
      squash: 0.2 * Math.exp(-k * 7) * Math.cos(k * 26) + (t > 10.4 ? beat * 0.03 : 0),
      rot: 0,
      air: 0,
    };
  }
  if (t < T.hopOff[1]) {
    const k = seg(t, T.hopOff[0], T.hopOff[1]);
    const e = ease.inOutCubic(k);
    return {
      pose: 'happy',
      x: lerp(SUMMARY_SPOT.x, END.x, e),
      y: lerp(SUMMARY_SPOT.y, END.y, e) - hop(k) * 260,
      size: lerp(SUMMARY_SPOT.size, END.size * 0.9, e),
      squash: -0.1 * Math.sin(Math.PI * k),
      rot: 0,
      air: Math.sin(Math.PI * k),
    };
  }
  const k = t - T.hopOff[1];
  const caught = t >= T.catch;
  const kc = t - T.catch;
  return {
    pose: caught ? 'main' : 'happy',
    x: END.x,
    y: END.y,
    size: lerp(END.size * 0.9, END.size, ease.inOutSine(seg(t, T.catch - 0.1, T.catch + 0.4))),
    squash:
      0.14 * Math.exp(-k * 8) * Math.cos(k * 26) +
      (caught ? 0.16 * Math.exp(-kc * 7) * Math.cos(kc * 24) : 0) +
      (t >= T.logo ? 0.1 * Math.exp(-(t - T.logo) * 7) * Math.cos((t - T.logo) * 26) : 0),
    rot: caught
      ? Math.sin((t - T.catch) * Math.PI * 2 * 0.9) * 0.035 * clamp((t - T.catch) / 0.6)
      : 0,
    air: 0,
  };
}

// ---------- the cover closing and the book flying into the wing ----------

function drawClosedPad(g, { cx, cy, scale, rot, alpha = 1 }) {
  g.save();
  g.globalAlpha *= alpha;
  g.translate(cx, cy);
  g.rotate(rot);
  g.scale(scale, scale);
  g.translate(-PAD.w / 2, -PAD.h / 2);
  for (let i = 7; i >= 1; i--) {
    g.fillStyle = i % 2 ? C.line : '#F4EFFC';
    rrect(g, -20, i * 3.4, PAD.w + 20 - i * 0.3, PAD.h, 28);
    g.fill();
  }
  g.save();
  rrect(g, 0, 0, PAD.w, PAD.h, 28);
  g.clip();
  g.drawImage(coverTex, 0, 0, PAD.w, PAD.h);
  g.restore();
  const sx = SPINE.x - PAD.x;
  g.fillStyle = C.purpleDeep;
  rrect(g, sx, -2, SPINE.w, PAD.h + 30, 20);
  g.fill();
  g.fillStyle = C.purple;
  rrect(g, sx, -10, SPINE.w, PAD.h + 28, 20);
  g.fill();
  g.restore();
}

function bookTarget(bubo) {
  const s = bubo.size / 1254;
  return {
    cx: bubo.x + (MAIN_BOOK.cx - 640) * s,
    cy: bubo.y + (MAIN_BOOK.cy - 1225) * s,
    scale: (MAIN_BOOK.w * s) / PAD.w,
    rot: MAIN_BOOK.rot,
  };
}

function drawLogo(g, t) {
  const k = t - T.logo;
  if (k < 0) return;
  const logo = assets.brand.logo;
  const w = 900;
  const h = (w * logo.h) / logo.w;
  const p = spring(k, 2.4, 0.5);
  const sc = 0.6 + 0.4 * p;
  g.save();
  g.globalAlpha = clamp(k / 0.06);
  g.translate(W / 2, 560);
  g.rotate((1 - p) * -0.06);
  g.scale(sc, sc);
  g.drawImage(logo.canvas, -w / 2, -h / 2, w, h);
  g.restore();
  const kt = t - T.tagline;
  if (kt >= 0) {
    const pt = spring(kt, 2.6, 0.7);
    g.save();
    g.globalAlpha = clamp(kt / 0.1);
    g.translate(0, (1 - pt) * 30);
    setText(g, { weight: 700, size: 46, color: C.inkMuted, align: 'center', track: -0.5 });
    g.fillText('Leia profundamente.', W / 2, 820);
    setText(g, { weight: 800, size: 46, color: C.purple, align: 'center', track: -0.5 });
    g.fillText('Guarde o que importa.', W / 2, 882);
    g.restore();
  }
}

/** Frames the summary page while it holds, back to the full view for the cover and the book. */
export function finaleCam(t) {
  const base = reviewCam(t);
  const page = cam(PAD.x + PAD.w / 2 - 6, PAD.y + PAD.h / 2 - 40, 1.14, 0, 3200);
  const k = ease.inOutCubic(seg(t, 9.62, 10.05)) * (1 - ease.inOutCubic(seg(t, 11.3, 11.75)));
  return mixCam(base, page, k);
}

export function drawFinale(g, t, paper) {
  const c = finaleCam(t);
  // Until the cover has closed, the pad scene runs underneath (summary page on top).
  const coverK = seg(t, T.coverClose[0], T.coverClose[1]);
  const flyK = ease.inOutCubic(seg(t, T.bookFly[0], T.bookFly[1]));
  const b = { ...finaleBubo(t), pose: finaleBubo(poseT(t)).pose };
  if (t < T.bookFly[0]) {
    drawReview(g, t, paper, c);
    if (coverK > 0) {
      // The cover swings in from the left and closes the book of days.
      const e = ease.inCubic(coverK);
      const phi = Math.PI * (1 - e);
      const lag = 0.55 * Math.sin(Math.PI * coverK);
      const mesh = hingeSheet({
        rect: { x: PAD.x, y: PAD.y, w: PAD.w, h: PAD.h },
        hinge: 'left',
        cam: c,
        nx: 40,
        ny: 30,
        angle: (s) => Math.max(0, phi + lag * s ** 1.5),
        lift: 1,
      });
      paper.clear();
      paper.draw(mesh, {
        front: 'padCover',
        back: 'padCoverInside',
        diffuse: 0.6,
        spec: 0.25,
        ao: 0.2,
      });
      g.drawImage(paper.canvas, 0, 0);
      g.save();
      applyCam(g, c);
      g.fillStyle = C.purpleDeep;
      rrect(g, SPINE.x, PAD.y - 2, SPINE.w, PAD.h + 30, 20);
      g.fill();
      g.fillStyle = C.purple;
      rrect(g, SPINE.x, PAD.y - 10, SPINE.w, PAD.h + 28, 20);
      g.fill();
      g.restore();
    }
  } else {
    drawLavender(g);
  }
  // XP chip next to Bubo on the summary page (real: 1 card × (2 + 3) + 25 = 30 XP).
  const kx = t - T.xp;
  if (kx >= 0 && t < T.hopOff[0] + 0.12) {
    const p =
      spring(kx, 3, 0.45) * (1 - ease.inBack(seg(t, T.hopOff[0] - 0.05, T.hopOff[0] + 0.12)));
    g.save();
    applyCam(g, c);
    g.translate(790, 1070);
    g.scale(p * 1.7, p * 1.7);
    g.rotate(0.08 * (1 - p));
    chip(g, { x: 0, y: 0, label: '+30 XP', tone: 'gold', icon: 'star', align: 'center' });
    g.restore();
  }
  // The flying book passes behind Bubo and only comes in front as it reaches his wing.
  const book = () => {
    const from = { cx: PAD.x + PAD.w / 2, cy: PAD.y + PAD.h / 2, scale: 1, rot: 0 };
    const to = bookTarget({ ...b, size: END.size });
    drawClosedPad(g, {
      cx: lerp(from.cx, to.cx, flyK),
      cy: lerp(from.cy, to.cy, flyK) - hop(flyK) * 220,
      scale: Math.exp(lerp(Math.log(from.scale), Math.log(to.scale), flyK)),
      rot: lerp(from.rot, to.rot, flyK) + Math.sin(Math.PI * flyK) * -0.5,
      alpha: 1,
    });
  };
  // The book is handed over on the catch frame: from then on it is the one the official pose holds.
  const flying = t >= T.bookFly[0] && poseT(t) < T.catch;
  if (flying && flyK < 0.72) book();
  if (t >= T.bigJump[0]) {
    g.save();
    if (t < T.hopOff[1]) applyCam(g, c);
    if (b.air < 0.95) drawContact(g, { x: b.x, y: b.y, size: b.size, air: b.air });
    drawBubo(g, b.pose, b);
    g.restore();
  }
  if (flying && flyK >= 0.72) book();
  drawLogo(g, t);
}

export { END, H, PERCH };
