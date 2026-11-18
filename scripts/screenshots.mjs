#!/usr/bin/env node
/**
 * Captures the ZeeFlix marketing + store screenshot set into docs/screenshots/.
 *
 *   node scripts/screenshots.mjs            # real desktop + mobile web views
 *   CHROMIUM_PATH=/tmp/chromium node scripts/screenshots.mjs
 *
 * The script serves dist/ with scripts/serve.py (HTTP range support), drives a
 * headless Chromium through Playwright, and writes deterministic PNGs that the
 * README, the install page and the product-hunt/social previews all reuse.
 * Run `npm run build` first. External media requests are stubbed so the capture
 * never depends on a third-party provider being reachable.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'docs/screenshots');
const PUB = path.join(ROOT, 'dist/screenshots');
const PORT = 4191;
const BASE = `http://127.0.0.1:${PORT}`;
const CHROMIUM = process.env.CHROMIUM_PATH || '/tmp/chromium';

if (!fs.existsSync(path.join(ROOT, 'dist/index.html'))) {
  console.error('dist/ is missing. Run `npm run build` first.');
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(PUB, { recursive: true });

const server = spawn('python3', ['scripts/serve.py'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('server did not start')), 12000);
  server.stdout.on('data', c => {
    if (c.toString().includes('ZeeFlix preview')) {
      clearTimeout(timer);
      resolve();
    }
  });
});

const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROMIUM) ? CHROMIUM : undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'],
  headless: true,
});

const webm = path.join(ROOT, 'dist/media/sintel.webm');
const webmSize = fs.statSync(webm).size;

async function newPage(width, height, scale = 2) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  // Deterministic provider stubs: no external network during capture.
  await page.route('https://video.blender.org/**', async route => {
    const url = route.request().url();
    if (url.includes('/api/v1/videos/')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          privacy: { id: 1 },
          state: { id: 1 },
          blacklisted: false,
          downloadEnabled: true,
          files: [360, 720, 1080].map(h => ({
            hasVideo: true,
            hasAudio: true,
            fileUrl: `https://video.blender.org/object-storage/web_videos/mock-${h}.mp4`,
            resolution: { id: h, label: `${h}p` },
            size: webmSize,
          })),
        }),
      });
    }
    return route.fulfill({ status: 204, body: '' });
  });
  await page.route('https://www.youtube-nocookie.com/**', route =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><body style="background:#000"></body>' }),
  );
  return page;
}

async function ready(page) {
  await page.waitForSelector('html[data-ready="true"]');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450);
}

async function shot(page, name, { pub = false } = {}) {
  await page.waitForTimeout(320);
  const target = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: target, animations: 'disabled' });
  if (pub) fs.copyFileSync(target, path.join(PUB, `${name}.png`));
  const kb = Math.round(fs.statSync(target).size / 1024);
  console.log(`  ✓ ${name}.png (${kb} KB)`);
}

console.log('Capturing desktop…');
{
  const page = await newPage(1280, 800, 1.5);
  await page.goto(`${BASE}/#home`);
  await ready(page);
  await shot(page, 'home-desktop');

  await page.goto(`${BASE}/#watch/sintel`);
  await ready(page);
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
  await page.evaluate(() => { const v = document.querySelector('video'); v.currentTime = 168; });
  await page.waitForTimeout(900);
  await page.locator('#quality').scrollIntoViewIfNeeded();
  await shot(page, 'player-desktop');

  await page.goto(`${BASE}/#providers`);
  await ready(page);
  await page.locator('[data-probe-id="local"] [data-act="test-provider"]').click();
  await page.waitForFunction(() => document.querySelector('[data-probe-id="local"] .status')?.textContent?.includes('Connected'), null, { timeout: 15000 }).catch(() => {});
  await shot(page, 'providers-desktop');

  await page.goto(`${BASE}/#search`);
  await ready(page);
  await page.fill('#query', 'steel');
  await page.waitForSelector('.suggest');
  await shot(page, 'search-desktop');

  await page.goto(`${BASE}/#about`);
  await ready(page);
  await shot(page, 'about-desktop');

  await page.goto(`${BASE}/#title/sintel`);
  await ready(page);
  await shot(page, 'detail-desktop', { pub: true });

  await page.goto(`${BASE}/#categories`);
  await ready(page);
  await shot(page, 'categories-desktop', { pub: true });

  await page.goto(`${BASE}/install.html`);
  await ready(page).catch(() => {});
  await page.waitForTimeout(600);
  await shot(page, 'install-desktop', { pub: true });
  await page.setViewportSize({ width: 1280, height: 1600 });
  await page.evaluate(() => window.scrollTo(0, 560));
  await shot(page, 'install-steps-desktop', { pub: true });
  await page.close();
}

console.log('Capturing mobile (390 × 844)…');
{
  const page = await newPage(390, 844, 2);
  await page.goto(`${BASE}/#home`);
  await ready(page);
  await shot(page, 'home-mobile', { pub: true });
  await page.evaluate(() => window.scrollTo({ top: 700 }));
  await page.waitForTimeout(400);
  await shot(page, 'home-mobile-shelves', { pub: true });

  await page.goto(`${BASE}/#watch/sintel`);
  await ready(page);
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
  await page.evaluate(() => { document.querySelector('video').currentTime = 168; });
  await page.waitForTimeout(900);
  await shot(page, 'player-mobile', { pub: true });

  await page.goto(`${BASE}/#title/steel`);
  await ready(page);
  await shot(page, 'detail-mobile', { pub: true });

  await page.goto(`${BASE}/#providers`);
  await ready(page);
  await shot(page, 'providers-mobile', { pub: true });

  await page.goto(`${BASE}/#search`);
  await ready(page);
  await shot(page, 'search-mobile', { pub: true });

  await page.goto(`${BASE}/#downloads`);
  await ready(page);
  await shot(page, 'downloads-mobile', { pub: true });

  await page.goto(`${BASE}/#settings`);
  await ready(page);
  await shot(page, 'settings-mobile', { pub: true });

  await page.goto(`${BASE}/install.html`);
  await page.waitForTimeout(900);
  await shot(page, 'install-mobile', { pub: true });
  await page.evaluate(() => window.scrollTo(0, 760));
  await page.waitForTimeout(400);
  await shot(page, 'install-steps-mobile', { pub: true });
  await page.close();
}

// Install page thumbnails reuse the mobile captures (9:16 crops).
const thumbs = {
  'install-mobile-home': 'home-mobile',
  'install-mobile-player': 'player-mobile',
  'install-mobile-providers': 'providers-mobile',
};
for (const [dst, src] of Object.entries(thumbs)) {
  fs.copyFileSync(path.join(OUT, `${src}.png`), path.join(PUB, `${dst}.png`));
}

await browser.close();
server.kill('SIGTERM');
console.log(`\nDone. ${fs.readdirSync(OUT).filter(f => f.endsWith('.png')).length} screenshots in docs/screenshots/`);
