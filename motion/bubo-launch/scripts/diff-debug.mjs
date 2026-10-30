// Development aid: where do two renders of the same t differ after visiting another t?
import { launch, openPage } from './lib/browser.mjs';
import { startServer } from './serve.mjs';
const [a = '3.6', via = '6.5'] = process.argv.slice(2);
const { server, url } = await startServer();
const browser = await launch();
try {
  const page = await openPage(browser, `${url}/src/index.html?render`);
  await page.waitForFunction('window.ready === true', { timeout: 120000 });
  const r = await page.evaluate(
    (a, via) => {
      const c = document.getElementById('film');
      const g = c.getContext('2d');
      window.seek(Number(a));
      const d1 = g.getImageData(0, 0, c.width, c.height).data.slice();
      window.seek(Number(via));
      window.seek(Number(a));
      const d2 = g.getImageData(0, 0, c.width, c.height).data;
      let x0 = 1e9,
        y0 = 1e9,
        x1 = -1,
        y1 = -1,
        n = 0,
        maxd = 0;
      for (let i = 0; i < d1.length; i += 4) {
        const dd =
          Math.abs(d1[i] - d2[i]) +
          Math.abs(d1[i + 1] - d2[i + 1]) +
          Math.abs(d1[i + 2] - d2[i + 2]);
        if (dd > 0) {
          const p = i / 4,
            x = p % c.width,
            y = (p / c.width) | 0;
          n++;
          maxd = Math.max(maxd, dd);
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
      return { n, maxd, box: [x0, y0, x1, y1] };
    },
    a,
    via,
  );
  console.log(JSON.stringify(r));
} finally {
  await browser.close();
  server.close();
}
