// Sharing, deep links and image download helpers.
//
// Pure functions live at the top so they can be unit-tested with `node --test`
// without a DOM. The browser-facing helpers are appended after them and are only
// invoked from app.js, which owns every other DOM concern.

/** Build the shareable URL for a hash route, preserving the deploy base path. */
export function titleURL(id, base) {
  const root = new URL(base);
  const clean = String(id || '').trim();
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(clean)) throw new Error('Unknown title id.');
  root.hash = `title/${clean}`;
  return root.href;
}

/** The canonical absolute base of the app (works under /ZeeFlix/ or a domain root). */
export function appBase(doc = document) {
  return new URL('.', doc.baseURI).href;
}

/** Accessible, self-contained poster markup for <a download>. */
export function posterFileName(title) {
  const safe = String(title || 'ZeeFlix')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return `${safe || 'ZeeFlix'}-poster.png`;
}

/** Share payload shared by the Web Share API and every clipboard fallback. */
export function sharePayload(title, url) {
  return {
    title: `${title} · ZeeFlix`,
    text: `${title} — streaming free on ZeeFlix. No account, no ads, no tracking.`,
    url,
  };
}

/** Text used when the platform only accepts plain text (WhatsApp, SMS, old Chrome). */
export function shareText({ title, text, url }) {
  return `${text}\n${url}`;
}

/**
 * Pick the best available share strategy. Pure so the decision is testable:
 * native share → clipboard → legacy textarea → give up (caller shows the URL).
 */
export function shareStrategy({ nav = {}, doc = {} } = {}) {
  if (typeof nav.share === 'function') return 'share';
  if (nav.clipboard && typeof nav.clipboard.writeText === 'function') return 'clipboard';
  if (typeof doc.execCommand === 'function') return 'legacy';
  return 'manual';
}

/** Media Session metadata: what the OS lock screen / notification shows. */
export function sessionMetadata(title, artist) {
  return {
    title: String(title || 'ZeeFlix'),
    artist: String(artist || 'ZeeFlix · Open Cinema'),
    album: 'ZeeFlix',
  };
}

// --------------------------------------------------------------------------- //
// browser-facing wiring
// --------------------------------------------------------------------------- //
export async function shareTitle(id, title) {
  const url = titleURL(id, appBase());
  const payload = sharePayload(title, url);
  const strategy = shareStrategy({ nav: navigator, doc: document });
  try {
    if (strategy === 'share') {
      await navigator.share(payload);
      return 'shared';
    }
    if (strategy === 'clipboard') {
      await navigator.clipboard.writeText(shareText(payload));
      return 'copied';
    }
    if (strategy === 'legacy') {
      const area = document.createElement('textarea');
      area.value = shareText(payload);
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.append(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok ? 'copied' : 'manual';
    }
  } catch (err) {
    // A user cancelling the native sheet is not an error worth surfacing.
    if (err?.name === 'AbortError') return 'cancelled';
  }
  return 'manual';
}

export function copyURL(id) {
  return titleURL(id, appBase());
}

/** Download the poster as a PNG so it can be shared as an image. */
export async function downloadPoster(art, title) {
  const src = new URL(`art/${art}.webp`, appBase()).href;
  const res = await fetch(src, { credentials: 'omit' });
  if (!res.ok) throw new Error(`Poster unavailable (HTTP ${res.status}).`);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = posterFileName(title);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 4000);
}

/**
 * Register Media Session metadata + transport controls so phones show a proper
 * lock-screen card instead of a bare browser tab. Silently no-ops elsewhere.
 */
export function attachMediaSession(video, { title, art }) {
  if (!('mediaSession' in navigator)) return false;
  const meta = sessionMetadata(title);
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      ...meta,
      artwork: [
        { src: new URL(`art/${art}.webp`, appBase()).href, sizes: '512x512', type: 'image/webp' },
      ],
    });
    const handlers = {
      play: () => video.play(),
      pause: () => video.pause(),
      seekbackward: () => { video.currentTime = Math.max(0, video.currentTime - 10); },
      seekforward: () => { video.currentTime = Math.min(video.duration || 0, video.currentTime + 10); },
      seekto: d => { if (Number.isFinite(d.seekTime)) video.currentTime = d.seekTime; },
    };
    for (const [action, fn] of Object.entries(handlers)) {
      try { navigator.mediaSession.setActionHandler(action, fn); } catch { /* unsupported action */ }
    }
    return true;
  } catch {
    return false;
  }
}

export function clearMediaSession() {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = null;
    for (const action of ['play', 'pause', 'seekbackward', 'seekforward', 'seekto']) {
      navigator.mediaSession.setActionHandler(action, null);
    }
  } catch { /* nothing to clear */ }
}

/**
 * PWA install prompt. Captures `beforeinstallprompt` so the app can offer a
 * real "Install app" button instead of relying on the browser menu.
 */
let installEvent = null;
export function watchInstallPrompt(onAvailable) {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installEvent = event;
    onAvailable?.(true);
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    onAvailable?.(false);
  });
}
export async function promptInstall() {
  if (!installEvent) return 'unavailable';
  installEvent.prompt();
  const { outcome } = await installEvent.userChoice;
  installEvent = null;
  return outcome; // 'accepted' | 'dismissed'
}
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  const standalone = typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches;
  // `navigator.standalone` is the iOS Safari home-screen flag.
  return Boolean(standalone) || window.navigator?.standalone === true;
}
