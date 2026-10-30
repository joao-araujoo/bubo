// Minimal, dependency-free PNG utilities (8-bit RGB/RGBA, non-interlaced).
// Used only to derive app-ready copies of the OFFICIAL Bubo assets: scaling, trimming transparent
// padding and placing on a canvas. Pixels are never redrawn or recoloured.
import fs from 'node:fs';
import zlib from 'node:zlib';

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export { crc32 };

/** @returns {{ width: number, height: number, data: Buffer }} RGBA, 4 bytes per pixel */
export function readPng(file) {
  const buf = fs.readFileSync(file);
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error(`Not a PNG: ${file}`);
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  let bitDepth = 0;
  let interlace = 0;
  const idat = [];
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const chunk = buf.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      bitDepth = chunk[8];
      colorType = chunk[9];
      interlace = chunk[12];
    } else if (type === 'IDAT') idat.push(chunk);
    else if (type === 'IEND') break;
    offset += 12 + length;
  }
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2) || interlace !== 0) {
    throw new Error(`Unsupported PNG format in ${file} (depth ${bitDepth}, type ${colorType})`);
  }
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const data = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let x = 0; x < stride; x++) {
      const left = x >= bpp ? line[x - bpp] : 0;
      const up = prev[x];
      const upLeft = x >= bpp ? prev[x - bpp] : 0;
      let value = line[x];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      line[x] = value & 255;
    }
    for (let x = 0; x < width; x++) {
      const s = x * bpp;
      const d = (y * width + x) * 4;
      data[d] = line[s];
      data[d + 1] = line[s + 1];
      data[d + 2] = line[s + 2];
      data[d + 3] = bpp === 4 ? line[s + 3] : 255;
    }
    prev = line;
  }
  return { width, height, data };
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Filter one scanline with all five PNG filters and keep the smallest (min-sum heuristic). */
function filterRow(row, prev) {
  const bpp = 4;
  let best = null;
  let bestScore = Infinity;
  for (let type = 0; type <= 4; type++) {
    const out = Buffer.alloc(row.length + 1);
    out[0] = type;
    let score = 0;
    for (let x = 0; x < row.length; x++) {
      const left = x >= bpp ? row[x - bpp] : 0;
      const up = prev ? prev[x] : 0;
      const upLeft = prev && x >= bpp ? prev[x - bpp] : 0;
      const predictor =
        type === 0
          ? 0
          : type === 1
            ? left
            : type === 2
              ? up
              : type === 3
                ? (left + up) >> 1
                : paeth(left, up, upLeft);
      const value = (row[x] - predictor) & 255;
      out[x + 1] = value;
      score += value < 128 ? value : 256 - value;
    }
    if (score < bestScore) {
      bestScore = score;
      best = out;
    }
  }
  return best;
}

