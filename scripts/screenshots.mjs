#!/usr/bin/env node
/**
 * Captures the Framewave marketing + store screenshot set into docs/screenshots/.
 *
 *   npm run build && node scripts/screenshots.mjs
 *   CHROMIUM_PATH=/tmp/chromium node scripts/screenshots.mjs
 *
 * The script serves dist/ with scripts/serve.py (HTTP range support), drives a
 * headless Chromium through Playwright, and writes deterministic PNGs that the
 * README, the install page and the social previews all reuse. External media
 * requests are stubbed so the capture never depends on a third-party provider.
 *
 * Every shot is independent: one failing route is logged and the run continues,
 * then a summary is printed. Exit code is non-zero only if nothing was captured.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'docs/screenshots');
const PUB = path.join(ROOT, 'dist/screenshots');
const PORT = Number(process.env.PORT || 4191);
const BASE = `http://127.0.0.1:${PORT}`;
const CHROMIUM = process.env.CHROMIUM_PATH || '/tmp/chromium';
const ON_CI = process.env.GITHUB_ACTIONS === 'true';

/** Emit GitHub Actions annotations so failures are readable from Checks. */
function annotate(level, title, message) {
  const text = String(message).replace(/[\r\n]+/g, ' ').slice(0, 900);
  if (ON_CI) console.log(`::${level} title=${title}::${text}`);
  console.log(`[${level}] ${title}: ${text}`);
}
const step = message => annotate('notice', 'screenshots', message);

// A hard crash anywhere below must still leave a report + annotation behind.
process.on('uncaughtException', err => fatal(err, 'uncaughtException'));
process.on('unhandledRejection', err => fatal(err, 'unhandledRejection'));

function fatal(err, kind) {
  const message = err?.stack || err?.message || String(err);
  annotate('error', `screenshots ${kind}`, message);
  try {
    fs.mkdirSync(path.join(ROOT, 'test-results'), { recursive: true });
    fs.writeFileSync(
      path.join(ROOT, 'test-results/screenshots-report.json'),
      JSON.stringify({
        captured: 0,
        failed: 1,
        fatal: { kind, message: String(message).slice(0, 4000) },
        failures: [{ name: kind, error: String(message).slice(0, 2000) }],
      }, null, 2)
    );
  } catch { /* best effort */ }
  process.exit(3);
}

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
step('starting static server');
await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('server did not start on ' + PORT)), 15000);
  server.stdout.on('data', chunk => {
    if (chunk.toString().includes('Framewave preview')) {
      clearTimeout(timer);
      resolve();
    }
  });
  server.on('exit', code => reject(new Error(`serve.py exited early (${code})`)));
});

let browser;

async function launch() {
  // channel:'chromium' prefers the full Chromium build over headless_shell,
  // which is what `playwright install chromium` provisions.
  browser = await chromium.launch({
    executablePath: fs.existsSync(CHROMIUM) ? CHROMIUM : undefined,
    channel: process.env.PW_CHANNEL || undefined,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--force-color-profile=srgb',
      '--autoplay-policy=no-user-gesture-required',
      '--js-flags=--max-old-space-size=1024',
    ],
    headless: true,
    timeout: 60000,
  });
  console.log(`Chromium ${browser.version()}`);
  step(`chromium ${browser.version()} launched`);
}

await launch();

/** A crashed renderer must not abort the whole run — relaunch and carry on. */
async function ensureBrowser() {
  try {
    if (!browser.isConnected()) throw new Error('disconnected');
    const probe = await browser.newPage();
    await probe.close();
  } catch {
    console.log('  ! browser died, relaunching…');
    await browser.close().catch(() => {});
    await launch();
  }
}

const webm = path.join(ROOT, 'dist/media/sintel.webm');
const webmSize = fs.statSync(webm).size;

async function newPage(width, height, scale) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
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
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><body style="background:#000"></body>' })
  );
  return page;
}

async function ready(page) {
  await page.waitForSelector('html[data-ready="true"]');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}

async function waitVideo(page) {
  await page.waitForFunction(() => (document.querySelector('video')?.readyState ?? 0) >= 2);
}

const captured = [];
const failed = [];

async function capture(name, page, fn) {
  try {
    await ensureBrowser();
    await fn();
    captured.push(name);
    return true;
  } catch (err) {
    failed.push({ name, error: err?.message || String(err) });
    console.log(`  ✗ ${name}: ${(err?.message || err).split('\n')[0]}`);
    await page.goto(`${BASE}/#home`).catch(() => {});
    await ready(page).catch(() => {});
    return false;
  }
}

/** Probe the shell once so a broken build fails fast with a useful message. */
async function assertAppBoots() {
  const page = await newPage(1280, 800, 1);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', r => errors.push(`request failed: ${r.url()}`));
  await page.goto(`${BASE}/#home`);
  try {
    await page.waitForSelector('html[data-ready="true"]', { timeout: 25000 });
  } catch {
    const state = await page.evaluate(() => ({
      ready: document.documentElement.dataset.ready || null,
      hasWasm: typeof WebAssembly === 'object',
      boot: document.querySelector('.boot-error')?.textContent || null,
      title: document.title,
    })).catch(() => ({}));
    await page.screenshot({ path: path.join(ROOT, 'test-results', 'boot-failure.png') }).catch(() => {});
    console.log('✗ The app shell did not reach data-ready="true".');
    console.log('  state:', JSON.stringify(state));
    if (errors.length) console.log('  page errors:', errors.slice(0, 6).join(' | '));
    await page.close();
    await browser.close().catch(() => {});
    server.kill('SIGTERM');
    process.exit(2);
  }
  await page.close();
  console.log('App shell boots ✓');
  step('app shell reached data-ready=true');
}

