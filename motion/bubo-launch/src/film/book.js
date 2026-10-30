// The book prop: Dom Casmurro (Machado de Assis, 1899 — public domain), chapter XXXII,
// "Olhos de ressaca". Pages are typeset once into high-resolution canvases (justified Literata
// on warm paper), the cover is the plum of the book the official `main` pose holds.
import { makeCanvas, setText } from '../lib/draw.js';
import { rng } from '../lib/math.js';
import { C, SERIF } from '../lib/tokens.js';

export const RES = 3; // texture pixels per world pixel
export const PAGE = { w: 460, h: 690 };
export const BOOK = {
  cx: 540,
  cy: 960,
  margin: 14, // cover board beyond the pages
};
// World rectangles (pulled-back framing: the open book centred in the frame).
export const RIGHT_PAGE = { x: BOOK.cx, y: BOOK.cy - PAGE.h / 2, w: PAGE.w, h: PAGE.h };
export const LEFT_PAGE = { x: BOOK.cx - PAGE.w, y: BOOK.cy - PAGE.h / 2, w: PAGE.w, h: PAGE.h };
export const RIGHT_BOARD = {
  x: BOOK.cx,
  y: RIGHT_PAGE.y - BOOK.margin,
  w: PAGE.w + BOOK.margin,
  h: PAGE.h + BOOK.margin * 2,
};
export const LEFT_BOARD = {
  x: BOOK.cx - PAGE.w - BOOK.margin,
  y: RIGHT_PAGE.y - BOOK.margin,
  w: PAGE.w + BOOK.margin,
  h: PAGE.h + BOOK.margin * 2,
};

const LEFT_TEXT = [
  'Tudo era matéria às curiosidades de Capitu. Caso houve, porém, no qual não sei se aprendeu ou ensinou, ou se fez ambas as cousas, como eu. É o que contarei no outro capítulo. Neste direi somente que, passados alguns dias do ajuste com o agregado, fui ver a minha amiga; eram dez horas da manhã.',
];
const RIGHT_TEXT = [
  'Tinha-me lembrado a definição que José Dias dera deles, «olhos de cigana oblíqua e dissimulada.» Eu não sabia o que era oblíqua, mas dissimulada sabia, e queria ver se se podiam chamar assim. Capitu deixou-se fitar e examinar.',
  'Retórica dos namorados, dá-me uma comparação exata e poética para dizer o que foram aqueles olhos de Capitu. Não me acode imagem capaz de dizer, sem quebra da dignidade do estilo, o que eles foram e me fizeram. Olhos de ressaca? Vá, de ressaca. É o que me dá ideia daquela feição nova. Traziam não sei que fluido misterioso e enérgico, uma força que arrastava para dentro, como a vaga que se retira da praia, nos dias de ressaca.',
];
export const PHRASE = 'Olhos de ressaca';

const BODY = { size: 19, line: 30.5, indent: 22 };

/** Justified typesetting (layout only). Returns word boxes in page-local world px. */
function layout(g, paragraphs, { x, y, w }) {
  setText(g, { weight: 400, size: BODY.size, family: SERIF, color: '#2A2118' });
  const space = g.measureText(' ').width;
  const boxes = [];
  let cy = y;
  for (const para of paragraphs) {
    const words = para.split(' ');
    let line = [];
    let lineW = 0;
    let first = true;
    const flush = (last) => {
      const avail = w - (first ? BODY.indent : 0);
      const sum = line.reduce((acc, item) => acc + item.w, 0);
      const gap = !last && line.length > 1 ? (avail - sum) / (line.length - 1) : space;
      let cx = x + (first ? BODY.indent : 0);
      for (const item of line) {
        boxes.push({ word: item.word, x: cx, y: cy, w: item.w });
        cx += item.w + gap;
      }
      cy += BODY.line;
      first = false;
      line = [];
      lineW = 0;
    };
    for (const word of words) {
      const ww = g.measureText(word).width;
      const avail = w - (first ? BODY.indent : 0);
      if (line.length && lineW + space + ww > avail) flush(false);
      lineW += (line.length ? space : 0) + ww;
      line.push({ word, w: ww });
    }
    flush(true);
  }
  return boxes;
}

function typeset(g, paragraphs, box, skip = () => false) {
  const boxes = layout(g, paragraphs, box);
  for (const b of boxes) if (!skip(b)) g.fillText(b.word, b.x, b.y);
  return boxes;
}

