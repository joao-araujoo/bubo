// Measures in-page drawing, readback and capture speed on this machine (development aid).
import { launch, openPage } from './lib/browser.mjs';
import { startServer } from './serve.mjs';

const { server, url } = await startServer();
const browser = await launch();
try {
  const page = await openPage(browser, `${url}/src/tools/bench.html`);
  await page.waitForFunction('window.ready === true', { timeout: 60000 });
  console.log(await page.evaluate(() => window.benchInfo));
  const t0 = Date.now();
  for (let i = 0; i < 5; i++) await page.screenshot({ type: 'png', optimizeForSpeed: true });
  console.log('png screenshot avg ms', (Date.now() - t0) / 5);
  const t1 = Date.now();
  for (let i = 0; i < 5; i++) await page.screenshot({ type: 'jpeg', quality: 98 });
  console.log('jpeg screenshot avg ms', (Date.now() - t1) / 5);
} finally {
  await browser.close();
  server.close();
}
