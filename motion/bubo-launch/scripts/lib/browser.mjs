// Launches the locally installed Chrome (puppeteer-core never downloads a browser).
// Override with CHROME_PATH. Rendering flags keep colour and text output stable between runs.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const candidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

export async function launch() {
  const executablePath = candidates.find((file) => fs.existsSync(file));
  if (!executablePath) throw new Error('No Chrome/Chromium found. Set CHROME_PATH.');
  return puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      '--force-color-profile=srgb',
      '--font-render-hinting=none',
      '--disable-lcd-text',
      '--hide-scrollbars',
      '--mute-audio',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
    ],
  });
}

export async function openPage(browser, url, width = 1080, height = 1920) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => console.error('[page error]', error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') console.error('[page console]', message.text());
  });
  await page.goto(url, { waitUntil: 'load' });
  return page;
}
