// Screenshots any page of the film project (development aid).
// Usage: node scripts/snap.mjs <path-under-project> <out.png> [width] [height]
import path from 'node:path';

import { launch, openPage } from './lib/browser.mjs';
import { startServer } from './serve.mjs';

const [target = 'src/tools/poses.html', out = 'out/snap.png', width = '1500', height = '1300'] =
  process.argv.slice(2);
const { server, url } = await startServer();
const browser = await launch();
try {
  const page = await openPage(browser, `${url}/${target}`, Number(width), Number(height));
  await page.waitForFunction('window.ready === true', { timeout: 60000 });
  const report = await page.evaluate(() => window.poseReport ?? null);
  if (report) console.log(JSON.stringify(report));
  await page.screenshot({ path: path.resolve(out), fullPage: true });
  console.log(`snap: ${out}`);
} finally {
  await browser.close();
  server.close();
}
