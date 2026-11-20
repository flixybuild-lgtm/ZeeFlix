// Narrow DOM host for the Rust renderer. The catalogue, filters, routes and persisted
// state are owned by WebAssembly; only browser capabilities live in these modules.
const $ = (s, root = document) => root.querySelector(s);
const encoder = new TextEncoder(), decoder = new TextDecoder();
const key = 'zeeflix:library:v1';
let wasm, destroyPlayer, pageGeneration = 0, searchTimer, toastTimer, dismissSplash, storageWarned = false;
let downloadsModule, unmountVega, bridgePlayback;
const probeResults = new Map();
/** Filter selections survive navigating away and back within the session. */
const searchState = new Map();
export function call(...args) {
  const input = encoder.encode(args.join('\n'));
  if (input.length > 524288) throw new Error('Library data exceeds its storage limit.');
  const p = wasm.input_buffer(input.length);
  new Uint8Array(wasm.memory.buffer, p, input.length).set(input);
  const start = wasm.dispatch();
  return decoder.decode(new Uint8Array(wasm.memory.buffer, start, wasm.result_len()));
}
function persist() {
  try { localStorage.setItem(key, call('dump')); }
  catch { if (!storageWarned) { toast('Browser storage is unavailable. Changes last for this session only.'); storageWarned = true; } }
}
function change(...args) { const result = call(...args); persist(); return result; }
export function toast(message) { const el = $('#toast'); el.textContent = message; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => el.hidden = true, 2600); }
export const svg = id => `<svg class="ico" aria-hidden="true"><use href="icons.svg#${id}"></use></svg>`;
/** `/title/sintel.html` (a pre-rendered share page) is the same route as `#title/sintel`. */
function routeFromPath(pathname) {
  const m = /\/title\/([a-z0-9][a-z0-9-]{0,63})(?:\.html)?\/?$/i.exec(pathname || '');
  return m ? `title/${m[1].toLowerCase()}` : '';
}
const route = () => (location.hash.slice(1) || routeFromPath(location.pathname) || 'home').split('?')[0].slice(0, 150);
// Also used by the share page's canonicalisation below.
window.__zfRouteFromPath = routeFromPath;
/** Absolute base of the deployed app, used for share links and deep links. */
const baseURL = () => new URL('.', document.baseURI).href;
/** A share page lives one directory deeper; <base href> already points home. */
const ageKey = 'zeeflix:allow-adult:v1';
function allowAdult() { try { return localStorage.getItem(ageKey) === '1'; } catch { return false; } }
function prefs() { const [splash, autoplay, theme] = call('prefs').split('\n'); document.documentElement.dataset.theme = theme; document.documentElement.dataset.allowAdult = String(allowAdult()); $('meta[name=theme-color]')?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()); return {splash: splash === '1', autoplay: autoplay === '1'}; }
function menu(open) { $('#profile-menu').hidden = !open; document.querySelectorAll('[data-act=profile]').forEach(b => b.setAttribute('aria-expanded', String(open))); }
function dialog(html) { $('#dialog-content').innerHTML = html; if (!$('#dialog').open) $('#dialog').showModal(); }
/** The Rust renderer emits `{{base}}` for links that depend on where the site is
 *  deployed (Pages subpath vs. custom domain). Patch it once per render. */
