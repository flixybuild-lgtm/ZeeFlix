#!/usr/bin/env python3
"""Build the static site: Rust pre-render + WASM + CSP-friendly, local assets."""
from pathlib import Path
import hashlib, json, shutil, subprocess

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'dist'
def run(*cmd):
    subprocess.run(cmd,cwd=ROOT,check=True)

run('cargo','build','--locked','--release','--target','wasm32-unknown-unknown','--lib')
if OUT.exists(): shutil.rmtree(OUT)
shutil.copytree(ROOT/'public',OUT,ignore=shutil.ignore_patterns('catalog.tsv'))
shutil.copy(ROOT/'target/wasm32-unknown-unknown/release/zeeflix.wasm',OUT/'zeeflix.wasm')
run('cargo','run','--quiet','--locked','--release','--bin','site','--',str(OUT))
esbuild=str(ROOT/'node_modules/.bin/esbuild')
run(esbuild,*map(str,(ROOT/'public').glob('*.js')),str(ROOT/'public/style.css'),'--minify','--target=es2022',f'--outdir={OUT}','--log-level=warning')
# No streaming library is requested until a user opens that particular format.
vendor=OUT/'vendor';vendor.mkdir()
run(esbuild,'node_modules/hls.js/dist/hls.mjs','--minify',f'--outfile={vendor}/hls.mjs','--log-level=warning')
shutil.copy(ROOT/'node_modules/dashjs/dist/modern/esm/dash.mediaplayer.min.js',vendor/'dash.mjs')
for src,dst in [('hls.js/LICENSE','HLS-LICENSE.txt'),('dashjs/LICENSE.md','DASH-LICENSE.txt'),('dashjs/dist/modern/esm/dash.mediaplayer.min.js.LICENSE.txt','dash.mediaplayer.min.js.LICENSE.txt')]:shutil.copy(ROOT/'node_modules'/src,vendor/dst)
(OUT/'.nojekyll').touch()
# Cache only requested, same-scope shell assets. Never cache media, byte ranges,
# third-party streams, user providers or signed URLs in the service worker.
assets=sorted(p for p in OUT.rglob('*') if p.is_file() and not {'vendor','media'}.intersection(p.relative_to(OUT).parts))
digest=hashlib.sha256()
for f in assets:digest.update(f.read_bytes())
version=digest.hexdigest()[:14]
worker='''const scope=new URL(self.registration.scope);const prefix='zeeflix:'+scope.pathname+':',name=prefix+'VERSION';const assets=new Set(ASSETS.map(p=>new URL(p,scope).href));assets.add(scope.href);
self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(prefix)&&key!==name)await caches.delete(key);await self.clients.claim()})()));
self.addEventListener('fetch',event=>{const r=event.request;if(r.method!=='GET'||r.headers.has('Range')||!assets.has(r.url))return;event.respondWith((async()=>{const c=await caches.open(name);const hit=await c.match(r);if(hit&&r.mode!=='navigate')return hit;try{const res=await fetch(r);if(res.ok)await c.put(r,res.clone());return res}catch(e){if(hit)return hit;throw e}})())});'''.replace('VERSION',version).replace('ASSETS',json.dumps([str(f.relative_to(OUT)) for f in assets]))
(OUT/'sw.js').write_text(worker)
print(f'Built ZeeFlix {version} → dist/ (relative URLs; no domain claimed)')
