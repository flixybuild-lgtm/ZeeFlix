import test from 'node:test';
import assert from 'node:assert/strict';
import {
  titleURL, posterFileName, sharePayload, shareText, shareStrategy,
  sessionMetadata, isStandalone, appBase,
} from '../public/share.js';

// Deep links must survive both the GitHub Pages subpath and a custom domain root.
test('titleURL builds an absolute deep link under any deploy base', () => {
  assert.equal(
    titleURL('sintel', 'https://flixybuild-lgtm.github.io/ZeeFlix/'),
    'https://flixybuild-lgtm.github.io/ZeeFlix/#title/sintel',
  );
  assert.equal(
    titleURL('tears', 'https://zeeflix.dpdns.org/'),
    'https://zeeflix.dpdns.org/#title/tears',
  );
  // An existing hash or query on the base must not leak into the link.
  assert.equal(
    titleURL('spring', 'https://zeeflix.dpdns.org/app/?x=1#home'),
    'https://zeeflix.dpdns.org/app/?x=1#title/spring',
  );
});

test('titleURL rejects ids that could escape the catalogue namespace', () => {
  for (const bad of ['', '  ', '../etc/passwd', 'a/b', 'x?y=1', 'a%20b', '<script>']) {
    assert.throws(() => titleURL(bad, 'https://example.com/'), /Unknown title id/, `accepted ${JSON.stringify(bad)}`);
  }
  assert.doesNotThrow(() => titleURL('gran-dillama', 'https://example.com/'));
});

test('appBase resolves the directory of the current document', () => {
  const doc = { baseURI: 'https://flixybuild-lgtm.github.io/ZeeFlix/index.html' };
  assert.equal(appBase(doc), 'https://flixybuild-lgtm.github.io/ZeeFlix/');
  const root = { baseURI: 'https://zeeflix.dpdns.org/' };
  assert.equal(appBase(root), 'https://zeeflix.dpdns.org/');
});

test('posterFileName is filesystem-safe and keeps the title readable', () => {
  assert.equal(posterFileName('Tears of Steel'), 'Tears-of-Steel-poster.png');
  assert.equal(posterFileName('Caminandes: Llamigos'), 'Caminandes-Llamigos-poster.png');
  assert.equal(posterFileName('Cosmos Laundromat / First Cycle'), 'Cosmos-Laundromat-First-Cycle-poster.png');
  // Emoji/accent stripping must never produce an empty name.
  assert.equal(posterFileName('🎬'), 'Framewave-poster.png');
  assert.equal(posterFileName(undefined), 'Framewave-poster.png');
  assert.ok(posterFileName('x'.repeat(200)).length <= 'x'.repeat(80).length + '-poster.png'.length);
});

test('share payload names the app and the film, and reads well as plain text', () => {
  const payload = sharePayload('Sintel', 'https://zeeflix.dpdns.org/#title/sintel');
  assert.equal(payload.title, 'Sintel · Framewave');
  assert.match(payload.text, /Sintel — streaming free on Framewave/);
  assert.match(payload.text, /No account, no ads, no tracking/);
  assert.equal(payload.url, 'https://zeeflix.dpdns.org/#title/sintel');
  assert.equal(
    shareText(payload),
    'Sintel — streaming free on Framewave. No account, no ads, no tracking.\nhttps://zeeflix.dpdns.org/#title/sintel',
  );
});

test('shareStrategy prefers native share, then clipboard, then legacy copy', () => {
  assert.equal(shareStrategy({ nav: { share: () => {} }, doc: {} }), 'share');
  assert.equal(shareStrategy({ nav: { share: () => {}, clipboard: { writeText: () => {} } }, doc: {} }), 'share');
  assert.equal(shareStrategy({ nav: { clipboard: { writeText: () => {} } }, doc: {} }), 'clipboard');
  assert.equal(shareStrategy({ nav: {}, doc: { execCommand: () => true } }), 'legacy');
  assert.equal(shareStrategy({ nav: {}, doc: {} }), 'manual');
  // A clipboard object without writeText must not be mistaken for support.
  assert.equal(shareStrategy({ nav: { clipboard: {} }, doc: {} }), 'manual');
});

test('sessionMetadata never ships an empty lock-screen card', () => {
  assert.deepEqual(sessionMetadata('Sintel'), {
    title: 'Sintel', artist: 'Framewave · Open Cinema', album: 'Framewave',
  });
  assert.equal(sessionMetadata('').title, 'Framewave');
  assert.equal(sessionMetadata(null, 'Blender').artist, 'Blender');
});

test('isStandalone is safe without a browser and reports installed PWAs', () => {
  const originalWindow = globalThis.window;
  const originalMatchMedia = globalThis.matchMedia;
  try {
    delete globalThis.window;
    assert.equal(isStandalone(), false);

    globalThis.window = {};
    globalThis.matchMedia = () => ({ matches: true });
    assert.equal(isStandalone(), true);

    globalThis.matchMedia = () => ({ matches: false });
    globalThis.window = { navigator: { standalone: true } };
    assert.equal(isStandalone(), true);

    globalThis.window = { navigator: {} };
    assert.equal(isStandalone(), false);
  } finally {
    globalThis.window = originalWindow;
    globalThis.matchMedia = originalMatchMedia;
  }
});
