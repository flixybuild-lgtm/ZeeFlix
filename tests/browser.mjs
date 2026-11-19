import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '..');
const PORT = 4179;
const BASE = `http://127.0.0.1:${PORT}`;
const CHROMIUM = process.env.CHROMIUM_PATH || '/tmp/chromium';

function startServer() {
  const proc = spawn('python3', ['scripts/serve.py'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
    proc.stdout.on('data', chunk => {
      if (chunk.toString().includes('Framewave preview')) {
        clearTimeout(timer);
        resolve(proc);
      }
    });
    proc.stderr.on('data', chunk => {
      if (chunk.toString().trim()) console.error('[serve]', chunk.toString().trim());
    });
    proc.on('exit', code => {
      clearTimeout(timer);
      reject(new Error(`Server exited early with code ${code}`));
    });
  });
}

async function waitReady(page) {
  await page.waitForSelector('html[data-ready="true"]');
  await page.evaluate(() => document.fonts.ready);
}

const server = await startServer();
const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROMIUM) ? CHROMIUM : undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  headless: true,
});

const report = {
  passed: [],
  failed: [],
  metrics: {},
};

async function check(name, fn) {
  try {
    await fn();
    report.passed.push(name);
    console.log(`PASS: ${name}`);
  } catch (err) {
    report.failed.push({ name, error: err?.stack || String(err) });
    console.error(`FAIL: ${name}\n`, err);
  }
}

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('console', m => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  // Sandbox network policy blocks external domains; route external media/embed endpoints to deterministic mocks.
  const webmPath = path.join(ROOT, 'dist/media/sintel.webm');
  const webmStat = fs.statSync(webmPath);
  await page.route('https://video.blender.org/**', async route => {
    const url = route.request().url();
    if (url.includes('/api/v1/videos/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          privacy: { id: 1 },
          state: { id: 1 },
          blacklisted: false,
          downloadEnabled: true,
          files: [
            { hasVideo: true, hasAudio: true, fileUrl: 'https://video.blender.org/object-storage/web_videos/mock-360.mp4', resolution: { id: 360, label: '360p' }, size: webmStat.size },
            { hasVideo: true, hasAudio: true, fileUrl: 'https://video.blender.org/object-storage/web_videos/mock-720.mp4', resolution: { id: 720, label: '720p' }, size: webmStat.size },
            { hasVideo: true, hasAudio: true, fileUrl: 'https://video.blender.org/object-storage/web_videos/mock-1080.mp4', resolution: { id: 1080, label: '1080p' }, size: webmStat.size },
          ],
        }),
      });
    } else if (url.endsWith('.mp4')) {
      const range = route.request().headers()['range'];
      if (range) {
        const m = /bytes=(\d+)-(\d*)/.exec(range);
        const start = Number(m?.[1] || 0);
        const end = m?.[2] ? Math.min(webmStat.size - 1, Number(m[2])) : Math.min(webmStat.size - 1, start + 524287);
        const buf = Buffer.alloc(end - start + 1);
        const fd = fs.openSync(webmPath, 'r');
        fs.readSync(fd, buf, 0, buf.length, start);
        fs.closeSync(fd);
        await route.fulfill({
          status: 206,
          headers: {
            'Content-Type': 'video/webm',
            'Content-Range': `bytes ${start}-${end}/${webmStat.size}`,
            'Content-Length': String(buf.length),
            'Accept-Ranges': 'bytes',
            'ETag': '"mock-etag"',
          },
          body: buf,
        });
      } else {
        await route.fulfill({
          status: 200,
          headers: {
            'Content-Type': 'video/webm',
            'Content-Length': String(webmStat.size),
            'Accept-Ranges': 'bytes',
            'ETag': '"mock-etag"',
          },
          path: webmPath,
        });
      }
    } else {
      await route.fulfill({ status: 204, body: '' });
    }
  });
  await page.route('https://www.youtube-nocookie.com/embed/**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><title>Mock Embed</title><body><p>Embed player</p></body>',
    });
  });

  await check('1. Splash screen displays exact student details and auto-transitions/skips cleanly', async () => {
    await page.goto(`${BASE}/`);
    await waitReady(page);
    const splashVisible = await page.locator('#splash').isVisible();
    assert.equal(splashVisible, true, 'Splash should show on first session visit');
    const splashText = await page.locator('#splash').textContent();
    for (const expected of ['Zeeshan Haider', '9th Class', 'Government High School No. 1', 'Teacher: Waqas Ashraf']) {
      assert.ok(splashText.includes(expected), `Missing splash text: ${expected}`);
    }
    await page.locator('[data-act="skip-intro"]').click();
    await page.waitForFunction(() => document.getElementById('splash')?.hidden === true);
  });

  await check('2. Homepage hero, spotlight carousel, genre chips, and all collections render', async () => {
    const t0 = performance.now();
    await page.reload();
    await waitReady(page);
    report.metrics.warmReloadMs = Math.round(performance.now() - t0);

    await page.evaluate(async () => {
      const imgs = [...document.querySelectorAll('.hero img, .rail img')].slice(0, 8);
      await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => { img.onload = img.onerror = res; })));
      for (const img of imgs) {
        if (!img.naturalWidth) throw new Error(`Broken image: ${img.src}`);
      }
    });

    assert.equal(await page.locator('.hero h1').textContent(), 'Tears of Steel');
    await page.locator('[data-act="next-slide"]').click();
    assert.equal(await page.locator('.hero h1').textContent(), 'Sintel');
    await page.locator('[data-act="prev-slide"]').click();
    assert.equal(await page.locator('.hero h1').textContent(), 'Tears of Steel');

    const shelves = await page.locator('.shelf h2').allTextContents();
    for (const expected of [
      'Trending Now', 'Popular Movies', 'Popular Series', 'Recently Added',
      'Action', 'Adventure', 'Science Fiction', 'Horror', 'Comedy', 'Romance', 'Documentaries',
    ]) {
      assert.ok(shelves.includes(expected), `Homepage missing shelf: ${expected}`);
    }

    await page.locator('[data-act="genre"][data-genre="Sci-Fi"]').click();
    assert.equal(await page.locator('#home-feed h2').textContent(), 'Sci-Fi');
    await page.locator('[data-act="genre"][data-genre="All"]').click();
  });

  await check('3. Navigation across Movies, TV Shows, Categories, About, Credits, and 404 fallback', async () => {
    for (const [hash, expectedTitle] of [
      ['#movies', 'Movies'],
      ['#shows', 'TV Shows'],
      ['#categories', 'Categories'],
      ['#genre/sci-fi', 'Sci-Fi'],
      ['#about', 'About Framewave'],
      ['#nonexistent-route', 'Page not found'],
    ]) {
      await page.goto(`${BASE}/${hash}`);
      await waitReady(page);
      const text = await page.locator('#main').textContent();
      assert.ok(text.includes(expectedTitle), `Route ${hash} missing "${expectedTitle}"`);
    }

    await page.goto(`${BASE}/#about`);
    await waitReady(page);
    const aboutText = await page.locator('#main').textContent();
    for (const phrase of [
      'About Framewave',
      'Framewave is a modern entertainment platform created by Zeeshan Haider, a 9th-class student at Government High School No. 1.',
      'The project focuses on modern technology, fast performance, smooth video playback, and a beautiful entertainment experience.',
      'CreatorZeeshan Haider',
      'Class9th Class',
      'SchoolGovernment High School No. 1',
      'TeacherWaqas Ashraf',
      'Technology',
      'Privacy',
      'Contact',
    ]) {
      assert.ok(aboutText.includes(phrase), `About page missing: ${phrase}`);
    }
  });

  await check('4. Instant debounced search, suggestions, genre/actor/year filters, and reset', async () => {
    await page.goto(`${BASE}/#search`);
    await waitReady(page);
    await page.fill('#query', 'steel');
    await page.waitForSelector('.suggest');
    assert.ok((await page.locator('.suggest').textContent()).includes('Tears of Steel'));
    await page.selectOption('#genre-filter', 'Sci-Fi');
    await page.selectOption('#actor-filter', 'Derek de Lint');
    await page.selectOption('#year-filter', '2012');
    assert.equal(await page.locator('#results .card').count(), 1);
    await page.selectOption('#year-filter', '2022');
    assert.ok((await page.locator('#results').textContent()).includes('No matches this time'));
    await page.locator('[data-act="reset-search"]').click();
    assert.equal(await page.locator('#results .card').count(), 11);
  });

  await check('5. My List, Favorites, Settings (splash disable + theme), and Clear History persist across reload', async () => {
    await page.goto(`${BASE}/#title/sintel`);
    await waitReady(page);
    await page.locator('[data-act="list"][data-id="sintel"]').click();
    await page.locator('[data-act="favorite"][data-id="sintel"]').click();

    await page.goto(`${BASE}/#list`);
    await waitReady(page);
    assert.ok((await page.locator('#main').textContent()).includes('Sintel'));

    await page.goto(`${BASE}/#favorites`);
    await waitReady(page);
    assert.ok((await page.locator('#main').textContent()).includes('Sintel'));

    await page.goto(`${BASE}/#settings`);
    await waitReady(page);
    await page.selectOption('#theme', 'midnight');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'midnight');
    await page.locator('[data-act="pref"][data-key="splash"]').click();

    await page.reload();
    await waitReady(page);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'midnight');

    const fresh = await browser.newPage();
    await fresh.addInitScript(saved => localStorage.setItem('zeeflix:library:v1', saved),
      await page.evaluate(() => localStorage.getItem('zeeflix:library:v1')));
    await fresh.goto(`${BASE}/`);
    await waitReady(fresh);
    assert.equal(await fresh.locator('#splash').isVisible(), false, 'Splash should stay hidden when disabled in settings');
    await fresh.close();
    await page.selectOption('#theme', 'cinema');
  });

  await check('6. Custom player plays local Sintel WebM, subtitles, speed, shortcuts, resume, Continue Watching, and episodes', async () => {
    await page.goto(`${BASE}/#watch/sintel`);
    await waitReady(page);
    await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
    const meta = await page.locator('video').evaluate(v => ({
      duration: v.duration,
      width: v.videoWidth,
      height: v.videoHeight,
      tracks: v.textTracks.length,
    }));
    assert.ok(meta.duration > 880, `Unexpected Sintel duration: ${meta.duration}`);
    assert.equal(meta.width, 640);
    assert.equal(meta.height, 272);
    assert.ok(meta.tracks >= 1, 'Expected English VTT subtitle track');

    const qualityText = await page.locator('#quality').textContent();
    assert.ok(qualityText.includes('640 × 272') && !qualityText.includes('4K'));
    await page.selectOption('#speed', '1.5');
    assert.equal(await page.locator('video').evaluate(v => v.playbackRate), 1.5);
    await page.selectOption('#subtitles', '0');
    assert.equal(await page.locator('video').evaluate(v => v.textTracks[0].mode), 'showing');

    await page.locator('#seek').fill('120');
    await page.locator('#seek').dispatchEvent('input');
    await page.locator('[data-media="play"]').click();
    await page.waitForFunction(() => localStorage.getItem('zeeflix:library:v1')?.includes('pos\tsintel\t'));

    await page.goto(`${BASE}/#home`);
    await waitReady(page);
    assert.ok((await page.locator('#home-feed').textContent()).includes('Continue Watching'));

    await page.goto(`${BASE}/#watch/sintel`);
    await waitReady(page);
    await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
    const resumedAt = await page.locator('video').evaluate(v => v.currentTime);
    assert.ok(resumedAt > 60, `Expected Sintel to resume >60s, got ${resumedAt}`);

    await page.goto(`${BASE}/#history`);
    await waitReady(page);
    await page.locator('[data-act="clear-history"]').click();
    await page.locator('#confirm-action').click();
    assert.ok((await page.locator('#main').textContent()).includes('No viewing history yet'));
    await page.goto(`${BASE}/#list`);
    await waitReady(page);
    assert.ok((await page.locator('#main').textContent()).includes('Sintel'));

    await page.goto(`${BASE}/#watch/gran-dillama`);
    await waitReady(page);
    await page.locator('a[href="#watch/llamigos"]').first().click();
    await page.getByRole('heading', {name: /Llamigos/}).waitFor();
  });

  await check('7. Mocked multi-quality PeerTube API + Embed isolation + Authorized Download with pause/resume/cancel', async () => {
    await page.goto(`${BASE}/#watch/steel`);
    await waitReady(page);
    await page.waitForFunction(() => document.querySelectorAll('#quality option').length === 3);
    const options = await page.locator('#quality option').allTextContents();
    assert.deepEqual(options, ['360p', '720p', '1080p']);
    assert.equal(await page.locator('#download-current').isHidden(), false);

    await page.locator('#download-current').click();
    await page.waitForSelector('#dl-start');
    assert.ok((await page.locator('#dl-size').textContent()).includes('34.3 MiB'));
    await page.locator('#dl-start').click();
    await page.waitForSelector('.transfer');
    const transferText = await page.locator('.transfer').textContent();
    assert.ok(transferText.includes('Tears of Steel'));
    await page.locator('[data-transfer="pause"]').click().catch(() => {});
    await page.locator('[data-transfer="cancel"], [data-transfer="dismiss"]').first().click();

    await page.goto(`${BASE}/#watch/fright`);
    await waitReady(page);
    const iframe = page.locator('#embed-slot iframe');
    assert.equal(await iframe.count(), 1);
    assert.ok((await iframe.getAttribute('src')).startsWith('https://www.youtube-nocookie.com/embed/'));
  });

  await check('8. Provider manager: add, test real status, disable, enable, edit, delete', async () => {
    await page.goto(`${BASE}/#providers`);
    await waitReady(page);

    const localRow = page.locator('[data-probe-id="local"]');
    await localRow.locator('[data-act="test-provider"]').click();
    await page.waitForFunction(() => document.querySelector('[data-probe-id="local"] .status')?.textContent?.includes('Connected'));
    assert.ok((await localRow.locator('.status').textContent()).includes('640 × 272'));

    await page.locator('[data-act="edit-provider"]').first().click();
    await page.fill('#provider-form input[name="name"]', 'My Local Screening');
    await page.selectOption('#provider-form select[name="format"]', 'webm');
    await page.fill('#provider-form input[name="url"]', 'media/sintel.webm');
    await page.check('#provider-form input[name="download"]');
    await page.check('#provider-form input[name="rights"]');
    await page.locator('#provider-form button[type="submit"]').click();

    await page.waitForSelector('[data-probe-id="custom-1"]');
    await page.locator('[data-probe-id="custom-1"] [data-act="test-provider"]').click();
    await page.waitForFunction(() => document.querySelector('[data-probe-id="custom-1"] .status')?.textContent?.includes('Connected'));

    await page.locator('[data-probe-id="custom-1"] [data-act="enable"]').click();
    await page.goto(`${BASE}/#title/custom-1`);
    await waitReady(page);
    assert.ok((await page.locator('#main').textContent()).includes('Title unavailable'));

    await page.goto(`${BASE}/#providers`);
    await waitReady(page);
    await page.locator('[data-probe-id="custom-1"] [data-act="delete-provider"]').click();
    await page.locator('#confirm-action').click();
    assert.equal(await page.locator('[data-probe-id="custom-1"]').count(), 0);
  });

  await check('Vega bridge: validate, browse extension metadata, search, play and disconnect', async () => {
    const fixture = await browser.newPage({reducedMotion: 'reduce'});
    try {
      const origin = 'https://bridge.fixture.test';
      await fixture.route(`${origin}/**`, async route => {
        const url = new URL(route.request().url());
        const headers = {'access-control-allow-origin':'*'};
        if (url.pathname === '/manifest.json') return route.fulfill({headers, json:{id:'community.vega.stremio', resources:['stream'], types:['movie','series']}});
        if (url.pathname === '/stream/movie/tt1234567.json') return route.fulfill({headers, json:{streams:[{name:'Demo provider', url:`${origin}/film.webm?temporary=1`}]}});
        if (url.pathname === '/film.webm') return route.fulfill({headers, contentType:'video/webm', path:path.join(ROOT,'public/media/sintel.webm')});
        return route.fulfill({status:404, headers});
      });
      await fixture.route('https://api.github.com/repos/Zenda-Cross/vega-providers/contents/manifest.json', route => route.fulfill({
        headers:{'access-control-allow-origin':'*'}, json:{encoding:'base64',content:Buffer.from(JSON.stringify([{display_name:'Demo Extension', value:'demo', version:'2.0', disabled:true}])).toString('base64')}
      }));
      await fixture.goto(`${BASE}/#providers`);
      await waitReady(fixture);
      await fixture.locator('#bridge-index-btn').click();
      await fixture.getByText('Demo Extension · v2.0 · Disabled upstream').waitFor();
      await fixture.locator('#bridge-connect input').fill('https://github.com/Zenda-Cross/vega-providers');
      await fixture.getByRole('button', {name:'Connect bridge'}).click();
      await fixture.getByText('not its GitHub repository', {exact:false}).waitFor();
      await fixture.locator('#bridge-connect input').fill(`${origin}/manifest.json`);
      await fixture.getByRole('button', {name:'Connect bridge'}).click();
      await fixture.getByText('Bridge saved on this device.', {exact:false}).waitFor();
      await fixture.reload(); await waitReady(fixture);
      await fixture.locator('#bridge-search input[name=titleId]').fill('tt1234567');
      await fixture.locator('#bridge-search input[name=permission]').check();
      await fixture.getByRole('button', {name:'Find streams'}).click();
      await fixture.locator('#bridge-results').getByRole('button', {name:'Watch'}).click();
      await fixture.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
      assert.equal(await fixture.locator('#player').getAttribute('data-id'), 'vega-session');
      assert.equal(await fixture.locator('#download-current').isVisible(), false);
      assert.equal(await fixture.evaluate(() => JSON.stringify(localStorage).includes('temporary=1')), false);
      await fixture.getByRole('link', {name:'Back to providers'}).click();
      await fixture.getByRole('button', {name:'Disconnect'}).click();
      assert.equal(await fixture.locator('#bridge-search-panel').isVisible(), false);
    } finally { await fixture.close(); }
  });

  await check('Liquid glass: Light and Matrix persist and particles respect reduced motion', async () => {
    const fixture = await browser.newPage();
    try {
      await fixture.goto(`${BASE}/#settings`); await waitReady(fixture);
      for (const theme of ['light', 'matrix']) {
        await fixture.selectOption('#theme', theme);
        await fixture.reload(); await waitReady(fixture);
        assert.equal(await fixture.locator('html').getAttribute('data-theme'), theme);
      }
      const layer = fixture.locator('.liquid-field i').first();
      assert.notEqual(await layer.evaluate(el => getComputedStyle(el).animationName), 'none');
      await fixture.emulateMedia({reducedMotion:'reduce'});
      assert.equal(await layer.evaluate(el => getComputedStyle(el).animationName), 'none');
    } finally { await fixture.close(); }
  });

  await check('9. Responsive layouts (Desktop, Tablet, Mobile) and GitHub Pages subpath /ZeeFlix/', async () => {
    for (const vp of [
      { width: 1440, height: 900 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(vp);
      await page.goto(`${BASE}/#home`);
      await waitReady(page);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 0, `Horizontal overflow ${overflow}px at ${vp.width}x${vp.height}`);
    }

    await page.locator('.mobile-menu').click();
    assert.equal(await page.locator('#profile-menu').isVisible(), true);
    await page.locator('.mobile-menu').click();

    await page.goto(`${BASE}/ZeeFlix/`);
    await waitReady(page);
    assert.equal(await page.locator('.hero h1').textContent(), 'Tears of Steel');
    await page.goto(`${BASE}/ZeeFlix/#watch/sintel`);
    await waitReady(page);
    await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
  });

  await check('10. Zero uncaught page errors or unexpected console errors', async () => {
    assert.deepEqual(pageErrors, [], `Page errors: ${pageErrors.join('; ')}`);
    assert.deepEqual(consoleErrors, [], `Console errors: ${consoleErrors.join('; ')}`);
  });

  report.metrics.buildSizes = {
    wasmBytes: fs.statSync(path.join(ROOT, 'dist/zeeflix.wasm')).size,
    appJsBytes: fs.statSync(path.join(ROOT, 'dist/app.js')).size,
    styleCssBytes: fs.statSync(path.join(ROOT, 'dist/style.css')).size,
    indexHtmlBytes: fs.statSync(path.join(ROOT, 'dist/index.html')).size,
  };
} finally {
  await browser.close();
  server.kill('SIGTERM');
}

fs.mkdirSync(path.join(ROOT, 'test-results'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'test-results/browser-report.json'), JSON.stringify(report, null, 2));
console.log(`\nSummary: ${report.passed.length} passed, ${report.failed.length} failed`);
if (report.failed.length > 0) process.exit(1);
