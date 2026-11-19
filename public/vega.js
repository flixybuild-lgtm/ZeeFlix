// Vega-compatible bridge client. Extension manifests are data; bundles are never loaded.
const repository = 'https://github.com/Zenda-Cross/vega-providers';
export const indexURL = 'https://api.github.com/repos/Zenda-Cross/vega-providers/contents/manifest.json';
const storageKey = 'zeeflix:vega-bridge:v1';
let savedURL = '';
try { savedURL = localStorage.getItem(storageKey) || ''; } catch { /* optional storage */ }
let lastSearch = null;

function httpsURL(raw) {
  if (typeof raw !== 'string' || raw.length > 2048 || /[\s<>"'\\\u0000-\u001f\u007f]/.test(raw) || !raw.startsWith('https://')) return null;
  try {
    const url = new URL(raw);
    return url.hostname && !url.username && !url.password ? url : null;
  } catch { return null; }
}
export function manifestURL(raw) {
  const url = httpsURL(raw.trim());
  if (!url || url.hash || url.search || !url.pathname.endsWith('/manifest.json') ||
      ['github.com', 'raw.githubusercontent.com', 'api.github.com'].includes(url.hostname)) {
    throw new Error('Enter the HTTPS manifest.json URL of your running Vega bridge, not its GitHub repository.');
  }
  return url.href;
}
export function validateManifest(manifest) {
  if (manifest?.id !== 'community.vega.stremio' || !Array.isArray(manifest.resources) ||
      !manifest.resources.some(resource => resource === 'stream' || resource?.name === 'stream') ||
      !Array.isArray(manifest.types) || !['movie', 'series'].every(type => manifest.types.includes(type))) {
    throw new Error('This endpoint is not a compatible Vega Streams bridge.');
  }
}
export function streamURL(manifest, raw) {
  const id = raw.trim();
  const type = /^tt\d{5,12}$/.test(id) ? 'movie' : /^tt\d{5,12}:[1-9]\d{0,3}:[1-9]\d{0,3}$/.test(id) ? 'series' : null;
  if (!type) throw new Error('Use an IMDb movie ID (tt1234567) or episode ID (tt1234567:1:2).');
  return new URL(`stream/${type}/${id}.json`, manifestURL(manifest)).href;
}
const labelText = text => typeof text === 'string' ? text.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').trim() : '';
export function parseStreams(data) {
  if (!Array.isArray(data?.streams)) throw new Error('The bridge did not return a stream list.');
  const streams = [];
  const seen = new Set();
  for (const stream of data.streams.slice(0, 250)) {
    const url = httpsURL(stream?.url);
    const hints = stream?.behaviorHints;
    if (!url || seen.has(url.href) || stream.drm || url.pathname.includes('/embed/') || hints?.notWebReady || Object.keys(hints?.proxyHeaders?.request || {}).length) continue;
    seen.add(url.href);
    const name = Array.from(labelText(stream.name) || 'Vega stream').slice(0, 60).join('');
    const title = Array.from(labelText(stream.description || stream.title)).slice(0, 180).join('');
    streams.push({name, title, url: url.href});
    if (streams.length === 30) break;
  }
  return streams;
}
export function parseDirectory(data) {
  if (data?.encoding !== 'base64' || typeof data.content !== 'string' || data.content.length > 180_000) throw new Error('Unknown repository manifest format.');
  const list = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(data.content), c => c.charCodeAt(0))));
  if (!Array.isArray(list)) throw new Error('Unknown repository manifest format.');
  return list.slice(0, 250).filter(p => typeof p?.display_name === 'string' && typeof p.value === 'string').map(p => ({
    name: labelText(p.display_name).slice(0, 90), version: labelText(p.version).slice(0, 20), disabled: p.disabled === true,
  }));
}
async function readJSON(url, signal, timeout = 12000) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal.aborted) abort();
  else signal.addEventListener('abort', abort, {once:true});
  const timer = setTimeout(abort, timeout);
  try {
    let response;
    try {
      response = await fetch(url, {credentials:'omit', redirect:'error', referrerPolicy:'no-referrer', cache:'no-store', signal:controller.signal});
    } catch { throw new Error('Could not reach the endpoint. Check HTTPS, browser CORS access and bridge availability.'); }
    if (!response.ok) throw new Error(`Endpoint returned HTTP ${response.status}.`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Endpoint did not return a response body.');
    try {
      const decoder = new TextDecoder();
      let text = '', size = 0;
      for (;;) {
        const {done, value} = await reader.read();
        if (done) {
          try { return JSON.parse(text + decoder.decode()); }
          catch { throw new Error('The endpoint did not return valid JSON.'); }
        }
        size += value.length;
        if (size > 512_000) throw new Error('Endpoint response is too large.');
        text += decoder.decode(value, {stream:true});
      }
    } finally { reader.cancel().catch(() => {}); }
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}

export function mountVega(root, onPlay) {
  const controller = new AbortController();
  const {signal} = controller;
  root.innerHTML = `<form class="bridge-form" id="bridge-connect"><label>Vega bridge manifest URL<input name="manifest" type="url" placeholder="https://your-bridge.example/manifest.json" required maxlength="2048"></label><button type="submit" class="btn gold">Connect bridge</button><button type="button" class="btn subtle" id="bridge-remove" hidden>Disconnect</button></form>
    <p class="bridge-status" id="bridge-status" role="status"></p>
    <div id="bridge-search-panel" hidden><form class="bridge-form" id="bridge-search"><label>IMDb movie or episode ID<input name="titleId" required maxlength="30" placeholder="tt1234567 or tt1234567:1:2"></label><label class="check-label"><input name="permission" type="checkbox" required> I have permission to watch this media.</label><button type="submit" class="btn gold">Find streams</button></form><p class="bridge-status" id="bridge-stream-status" role="status"></p><ul class="bridge-streams" id="bridge-results"></ul></div>
    <div class="bridge-links"><button type="button" class="btn subtle small" id="bridge-index-btn" aria-expanded="false" aria-controls="bridge-index-panel">Browse extension index</button><a class="text-link" href="${repository}" target="_blank" rel="noopener noreferrer">GitHub ↗</a><a class="text-link" href="https://github.com/Ashishsri2018/vega-stremio-addon#quick-start" target="_blank" rel="noopener noreferrer">Bridge setup ↗</a></div>
    <div id="bridge-index-panel" hidden><p class="fine" role="status" id="bridge-index-status"></p><ul class="bridge-index" id="bridge-index"></ul></div>`;
  const q = selector => root.querySelector(selector);
  const connect = q('#bridge-connect'), search = q('#bridge-search'), remove = q('#bridge-remove');
  const bridgeStatus = q('#bridge-status'), streamStatus = q('#bridge-stream-status');
  const results = q('#bridge-results'), panel = q('#bridge-search-panel');
  function showConnection() {
    connect.elements.manifest.value = savedURL;
    panel.hidden = remove.hidden = !savedURL;
    bridgeStatus.textContent = savedURL ? 'Bridge saved on this device. Enter an IMDb ID to look up streams.' : 'Not connected. Use a bridge you run or trust.';
  }
  function paint(id, streams) {
    search.elements.titleId.value = id;
    streamStatus.textContent = streams.length ? `${streams.length} compatible stream${streams.length === 1 ? '' : 's'} found.` : 'No compatible HTTPS streams found. Try another title or check the bridge configuration.';
    results.replaceChildren();
    for (const stream of streams) {
      const row = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = stream.title ? `${stream.name} — ${stream.title}` : stream.name;
      const play = document.createElement('button');
      play.type = 'button'; play.className = 'btn glass small'; play.textContent = 'Watch';
      play.addEventListener('click', () => {
        if (search.elements.titleId.value.trim() === id && search.reportValidity()) onPlay({url:stream.url, name:`${stream.name} · ${id}`});
      });
      row.append(label, play); results.append(row);
    }
  }
  function save(url) {
    savedURL = url;
    try { if (url) localStorage.setItem(storageKey, url); else localStorage.removeItem(storageKey); }
    catch { return false; }
    return true;
  }
  let revision = 0;
  showConnection();
  if (savedURL && lastSearch) paint(lastSearch.id, lastSearch.streams);
  connect.addEventListener('submit', async event => {
    event.preventDefault();
    const button = connect.querySelector('button[type=submit]');
    button.disabled = remove.disabled = true;
    panel.hidden = true;
    bridgeStatus.textContent = 'Checking bridge manifest…';
    try {
      const url = manifestURL(connect.elements.manifest.value);
      validateManifest(await readJSON(url, signal));
      if (signal.aborted) return;
      revision++;
      const persisted = save(url);
      lastSearch = null; search.reset(); results.replaceChildren(); streamStatus.textContent = '';
      showConnection();
      if (!persisted) bridgeStatus.textContent = 'Bridge connected for this session only. Storage is unavailable.';
    } catch (error) {
      if (!signal.aborted) {
        panel.hidden = !savedURL;
        bridgeStatus.textContent = `${error.message}${savedURL ? ' Your previous bridge is still active.' : ''}`;
      }
    } finally { button.disabled = remove.disabled = false; }
  });
  remove.addEventListener('click', () => {
    revision++;
    save(''); lastSearch = null; results.replaceChildren(); search.reset(); streamStatus.textContent = ''; showConnection();
  });
  search.elements.titleId.addEventListener('input', () => { lastSearch = null; results.replaceChildren(); streamStatus.textContent = ''; });
  search.addEventListener('submit', async event => {
    event.preventDefault();
    const endpoint = savedURL, requestRevision = revision;
    const id = search.elements.titleId.value.trim();
    const button = search.querySelector('button[type=submit]');
    button.disabled = true;
    lastSearch = null; results.replaceChildren(); streamStatus.textContent = 'Looking up streams…';
    try {
      const streams = parseStreams(await readJSON(streamURL(endpoint, id), signal, 60000));
      if (signal.aborted || revision !== requestRevision || search.elements.titleId.value.trim() !== id) return;
      lastSearch = {id, streams}; paint(id, streams);
    } catch (error) {
      if (!signal.aborted && revision === requestRevision) streamStatus.textContent = error.message;
    } finally { button.disabled = false; }
  });
  const indexButton = q('#bridge-index-btn'), indexPanel = q('#bridge-index-panel');
  const indexStatus = q('#bridge-index-status'), indexList = q('#bridge-index');
  let indexLoaded = false;
  indexButton.addEventListener('click', async () => {
    indexPanel.hidden = !indexPanel.hidden;
    indexButton.setAttribute('aria-expanded', String(!indexPanel.hidden));
    if (indexPanel.hidden || indexLoaded) return;
    indexButton.disabled = true;
    indexStatus.textContent = 'Reading the public Zenda-Cross manifest…';
    try {
      const index = parseDirectory(await readJSON(indexURL, signal));
      if (signal.aborted) return;
      indexStatus.textContent = `${index.length} extensions in the repository. This list does not install or enable extensions.`;
      for (const entry of index) {
        const li = document.createElement('li');
        li.textContent = `${entry.name}${entry.version ? ` · v${entry.version}` : ''}${entry.disabled ? ' · Disabled upstream' : ''}`;
        indexList.append(li);
      }
      indexLoaded = true;
    } catch (error) { if (!signal.aborted) indexStatus.textContent = error.message; }
    finally { indexButton.disabled = false; }
  });
  return () => controller.abort();
}
