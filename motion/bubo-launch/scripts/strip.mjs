// Motion strips from the rendered master: consecutive frames tiled, to judge spacing, arcs and
// blur the way an animator scrubs a shot. Usage: node scripts/strip.mjs <start> <seconds> [step] [name]
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ffmpeg from 'ffmpeg-static';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [start = '0', secs = '0.5', step = '2', name = `strip-${start}`] = process.argv.slice(2);
const src = process.argv.includes('--phone')
  ? 'bubo-launch-phone-preview.mp4'
  : 'bubo-launch-9x16.mp4';
const frames = Math.ceil((Number(secs) * 60) / Number(step));
const cols = Math.min(10, frames);
const rows = Math.ceil(frames / cols);
const r = spawnSync(
  ffmpeg,
  [
    '-hide_banner',
    '-y',
    '-ss',
    start,
    '-t',
    secs,
    '-i',
    path.join(root, 'out', src),
    '-vf',
    `select='not(mod(n\\,${step}))',scale=216:-1,tile=${cols}x${rows}:padding=4:color=0x140D1F`,
    '-frames:v',
    '1',
    path.join(root, 'out', `dev-${name}.png`),
  ],
  { encoding: 'utf8' },
);
if (r.status !== 0) throw new Error(r.stderr);
console.log(`out/dev-${name}.png (${frames} frames, every ${step})`);