function patchBase(html) { return html.replaceAll('{{base}}', baseURL()); }
function confirmAction(title, copy, label, action) { dialog(`<div class="confirm"><p class="eyebrow">YOUR LIBRARY</p><h2>${title}</h2><p class="muted">${copy}</p><div class="actions"><button class="btn subtle" data-act="close-dialog">Cancel</button><button class="btn gold" id="confirm-action">${label}</button></div></div>`); $('#confirm-action').onclick = () => { $('#dialog').close(); action(); }; }
async function render(scroll = true, first = false) {
  const generation = ++pageGeneration;
  clearTimeout(searchTimer); destroyPlayer?.(); destroyPlayer = undefined; menu(false); $('#dialog').close();
  unmountVega?.(); unmountVega = undefined;
  const r = route();
  if (r !== 'watch/vega-session') bridgePlayback = undefined;
  // Retain the pre-rendered home when nothing needs hydration.
  if (!(first && r === 'home' && !window.__zfRestored)) $('#main').innerHTML = patchBase(call('page', r));
  const ageToggle = $('[data-key="adult"]');
  if (ageToggle) ageToggle.setAttribute('aria-checked', String(allowAdult()));
  if (r === 'watch/vega-session' && bridgePlayback) $('#main').innerHTML = call('bridge-player', bridgePlayback.name, bridgePlayback.url);
  document.querySelectorAll('[data-nav]').forEach(a => { const selected = a.dataset.nav === r || (a.dataset.nav === 'categories' && r.startsWith('genre/')); a.classList.toggle('current', selected); if (selected) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const title = $('#main h1')?.textContent;
  document.title = r === 'home' ? 'Framewave — Cinema on your wavelength.' : `${title || 'Library'} · Framewave`;
  if (scroll) { window.scrollTo({top: 0, behavior: 'instant'}); if (!first) $('#main').focus({preventScroll: true}); }
  if (r === 'search') $('#query')?.focus({preventScroll:true});
  // Remember the chosen filters so a back-navigation does not silently reset them.
  if (r === 'search') {
    const saved = searchState.get('filters');
    if (saved) for (const [sel, value] of Object.entries(saved)) { const el = $(sel); if (el) el.value = value; }
  }
  if (r === 'providers') document.querySelectorAll('[data-probe-id]').forEach(row => { const result = probeResults.get(row.dataset.probeId); if (result && !row.querySelector('[data-act=test-provider]').disabled) status(row, result); });
  if ($('#vega-connection')) {
    const {mountVega} = await import('./vega.js');
    if (generation === pageGeneration) unmountVega = mountVega($('#vega-connection'), stream => { bridgePlayback = stream; location.hash = 'watch/vega-session'; });
  }
  if ($('#player')) { const {mountPlayer} = await import('./player.js'); if (generation === pageGeneration) destroyPlayer = mountPlayer($('#player'), {change: r === 'watch/vega-session' ? () => {} : change, toast, svg}); }
  if (r === 'downloads') { downloadsModule = await import('./downloads.js'); if (generation === pageGeneration) downloadsModule.paintDownloads(); }
}
function deliverSearch() {
  if (!$('#query')) return;
  $('#results').innerHTML = call('results', $('#query').value, $('#genre-filter').value,
    $('#actor-filter').value, $('#year-filter').value,
    $('#kind-filter')?.value || '', $('#sort-filter')?.value || 'default');
  searchState.set('filters', {
    '#genre-filter': $('#genre-filter')?.value || '',
    '#actor-filter': $('#actor-filter')?.value || '',
    '#year-filter': $('#year-filter')?.value || '',
    '#kind-filter': $('#kind-filter')?.value || '',
    '#sort-filter': $('#sort-filter')?.value || 'default',
  });
}
function setSaved(id, on) {
  document.querySelectorAll('[data-act=list]').forEach(b => { if (b.dataset.id !== id) return; b.classList.toggle('saved', on); b.setAttribute('aria-pressed', String(on));
    b.setAttribute('aria-label', b.getAttribute('aria-label').replace(on ? /^Add / : /^Remove /, on ? 'Remove ' : 'Add ').replace(on ? / to My List$/ : / from My List$/, on ? ' from My List' : ' to My List'));
    const mini = b.classList.contains('tile-save'); b.innerHTML = svg(on ? 'check' : mini ? 'bookmark' : 'plus') + (mini ? '' : `<span>${on ? 'In My List' : 'My List'}</span>`);
  });
}
function status(row, {label, ok}) { const s = $('.status', row); s.textContent = label; s.className = `status ${ok === true ? 'ok' : ok === false ? 'bad' : ''}`; }
function onClick(e) {
  const button = e.target.closest('[data-act]');
  if (!e.target.closest('#profile-menu,[data-act=profile]')) menu(false);
  if (e.target.closest('.skip')) { e.preventDefault(); $('#main').focus(); return; }
  if (e.target === $('#dialog')) { const rect = e.target.getBoundingClientRect(); if (e.clientX < rect.left || e.clientY < rect.top || e.clientX > rect.right || e.clientY > rect.bottom) $('#dialog').close(); }
  if (!button) return;
  const {act, id = '', genre, n, key: pref} = button.dataset;
  switch (act) {
    case 'skip-intro': dismissSplash?.(); break;
    case 'profile': menu($('#profile-menu').hidden); break;
    case 'close-dialog': $('#dialog').close(); break;
    case 'list': { const on = change('list', id) === '1'; setSaved(id, on); if (route() === 'list') render(false); toast(on ? 'Added to My List' : 'Removed from My List'); break; }
    case 'favorite': { const on = change('favorite', id) === '1'; button.setAttribute('aria-pressed', String(on)); button.classList.toggle('saved', on); toast(on ? 'Added to favorites' : 'Removed from favorites'); break; }
    case 'genre': $('#genre-bar').innerHTML = call('chips', genre); $('#home-feed').innerHTML = call('feed', genre); break;
    case 'slide': case 'next-slide': case 'prev-slide': { const hero = $('.hero'), num = Number(hero.dataset.slide), count = Number(hero.dataset.slides); const slide = act === 'slide' ? Number(n) : (num + (act === 'next-slide' ? 1 : -1) + count) % count; $('#spotlight').innerHTML = call('hero', slide); break; }
    case 'reset-search': $('#query').value = ''; document.querySelectorAll('.filters select').forEach(s => s.value = ''); deliverSearch(); $('#query').focus(); break;
    case 'clear-history': confirmAction('Clear playback history?', 'This removes watch positions and recently watched titles on this device. Your list and favorites will stay.', 'Clear history', () => { change('clear-history'); render(false); toast('Playback history cleared'); }); break;
    case 'clear-data': confirmAction('Reset Framewave on this device?', 'This clears your local lists, favorites, playback history, settings, and saved Zenda-Cross connection. This cannot be undone.', 'Clear app data', () => { try { for (const k of Object.keys(localStorage)) if (k.startsWith('zeeflix:')) localStorage.removeItem(k); sessionStorage.removeItem('zeeflix:intro'); } catch { /* Private mode may disable storage. */ } location.reload(); }); break;
    case 'open-share': dialog(call('share', id, baseURL())); break;
    case 'share-native': {
      import('./share.js').then(async m => {
        const result = await m.shareTitle(id, button.closest('.share-sheet')?.querySelector('h2')?.textContent || 'Framewave');
        toast(result === 'shared' ? 'Shared' : result === 'copied' ? 'Link copied' : result === 'cancelled' ? 'Share cancelled' : 'Copy the link below to share');
      });
      break;
    }
    case 'copy-link': {
      import('./share.js').then(async m => {
        const url = m.copyURL(id);
        try { await navigator.clipboard.writeText(url); toast('Link copied to clipboard'); }
        catch { toast(url); }
      });
      break;
    }
    case 'download-poster': {
      import('./share.js').then(m => m.downloadPoster(button.dataset.art, id))
        .then(() => toast('Poster saved'))
        .catch(err => toast(err.message || 'Poster could not be saved'));
      break;
    }
    case 'pref': {const on = button.getAttribute('aria-checked') !== 'true'; if (pref === 'adult') { try { if (on) localStorage.setItem(ageKey, '1'); else localStorage.removeItem(ageKey); } catch { toast('Browser storage unavailable; the choice may not persist.'); } document.documentElement.dataset.allowAdult = String(on); } else change('pref', pref, on ? '1' : '0'); button.setAttribute('aria-checked', String(on)); break;}
  }
}
async function boot() {
  const response = await fetch(new URL('./zeeflix.wasm', import.meta.url));
  if (!response.ok) throw new Error('WebAssembly file unavailable');
  const {instance} = await WebAssembly.instantiate(await response.arrayBuffer()); wasm = instance.exports;
  try { const saved = localStorage.getItem(key); if (saved && saved.length < 512000) {call('load', saved); window.__zfRestored = true;} } catch { /* Session-only privacy mode. */ }
  const p = prefs(); let seen = false; try { seen = sessionStorage.getItem('zeeflix:intro') === '1'; } catch { /* Optional storage. */ }
  if (!seen && p.splash && route() === 'home' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const splash = $('#splash'); splash.hidden = false; dismissSplash = () => { splash.hidden = true; }; setTimeout(dismissSplash, 1450);
    try {sessionStorage.setItem('zeeflix:intro','1');} catch { /* Optional storage. */ }
  }
  document.addEventListener('click', onClick);
  document.addEventListener('input', e => {if (e.target.id === 'query') { clearTimeout(searchTimer); searchTimer = setTimeout(deliverSearch, 110); }});
  document.addEventListener('change', e => {if (e.target.closest('.filters')) deliverSearch(); if (e.target.id === 'theme') {change('pref','theme',e.target.value); prefs();} });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') {menu(false); dismissSplash?.();} if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.target.closest('input,select,textarea,dialog,#player')) {e.preventDefault(); if (route() !== 'search') location.hash = 'search'; else $('#query').focus();} });
  window.addEventListener('hashchange', () => {dismissSplash?.(); render();});
  await render(true, true); document.documentElement.dataset.ready = 'true';
  // A pre-rendered /title/<id>.html page becomes a normal in-app route, so a
  // refresh, a back-navigation or a re-share all agree on one canonical URL.
  const fromPath = routeFromPath(location.pathname);
  if (fromPath) { try { history.replaceState(null, '', `${baseURL()}#${fromPath}`); } catch { /* file:// */ } }
  if ('serviceWorker' in navigator && window.isSecureContext) window.addEventListener('load', registerCache, {once:true});
  if (document.readyState==='complete') registerCache();
}
function registerCache() {if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('./sw.js').catch(() => {});}
boot().catch(() => {const el=document.createElement('div');el.className='boot-error';el.textContent='Framewave could not start. Enable WebAssembly and reload the page.';document.body.append(el);});