export function writePng(file, { width, height, data }) {
  const rowLength = width * 4 + 1;
  const raw = Buffer.alloc(rowLength * height);
  let prev = null;
  for (let y = 0; y < height; y++) {
    const row = data.subarray(y * width * 4, (y + 1) * width * 4);
    filterRow(row, prev).copy(raw, y * rowLength);
    prev = row;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  fs.writeFileSync(
    file,
    Buffer.concat([
      SIGNATURE,
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}

/** Bounding box of pixels with alpha above threshold. */
export function opaqueBounds(image, threshold = 8) {
  const { width, height, data } = image;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > threshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, width, height };
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export function crop(image, rect) {
  const out = Buffer.alloc(rect.width * rect.height * 4);
  for (let y = 0; y < rect.height; y++) {
    const start = ((rect.y + y) * image.width + rect.x) * 4;
    image.data.copy(out, y * rect.width * 4, start, start + rect.width * 4);
  }
  return { width: rect.width, height: rect.height, data: out };
}

/**
 * Area-average (box) downscale with premultiplied alpha — preserves edges of transparent art
 * without dark fringes. Only used for downscaling.
 */
export function resize(image, targetWidth, targetHeight) {
  const { width, height, data } = image;
  const out = Buffer.alloc(targetWidth * targetHeight * 4);
  const sx = width / targetWidth;
  const sy = height / targetHeight;
  for (let ty = 0; ty < targetHeight; ty++) {
    const y0 = ty * sy;
    const y1 = y0 + sy;
    for (let tx = 0; tx < targetWidth; tx++) {
      const x0 = tx * sx;
      const x1 = x0 + sx;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let total = 0;
      for (let y = Math.floor(y0); y < Math.min(Math.ceil(y1), height); y++) {
        const wy = Math.min(y + 1, y1) - Math.max(y, y0);
        for (let x = Math.floor(x0); x < Math.min(Math.ceil(x1), width); x++) {
          const wx = Math.min(x + 1, x1) - Math.max(x, x0);
          const w = wx * wy;
          const i = (y * width + x) * 4;
          const alpha = data[i + 3] / 255;
          r += data[i] * alpha * w;
          g += data[i + 1] * alpha * w;
          b += data[i + 2] * alpha * w;
          a += alpha * w;
          total += w;
        }
      }
      const o = (ty * targetWidth + tx) * 4;
      if (a > 0) {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
      }
      out[o + 3] = Math.round((a / total) * 255);
    }
  }
  return { width: targetWidth, height: targetHeight, data: out };
}

/** Scale so the longest side equals `maxSide` (never upscales). */
export function fit(image, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  if (scale === 1) return image;
  return resize(
    image,
    Math.max(1, Math.round(image.width * scale)),
    Math.max(1, Math.round(image.height * scale)),
  );
}

/** Create a canvas filled with an RGBA colour. */
export function canvas(width, height, [r, g, b, a]) {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  }
  return { width, height, data };
}

/** Alpha-composite `top` onto `base` at (dx, dy) — "source over". Mutates base. */
export function composite(base, top, dx, dy) {
  for (let y = 0; y < top.height; y++) {
    const by = dy + y;
    if (by < 0 || by >= base.height) continue;
    for (let x = 0; x < top.width; x++) {
      const bx = dx + x;
      if (bx < 0 || bx >= base.width) continue;
      const t = (y * top.width + x) * 4;
      const b = (by * base.width + bx) * 4;
      const ta = top.data[t + 3] / 255;
      if (ta === 0) continue;
      const ba = base.data[b + 3] / 255;
      const oa = ta + ba * (1 - ta);
      for (let k = 0; k < 3; k++) {
        base.data[b + k] = Math.round(
          (top.data[t + k] * ta + base.data[b + k] * ba * (1 - ta)) / (oa || 1),
        );
      }
      base.data[b + 3] = Math.round(oa * 255);
    }
  }
  return base;
}

/* ------------------------------------------------------------------------------------------ */
/* Indexed (palette) PNGs for e-mail delivery (ADR-041): ≤ 256 colours, deterministic.          */
/* ------------------------------------------------------------------------------------------ */

const key5 = (r, g, b, a) => ((r >> 3) << 15) | ((g >> 3) << 10) | ((b >> 3) << 5) | (a >> 3);

function colourDistance(r, g, b, a, p) {
  const dr = r - p[0];
  const dg = g - p[1];
  const db = b - p[2];
  const da = a - p[3];
  return 2 * dr * dr + 4 * dg * dg + 3 * db * db + 6 * da * da;
}

/**
 * Median-cut + a few k-means passes over a 5-bit RGBA histogram. Fully transparent pixels share
 * index 0. Returns `{ palette: number[][], indices: Uint8Array }`; identical input → identical
 * output (no randomness, stable ordering).
 */
export function quantize(image, colors = 256) {
  const { width, height, data } = image;
  const bins = new Map();
  let transparent = false;
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const a = data[o + 3];
    if (a === 0) {
      transparent = true;
      continue;
    }
    const k = key5(data[o], data[o + 1], data[o + 2], a);
    let bin = bins.get(k);
    if (!bin) {
      bin = { k, n: 0, r: 0, g: 0, b: 0, a: 0 };
      bins.set(k, bin);
    }
    bin.n += 1;
    bin.r += data[o];
    bin.g += data[o + 1];
    bin.b += data[o + 2];
    bin.a += a;
  }
  const entries = [...bins.values()]
    .sort((x, y) => x.k - y.k)
    .map((bin) => ({ ...bin, mean: [bin.r / bin.n, bin.g / bin.n, bin.b / bin.n, bin.a / bin.n] }));
  const budget = colors - (transparent ? 1 : 0);
  const channelWeight = [2, 4, 3, 6];
  const describe = (items) => {
    const min = [255, 255, 255, 255];
    const max = [0, 0, 0, 0];
    let n = 0;
    for (const item of items) {
      n += item.n;
      for (let c = 0; c < 4; c++) {
        if (item.mean[c] < min[c]) min[c] = item.mean[c];
        if (item.mean[c] > max[c]) max[c] = item.mean[c];
      }
    }
    let channel = 0;
    let spread = -1;
    for (let c = 0; c < 4; c++) {
      const value = (max[c] - min[c]) * channelWeight[c];
      if (value > spread) {
        spread = value;
        channel = c;
      }
    }
    return { items, n, channel, score: items.length > 1 ? spread * Math.sqrt(n) : -1 };
  };
  const boxes = [describe(entries)];
  while (boxes.length < budget) {
    let pick = 0;
    for (let i = 1; i < boxes.length; i++) if (boxes[i].score > boxes[pick].score) pick = i;
    const box = boxes[pick];
    if (box.score <= 0) break;
    const c = box.channel;
    const sorted = [...box.items].sort((x, y) => x.mean[c] - y.mean[c] || x.k - y.k);
    let acc = 0;
    let cut = 1;
    for (let i = 0; i < sorted.length - 1; i++) {
      acc += sorted[i].n;
      cut = i + 1;
      if (acc >= box.n / 2) break;
    }
    boxes.splice(pick, 1, describe(sorted.slice(0, cut)), describe(sorted.slice(cut)));
  }
  let palette = boxes.map((box) => {
    const sum = [0, 0, 0, 0];
    for (const item of box.items) {
      sum[0] += item.r;
      sum[1] += item.g;
      sum[2] += item.b;
      sum[3] += item.a;
    }
    return sum.map((value) => value / box.n);
  });
  const nearest = (r, g, b, a, list) => {
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < list.length; i++) {
      const d = colourDistance(r, g, b, a, list[i]);
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    }
    return best;
  };
  for (let pass = 0; pass < 4; pass++) {
    const sums = palette.map(() => [0, 0, 0, 0, 0]);
    for (const item of entries) {
      const s = sums[nearest(item.mean[0], item.mean[1], item.mean[2], item.mean[3], palette)];
      s[0] += item.r;
      s[1] += item.g;
      s[2] += item.b;
      s[3] += item.a;
      s[4] += item.n;
    }
    palette = palette.map((colour, i) =>
      sums[i][4] ? sums[i].slice(0, 4).map((value) => value / sums[i][4]) : colour,
    );
  }
  const rounded = palette.map((colour) => colour.map((value) => Math.round(value)));
  const finalPalette = transparent ? [[0, 0, 0, 0], ...rounded] : rounded;
  const offset = transparent ? 1 : 0;
  const cache = new Map();
  const indices = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    const a = data[o + 3];
    if (a === 0) continue;
    const k = (data[o] << 24) | (data[o + 1] << 16) | (data[o + 2] << 8) | a;
    let index = cache.get(k);
    if (index === undefined) {
      index = offset + nearest(data[o], data[o + 1], data[o + 2], a, rounded);
      cache.set(k, index);
    }
    indices[i] = index;
  }
  return { palette: finalPalette, indices };
}

