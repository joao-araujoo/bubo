// Renders individual frames with window.seek(t) and builds contact sheets for review.
// Usage:
//   node scripts/frames.mjs --times 0,0.5,1.25          → out/frames/t_0.000.png …
//   node scripts/frames.mjs --sheet [--every 0.5] [--from 0 --to 17] [--cols 6] [--name sheet]
//   add --blur to use the motion-blurred renderFrame instead of seek
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { launch, openPage } from './lib/browser.mjs';
import { startServer } from './serve.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const { server, url } = await startServer();
const browser = await launch();
try {
  const page = await openPage(browser, `${url}/src/index.html?render`);
  await page.waitForFunction('window.ready === true', { timeout: 120000 });
  const duration = await page.evaluate(() => window.DURATION);
  const blur = flag('blur');
  const outDir = path.join(root, 'out', 'frames');
  fs.mkdirSync(outDir, { recursive: true });

  if (flag('sheet')) {
    const every = Number(opt('every', '0.5'));
    const from = Number(opt('from', '0'));
    const to = Number(opt('to', String(duration)));
    const cols = Number(opt('cols', '6'));
    const thumb = Number(opt('thumb', '300'));
    const name = opt('name', 'contact-sheet');
    const times = [];
    for (let t = from; t <= to + 1e-6; t += every) times.push(Number(t.toFixed(4)));
    const data = await page.evaluate(
      async ({ times, cols, thumb, blur }) => {
        const film = document.getElementById('film');
        const th = Math.round((thumb * 1920) / 1080);
        const pad = 10;
        const label = 30;
        const rows = Math.ceil(times.length / cols);
        const sheet = document.createElement('canvas');
        sheet.width = cols * (thumb + pad) + pad;
        sheet.height = rows * (th + pad + label) + pad;
        const s = sheet.getContext('2d');
        s.fillStyle = '#140D1F';
        s.fillRect(0, 0, sheet.width, sheet.height);
        s.imageSmoothingQuality = 'high';
        times.forEach((t, i) => {
          if (blur) window.renderFrame(t);
          else window.seek(t);
          const x = pad + (i % cols) * (thumb + pad);
          const y = pad + Math.floor(i / cols) * (th + pad + label);
          s.drawImage(film, x, y, thumb, th);
          s.fillStyle = '#C4B5FD';
          s.font = '700 20px Jakarta';
          s.fillText(`${t.toFixed(2)} s`, x + 4, y + th + 22);
        });
        return sheet.toDataURL('image/png');
      },
      { times, cols, thumb, blur },
    );
    const file = path.join(root, 'out', `${name}.png`);
    fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
    console.log(`sheet: ${path.relative(root, file)} (${times.length} frames)`);
  } else {
    const times = opt('times', '0').split(',').map(Number);
    for (const t of times) {
      await page.evaluate((t, blur) => (blur ? window.renderFrame(t) : window.seek(t)), t, blur);
      const file = path.join(outDir, `t_${t.toFixed(3)}.png`);
      await page.screenshot({ path: file, type: 'png' });
      console.log(`frame: ${path.relative(root, file)}`);
    }
  }
} finally {
  await browser.close();
  server.close();
}