async function write(page, name, { pub = false, settle = 300 } = {}) {
  await page.waitForTimeout(settle);
  const target = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: target, animations: 'disabled' });
  if (pub) fs.copyFileSync(target, path.join(PUB, `${name}.png`));
  console.log(`  ✓ ${name}.png (${Math.round(fs.statSync(target).size / 1024)} KB)`);
}

step('probe: app shell boot');
await assertAppBoots();

console.log('Capturing desktop (1280 × 800)…');
{
  const page = await newPage(1280, 800, 1.5);
  await capture('home-desktop', page, async () => {
    await page.goto(`${BASE}/#home`);
    await ready(page);
    await write(page, 'home-desktop');
  });
  await capture('player-desktop', page, async () => {
    await page.goto(`${BASE}/#watch/sintel`);
    await ready(page);
    await waitVideo(page);
    await page.evaluate(() => { document.querySelector('video').currentTime = 168; });
    await write(page, 'player-desktop', { settle: 900 });
  });
  await capture('providers-desktop', page, async () => {
    await page.goto(`${BASE}/#providers`);
    await ready(page);
    const probe = page.locator('[data-probe-id="local"] [data-act="test-provider"]');
    if (await probe.count()) await probe.click();
    await page
      .waitForFunction(
        () => document.querySelector('[data-probe-id="local"] .status')?.textContent?.includes('Connected'),
        null,
        { timeout: 15000 }
      )
      .catch(() => {});
    await write(page, 'providers-desktop', { settle: 500 });
  });
  await capture('search-desktop', page, async () => {
    await page.goto(`${BASE}/#search`);
    await ready(page);
    await page.fill('#query', 'steel');
    await page.waitForSelector('.suggest');
    await write(page, 'search-desktop');
  });
  await capture('about-desktop', page, async () => {
    await page.goto(`${BASE}/#about`);
    await ready(page);
    await write(page, 'about-desktop');
  });
  await capture('detail-desktop', page, async () => {
    await page.goto(`${BASE}/#title/sintel`);
    await ready(page);
    await write(page, 'detail-desktop', { pub: true });
  });
  await capture('categories-desktop', page, async () => {
    await page.goto(`${BASE}/#categories`);
    await ready(page);
    await write(page, 'categories-desktop', { pub: true });
  });
  await capture('install-desktop', page, async () => {
    await page.goto(`${BASE}/install.html`);
    await page.evaluate(() => document.fonts.ready);
    await write(page, 'install-desktop', { pub: true, settle: 700 });
    await page.setViewportSize({ width: 1280, height: 1600 });
    await page.evaluate(() => window.scrollTo(0, 560));
    await write(page, 'install-steps-desktop', { pub: true, settle: 500 });
  });
  await page.close();
}

console.log('Capturing mobile (390 × 844)…');
{
  const page = await newPage(390, 844, 2);
  await capture('home-mobile', page, async () => {
    await page.goto(`${BASE}/#home`);
    await ready(page);
    await write(page, 'home-mobile', { pub: true });
    await page.evaluate(() => window.scrollTo({ top: 700 }));
    await write(page, 'home-mobile-shelves', { pub: true, settle: 450 });
  });
  await capture('provider-entry-mobile', page, async () => {
    await page.locator('.source-dock button').click();
    await page.waitForSelector('#provider-form');
    await write(page, 'provider-entry-mobile');
    await page.keyboard.press('Escape');
  });
  await capture('player-mobile', page, async () => {
    await page.goto(`${BASE}/#watch/sintel`);
    await ready(page);
    await waitVideo(page);
    await page.evaluate(() => { document.querySelector('video').currentTime = 168; });
    await write(page, 'player-mobile', { pub: true, settle: 900 });
  });
  await capture('detail-mobile', page, async () => {
    await page.goto(`${BASE}/#title/steel`);
    await ready(page);
    await write(page, 'detail-mobile', { pub: true });
  });
  await capture('providers-mobile', page, async () => {
    await page.goto(`${BASE}/#providers`);
    await ready(page);
    await write(page, 'providers-mobile', { pub: true });
  });
  await capture('search-mobile', page, async () => {
    await page.goto(`${BASE}/#search`);
    await ready(page);
    await write(page, 'search-mobile', { pub: true });
  });
  await capture('downloads-mobile', page, async () => {
    await page.goto(`${BASE}/#downloads`);
    await ready(page);
    await write(page, 'downloads-mobile', { pub: true });
  });
  await capture('settings-mobile', page, async () => {
    await page.goto(`${BASE}/#settings`);
    await ready(page);
    await write(page, 'settings-mobile', { pub: true });
  });
  await capture('install-mobile', page, async () => {
    await page.goto(`${BASE}/install.html`);
    await page.evaluate(() => document.fonts.ready);
    await write(page, 'install-mobile', { pub: true, settle: 800 });
    await page.evaluate(() => window.scrollTo(0, 760));
    await write(page, 'install-steps-mobile', { pub: true, settle: 500 });
  });
  await page.close();
}

await browser.close();
server.kill('SIGTERM');

fs.mkdirSync(path.join(ROOT, 'test-results'), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, 'test-results/screenshots-report.json'),
  JSON.stringify({ captured: captured.length, failed: failed.length, failures: failed, names: captured }, null, 2)
);

console.log(`\nCaptured ${captured.length} screenshot(s), ${failed.length} failure(s).`);
if (failed.length) {
  console.log('Failures:');
  for (const f of failed) console.log(`  - ${f.name}: ${f.error}`);
}
if (!captured.length) process.exit(1);