/** Raw (unfiltered, uncompressed) scanlines of an indexed image: filter byte 0 + indices. */
export function indexedScanlines({ width, height, indices }) {
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0;
    Buffer.from(indices.buffer, indices.byteOffset + y * width, width).copy(
      raw,
      y * (width + 1) + 1,
    );
  }
  return raw;
}

/** Encodes an 8-bit indexed PNG (PLTE + tRNS when any entry is not opaque). */
export function encodeIndexedPng({ width, height, palette, indices }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 3;
  const plte = Buffer.from(palette.flatMap(([r, g, b]) => [r, g, b]));
  const alphas = palette.map((colour) => colour[3]);
  let last = alphas.length - 1;
  while (last >= 0 && alphas[last] === 255) last -= 1;
  const chunks = [chunk('IHDR', ihdr), chunk('PLTE', plte)];
  if (last >= 0) chunks.push(chunk('tRNS', Buffer.from(alphas.slice(0, last + 1))));
  const raw = indexedScanlines({ width, height, indices });
  chunks.push(chunk('IDAT', zlib.deflateSync(raw, { level: 9, memLevel: 9 })));
  chunks.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat([SIGNATURE, ...chunks]);
}

/**
 * Reads back what `encodeIndexedPng` wrote: size, palette (RGBA) and the inflated scanlines.
 * Comparing these (not the deflate bytes, which differ between zlib builds) verifies an image.
 */
export function decodeIndexedPng(buffer) {
  if (!buffer.subarray(0, 8).equals(SIGNATURE)) throw new Error('Not a PNG.');
  let offset = 8;
  let width = 0;
  let height = 0;
  let rgb = Buffer.alloc(0);
  let alpha = Buffer.alloc(0);
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const body = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[9] !== 3) throw new Error('Not an 8-bit indexed PNG.');
    } else if (type === 'PLTE') rgb = body;
    else if (type === 'tRNS') alpha = body;
    else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    offset += 12 + length;
  }
  const palette = [];
  for (let i = 0; i < rgb.length / 3; i++) {
    palette.push([rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2], i < alpha.length ? alpha[i] : 255]);
  }
  return { width, height, palette, scanlines: zlib.inflateSync(Buffer.concat(idat)) };
}
