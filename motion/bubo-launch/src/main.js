// Page bootstrap and the render contract.
//   window.seek(t)          draws the exact state at t seconds (pure; no dependency on history)
//   window.renderFrame(t)   same, with temporal motion blur where the film asks for it
//   window.ready            true once fonts, images and textures are loaded
import { loadAssets } from './lib/assets.js';
import { FPS, H, W } from './lib/tokens.js';
import { setFrameTime } from './film/clock.js';
import { DURATION, initFilm, renderFilm, shutterAt } from './film/film.js';

const canvas = document.getElementById('film');
canvas.width = W;
canvas.height = H;
const g = canvas.getContext('2d', { willReadFrequently: false });
g.imageSmoothingEnabled = true;
g.imageSmoothingQuality = 'high';

const acc = new Uint16Array(W * H * 4);
let out = null;

function seek(t) {
  setFrameTime(t);
  renderFilm(g, t);
  return t;
}

/**
 * Motion-blurred frame: N sub-frames spread over the shutter, averaged in integer space. The film
 * decides shutter and N per moment (shutterAt), so fast moves are smooth and reading stays sharp.
 */
function renderFrame(t, maxSamples = 32) {
  const plan = shutterAt(t);
  const shutter = plan.shutter;
  const samples = Math.min(plan.samples, maxSamples);
  if (shutter <= 0 || samples <= 1) return seek(t);
  setFrameTime(t);
  acc.fill(0);
  for (let i = 0; i < samples; i++) {
    const ts = t + ((i + 0.5) / samples - 0.5) * (shutter / FPS);
    renderFilm(g, ts);
    const d = g.getImageData(0, 0, W, H).data;
    for (let k = 0; k < d.length; k++) acc[k] += d[k];
  }
  if (!out) out = g.createImageData(W, H);
  const o = out.data;
  const half = samples >> 1;
  for (let k = 0; k < o.length; k++) o[k] = ((acc[k] + half) / samples) | 0;
  g.putImageData(out, 0, 0);
  return t;
}

window.seek = seek;
window.renderFrame = renderFrame;
window.DURATION = DURATION;

await loadAssets();
initFilm();
const params = new URLSearchParams(location.search);
const start = Number(params.get('t') ?? 0);
seek(start);
window.ready = true;

// Preview controls (never used by the renderer): scrub with the slider, space to play.
if (!params.has('render')) {
  const ui = document.getElementById('ui');
  ui.hidden = false;
  const range = document.getElementById('range');
  const label = document.getElementById('time');
  range.max = String(DURATION);
  range.value = String(start);
  let playing = false;
  let t0 = 0;
  let from = start;
  const show = (t) => {
    label.textContent = `${t.toFixed(3)} s`;
    range.value = String(t);
    seek(t);
  };
  range.addEventListener('input', () => show(Number(range.value)));
  const tick = (now) => {
    if (!playing) return;
    const t = from + (now - t0) / 1000;
    show(t % DURATION);
    requestAnimationFrame(tick);
  };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      playing = !playing;
      t0 = performance.now();
      from = Number(range.value);
      if (playing) requestAnimationFrame(tick);
    }
    if (e.code === 'ArrowRight') show(Number(range.value) + 1 / FPS);
    if (e.code === 'ArrowLeft') show(Math.max(0, Number(range.value) - 1 / FPS));
  });
}
