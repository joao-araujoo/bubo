// Full render: every frame through window.renderFrame(t) (motion blur where the film asks for
// it), piped as PNG into ffmpeg; the score is mastered to -14 LUFS (two-pass loudnorm,
// true peak -1 dBTP) and muxed. Also writes the phone preview, the poster and the contact sheet.
// Usage: npm run render [-- --from 0 --to 16.5 --samples 32 --no-audio] (samples = upper bound)
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ffmpeg from 'ffmpeg-static';

import { launch, openPage } from './lib/browser.mjs';
import { startServer } from './serve.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const FPS = 60;
const samples = Number(opt('samples', '32'));
const out = path.join(root, 'out');
fs.mkdirSync(out, { recursive: true });
const master = path.join(out, 'bubo-launch-9x16.mp4');
const silent = path.join(root, 'build', 'video-only.mp4');
const audioIn = path.join(root, 'build', 'audio', 'mix.wav');
const audioMaster = path.join(root, 'build', 'audio', 'master.wav');

function run(cmd, list, label) {
  const r = spawnSync(cmd, list, { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) {
    console.error(r.stderr);
    throw new Error(`${label} failed`);
  }
  return r.stderr;
}

// ---------- audio mastering (two-pass EBU R128) ----------
if (!args.includes('--no-audio')) {
  run(process.execPath, [path.join(root, 'scripts', 'audio.mjs')], 'audio synthesis');
  const pass1 = run(
    ffmpeg,
    [
      '-hide_banner',
      '-i',
      audioIn,
      '-af',
      'loudnorm=I=-14:TP=-1:LRA=9:print_format=json',
      '-f',
      'null',
      '-',
    ],
    'loudnorm pass 1',
  );
  const m = JSON.parse(pass1.slice(pass1.lastIndexOf('{'), pass1.lastIndexOf('}') + 1));
  const filter = `loudnorm=I=-14:TP=-1:LRA=9:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000`;
  run(
    ffmpeg,
    ['-hide_banner', '-y', '-i', audioIn, '-af', filter, '-c:a', 'pcm_s24le', audioMaster],
    'loudnorm pass 2',
  );
  console.log(`audio mastered (measured ${m.input_i} LUFS → -14 LUFS)`);
}

// ---------- frames → H.264 ----------
const { server, url } = await startServer();
const browser = await launch();
try {
  const page = await openPage(browser, `${url}/src/index.html?render`);
  await page.waitForFunction('window.ready === true', { timeout: 120000 });
  const duration = await page.evaluate(() => window.DURATION);
  const from = Number(opt('from', '0'));
  const to = Number(opt('to', String(duration)));
  const first = Math.round(from * FPS);
  const last = Math.round(to * FPS);
  const enc = spawn(
    ffmpeg,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-f',
      'image2pipe',
      '-framerate',
      String(FPS),
      '-c:v',
      'png',
      '-i',
      '-',
      '-vf',
      'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '16',
      '-tune',
      'animation',
      '-profile:v',
      'high',
      '-level',
      '4.2',
      '-colorspace',
      'bt709',
      '-color_primaries',
      'bt709',
      '-color_trc',
      'bt709',
      '-color_range',
      'tv',
      '-r',
      String(FPS),
      silent,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  );
  const done = new Promise((resolve, reject) =>
    enc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`)))),
  );
  const t0 = Date.now();
  for (let f = first; f < last; f++) {
    await page.evaluate((t, s) => window.renderFrame(t, s), f / FPS, samples);
    const png = await page.screenshot({ type: 'png', optimizeForSpeed: true });
    if (!enc.stdin.write(png)) await new Promise((r) => enc.stdin.once('drain', r));
    if ((f - first) % 60 === 0) {
      const el = (Date.now() - t0) / 1000;
      process.stdout.write(`\rframe ${f - first}/${last - first}  ${el.toFixed(0)} s`);
    }
  }
  enc.stdin.end();
  await done;
  console.log(`\nvideo encoded in ${((Date.now() - t0) / 1000).toFixed(0)} s`);

  // Poster: the end card, rendered sharp with seek (no motion blur).
  await page.evaluate((t) => window.seek(t), Number(opt('poster', '15.2')));
  await page.screenshot({ path: path.join(out, 'bubo-launch-poster.png'), type: 'png' });
  console.log('poster: out/bubo-launch-poster.png');
  // Contact sheet: every half second, with timestamps.
  const sheet = await page.evaluate((duration) => {
    const film = document.getElementById('film');
    const times = [];
    for (let t = 0; t <= duration + 1e-6; t += 0.5) times.push(t);
    const cols = 9;
    const thumb = 220;
    const th = Math.round((thumb * 1920) / 1080);
    const pad = 10;
    const label = 30;
    const c = document.createElement('canvas');
    c.width = cols * (thumb + pad) + pad;
    c.height = Math.ceil(times.length / cols) * (th + pad + label) + pad;
    const s = c.getContext('2d');
    s.fillStyle = '#140D1F';
    s.fillRect(0, 0, c.width, c.height);
    s.imageSmoothingQuality = 'high';
    times.forEach((t, i) => {
      window.renderFrame(t);
      const x = pad + (i % cols) * (thumb + pad);
      const y = pad + Math.floor(i / cols) * (th + pad + label);
      s.drawImage(film, x, y, thumb, th);
      s.fillStyle = '#C4B5FD';
      s.font = '700 20px Jakarta';
      s.fillText(`${t.toFixed(1)} s`, x + 4, y + th + 22);
    });
    return c.toDataURL('image/png');
  }, duration);
  fs.writeFileSync(
    path.join(out, 'bubo-launch-contact-sheet.png'),
    Buffer.from(sheet.split(',')[1], 'base64'),
  );
  console.log('contact sheet: out/bubo-launch-contact-sheet.png');
} finally {
  await browser.close();
  server.close();
}

// ---------- mux, phone preview, poster ----------
const hasAudio = fs.existsSync(audioMaster);
run(
  ffmpeg,
  [
    '-hide_banner',
    '-y',
    '-i',
    silent,
    ...(hasAudio ? ['-i', audioMaster] : []),
    '-map',
    '0:v',
    ...(hasAudio
      ? ['-map', '1:a', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest']
      : []),
    '-c:v',
    'copy',
    '-movflags',
    '+faststart',
    master,
  ],
  'mux',
);
console.log(`master: ${path.relative(root, master)}`);
// Phone-feed preview: 432 × 768 at 30 fps (about the width a 9:16 post gets on a phone).
run(
  ffmpeg,
  [
    '-hide_banner',
    '-y',
    '-i',
    master,
    '-vf',
    'scale=432:768:flags=lanczos,fps=30',
    '-c:v',
    'libx264',
    '-crf',
    '20',
    '-preset',
    'slow',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    path.join(out, 'bubo-launch-phone-preview.mp4'),
  ],
  'phone preview',
);
console.log('phone preview: out/bubo-launch-phone-preview.mp4');