function paperBase(g, w, h, seed, gutter) {
  g.fillStyle = C.paper;
  g.fillRect(0, 0, w, h);
  // Fibre grain: thousands of faint specks and hairs, seeded.
  const r = rng(seed);
  for (let i = 0; i < (w * h) / 900; i++) {
    const x = r() * w;
    const y = r() * h;
    const a = 0.025 + r() * 0.04;
    g.fillStyle = r() < 0.5 ? `rgba(120,96,64,${a})` : `rgba(255,255,255,${a * 1.4})`;
    if (r() < 0.12) {
      g.save();
      g.translate(x, y);
      g.rotate(r() * Math.PI);
      g.fillRect(0, 0, 6 + r() * 16, 0.9);
      g.restore();
    } else g.fillRect(x, y, 1.2, 1.2);
  }
  // Gutter: the page dips into the spine, darker and warmer there.
  const gx = gutter === 'left' ? 0 : w;
  const gg = g.createLinearGradient(gx, 0, gutter === 'left' ? w * 0.22 : w * 0.78, 0);
  gg.addColorStop(0, 'rgba(92,64,36,0.30)');
  gg.addColorStop(0.35, 'rgba(92,64,36,0.08)');
  gg.addColorStop(1, 'rgba(92,64,36,0)');
  g.fillStyle = gg;
  g.fillRect(0, 0, w, h);
  // Soft light falloff toward the outer edge.
  const og = g.createLinearGradient(
    gutter === 'left' ? w : 0,
    0,
    gutter === 'left' ? w * 0.7 : w * 0.3,
    0,
  );
  og.addColorStop(0, 'rgba(120,90,60,0.10)');
  og.addColorStop(1, 'rgba(120,90,60,0)');
  g.fillStyle = og;
  g.fillRect(0, 0, w, h);
}

function runningHead(g, label, num, side) {
  setText(g, {
    weight: 600,
    size: 10.5,
    family: SERIF,
    color: '#6B5A48',
    track: 2.4,
    align: 'center',
  });
  g.fillText(label, PAGE.w / 2, 46);
  setText(g, {
    weight: 400,
    size: 12,
    family: SERIF,
    color: '#6B5A48',
    align: side === 'left' ? 'left' : 'right',
  });
  g.fillText(num, side === 'left' ? 44 : PAGE.w - 44, 46);
}

/** Right page, with or without the ink of the phrase (when the words have flown off). */
export function buildRightPage({ withPhrase }) {
  const { c, g } = makeCanvas(PAGE.w * RES, PAGE.h * RES);
  g.scale(RES, RES);
  paperBase(g, PAGE.w, PAGE.h, 11, 'left');
  runningHead(g, 'OLHOS DE RESSACA', '65', 'right');
  const box = { x: 46, y: 96, w: PAGE.w - 46 - 40 };
  const boxes = layout(g, RIGHT_TEXT, box);
  const i = boxes.findIndex(
    (bx, k) =>
      bx.word === 'Olhos' && boxes[k + 1]?.word === 'de' && boxes[k + 2]?.word === 'ressaca?',
  );
  if (i < 0) throw new Error('phrase broken across lines');
  const phraseBoxes = boxes.slice(i, i + 3);
  if (phraseBoxes[0].y !== phraseBoxes[2].y) throw new Error('phrase broken across lines');
  typeset(
    g,
    RIGHT_TEXT,
    box,
    (bx) => !withPhrase && phraseBoxes.some((p) => p.x === bx.x && p.y === bx.y),
  );
  if (!withPhrase) {
    // The question mark stays on the page: only the three words fly away.
    setText(g, { weight: 400, size: BODY.size, family: SERIF, color: '#2A2118' });
    const q = phraseBoxes[2];
    g.fillText('?', q.x + q.w - g.measureText('?').width, q.y);
  }
  setText(g, { weight: 400, size: BODY.size, family: SERIF });
  const qWidth = g.measureText('?').width;
  const first = phraseBoxes[0];
  const last = phraseBoxes[2];
  return {
    canvas: c,
    lines: boxes,
    phrase: {
      x: first.x,
      y: first.y,
      w: last.x + last.w - qWidth - first.x,
      words: phraseBoxes.map((bx, k) => ({
        ...bx,
        word: k === 2 ? 'ressaca' : bx.word,
        w: k === 2 ? bx.w - qWidth : bx.w,
      })),
      size: BODY.size,
    },
  };
}

