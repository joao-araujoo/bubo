// Proves the render contract: the film is a pure function of t.
// seek(0) → seek(8.25) → seek(0) → random order… every time t gives the same pixels.
import { launch, openPage } from './lib/browser.mjs';
import { startServer } from './serve.mjs';

const { server, url } = await startServer();
const browser = await launch();
try {
  const page = await openPage(browser, `${url}/src/index.html?render`);
  await page.waitForFunction('window.ready === true', { timeout: 120000 });
  const hashAt = (t) =>
    page.evaluate((t) => {
      window.seek(t);
      const c = document.getElementById('film');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let h = 2166136261;
      for (let i = 0; i < d.length; i += 7) h = Math.imul(h ^ d[i], 16777619) >>> 0;
      return h.toString(16);
    }, t);
  const times = [0, 8.25, 0, 3.6, 8.25, 12.4, 1.95, 0, 6.5, 12.4, 1.95, 6.5, 3.6];
  const seen = new Map();
  let ok = true;
  for (const t of times) {
    const h = await hashAt(t);
    if (seen.has(t) && seen.get(t) !== h) {
      ok = false;
      console.log(`MISMATCH at t=${t}: ${seen.get(t)} vs ${h}`);
    }
    seen.set(t, h);
    console.log(`seek(${t}) → ${h}`);
  }
  console.log(
    ok
      ? 'determinism: OK — every t renders identically regardless of order.'
      : 'determinism: FAILED',
  );
  if (!ok) process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
