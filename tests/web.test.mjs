import test from 'node:test';
import assert from 'node:assert/strict';
import { mediaURL, peerManifest } from '../public/sources.js';
import { sizeLabel, rangeDecision } from '../public/downloads.js';
import { clock } from '../public/player.js';

test('mediaURL allows HTTPS and relative local media/ files, blocks insecure or credentialed URLs', () => {
  const base = 'https://flixybuild-lgtm.github.io/ZeeFlix/';
  assert.equal(mediaURL('media/sintel.webm', base), 'https://flixybuild-lgtm.github.io/ZeeFlix/media/sintel.webm');
  assert.equal(mediaURL('https://video.blender.org/a.mp4', base), 'https://video.blender.org/a.mp4');
  assert.throws(() => mediaURL('http://example.com/a.mp4', base));
  assert.throws(() => mediaURL('https://user:pass@example.com/a.mp4', base));
  assert.throws(() => mediaURL('javascript:alert(1)', base));
  assert.throws(() => mediaURL('media/../secret.txt', base));
});

test('peerManifest exposes only available sorted MP4 qualities and enforces downloadEnabled', () => {
  const sample = {
    privacy: { id: 1 },
    state: { id: 1 },
    blacklisted: false,
    downloadEnabled: true,
    files: [
      { hasVideo: true, hasAudio: true, fileUrl: 'https://video.blender.org/f-1080.mp4', resolution: { id: 1080, label: '1080p' }, size: 50000000 },
      { hasVideo: true, hasAudio: true, fileUrl: 'https://video.blender.org/f-360.mp4', resolution: { id: 360, label: '360p' }, size: 12000000 },
      { hasVideo: true, hasAudio: false, fileUrl: 'https://video.blender.org/video-only.mp4', resolution: { id: 2160, label: '4K' }, size: 99000000 },
    ],
  };
  const m = peerManifest(sample, true, 'https://example.com/');
  assert.equal(m.mode, 'direct');
  assert.deepEqual(m.variants.map(v => v.label), ['360p', '1080p']);
  assert.equal(m.variants[0].download, 'https://video.blender.org/f-360.mp4');

  const noDl = peerManifest({ ...sample, downloadEnabled: false }, true, 'https://example.com/');
  assert.equal(noDl.variants[0].download, '');

  assert.throws(() => peerManifest({ ...sample, privacy: { id: 2 } }, true, 'https://example.com/'));
  assert.throws(() => peerManifest({ ...sample, blacklisted: true }, true, 'https://example.com/'));
});

test('rangeDecision validates HTTP 200, HTTP 206 byte ranges, and ETag validators', () => {
  const mk = (status, headers = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
  });
  assert.deepEqual(rangeDecision(mk(200, { 'Content-Length': '1024' }), 0, ''), { restart: false, total: 1024 });
  assert.deepEqual(rangeDecision(mk(200, { 'Content-Length': '1024' }), 512, '"a"'), { restart: true, total: 1024 });
  assert.deepEqual(
    rangeDecision(mk(206, { 'Content-Range': 'bytes 512-1023/1024', ETag: '"v1"' }), 512, '"v1"'),
    { restart: false, total: 1024 }
  );
  assert.throws(() => rangeDecision(mk(206, { 'Content-Range': 'bytes 0-100/1024', ETag: '"v1"' }), 512, '"v1"'));
  assert.throws(() => rangeDecision(mk(206, { 'Content-Range': 'bytes 512-1023/1024', ETag: '"v2"' }), 512, '"v1"'));
});

test('clock and sizeLabel format durations and file sizes accurately', () => {
  assert.equal(clock(0), '0:00');
  assert.equal(clock(888), '14:48');
  assert.equal(clock(3665), '1:01:05');
  assert.equal(sizeLabel(0), 'Size not supplied');
  assert.equal(sizeLabel(3 * 1024 * 1024), '3.00 MiB');
  assert.equal(sizeLabel(35 * 1024 * 1024), '35.0 MiB');
});