/** Left page front (chapter opening) on a sheet that includes the cover margin. */
export function buildLeftSheetFront() {
  const m = BOOK.margin;
  const { c, g } = makeCanvas(LEFT_BOARD.w * 2, LEFT_BOARD.h * 2);
  g.scale(2, 2);
  g.fillStyle = C.bookCloth;
  g.fillRect(0, 0, LEFT_BOARD.w, LEFT_BOARD.h);
  g.save();
  g.translate(0 + 2, m);
  // The page block edge (stacked paper) peeking on the outer side.
  g.fillStyle = C.paperEdge;
  g.fillRect(-2, 2, 8, PAGE.h - 4);
  g.translate(m - 2, 0);
  paperBase(g, PAGE.w, PAGE.h, 7, 'right');
  runningHead(g, 'DOM CASMURRO', '64', 'left');
  setText(g, { weight: 400, size: 15, family: SERIF, color: '#6B5A48', track: 3, align: 'center' });
  g.fillText('XXXII', PAGE.w / 2, 196);
  setText(g, {
    weight: 400,
    size: 28,
    family: SERIF,
    style: 'italic',
    color: '#2A2118',
    align: 'center',
  });
  g.fillText('Olhos de ressaca', PAGE.w / 2, 244);
  g.fillStyle = '#B9A88F';
  g.fillRect(PAGE.w / 2 - 18, 268, 36, 1.4);
  typeset(g, LEFT_TEXT, { x: 40, y: 330, w: PAGE.w - 40 - 46 });
  g.restore();
  return c;
}

/** Plum cloth with a fine weave. `w`, `h` in px; `scale` = px per world px. */
export function cloth(w, h, seed = 5, base = C.bookCloth) {
  const { c, g } = makeCanvas(w, h);
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  const r = rng(seed);
  for (let y = 0; y < h; y += 3) {
    g.fillStyle = `rgba(255,255,255,${0.012 + r() * 0.02})`;
    g.fillRect(0, y, w, 1);
  }
  for (let x = 0; x < w; x += 3) {
    g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.04})`;
    g.fillRect(x, 0, 1, h);
  }
  for (let i = 0; i < (w * h) / 1400; i++) {
    g.fillStyle = `rgba(255,255,255,${r() * 0.035})`;
    g.fillRect(r() * w, r() * h, 2, 1);
  }
  return c;
}

/** Front cover (outside), seen when the book is closed. */
export function buildCover(scale = 2) {
  const w = LEFT_BOARD.w;
  const h = LEFT_BOARD.h;
  const { c, g } = makeCanvas(w * scale, h * scale);
  g.drawImage(cloth(w * scale, h * scale, 9), 0, 0);
  g.scale(scale, scale);
  // Gold foil title, as on the spine-side of a cloth hardcover.
  const gold = '#E7B84A';
  g.strokeStyle = 'rgba(231,184,74,0.55)';
  g.lineWidth = 1.2;
  g.strokeRect(30, 30, w - 60, h - 60);
  setText(g, { weight: 600, size: 13, family: SERIF, color: gold, track: 4, align: 'center' });
  g.fillText('MACHADO DE ASSIS', w / 2, 452);
  setText(g, { weight: 700, size: 46, family: SERIF, color: gold, track: 1, align: 'center' });
  g.fillText('Dom', w / 2, 528);
  g.fillText('Casmurro', w / 2, 582);
  g.fillStyle = gold;
  g.beginPath();
  g.moveTo(w / 2, 614);
  g.lineTo(w / 2 + 7, 621);
  g.lineTo(w / 2, 628);
  g.lineTo(w / 2 - 7, 621);
  g.closePath();
  g.fill();
  // Board edge highlight and inner shadow.
  const e = g.createLinearGradient(0, 0, w, 0);
  e.addColorStop(0, 'rgba(0,0,0,0.25)');
  e.addColorStop(0.04, 'rgba(255,255,255,0.05)');
  e.addColorStop(0.96, 'rgba(0,0,0,0)');
  e.addColorStop(1, 'rgba(0,0,0,0.3)');
  g.fillStyle = e;
  g.fillRect(0, 0, w, h);
  return c;
}
