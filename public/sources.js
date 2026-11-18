// On-demand media capabilities. A record in the catalogue is not a connection test.
const ORIGIN = 'https://video.blender.org';
export function mediaURL(raw, base = document.baseURI) {
  const u = new URL(raw, base);
  const local = /^media\/[a-z\d_-]+\.[a-z\d]+$/i.test(raw) && u.origin === new URL(base).origin;
  if (raw.startsWith('media/') && !local) throw Error('Invalid local media path.');
  if ((!local && u.protocol !== 'https:') || u.username || u.password) throw Error('An authorized HTTPS source is required.');
  return u.href;
}
export function peerManifest(data, allowDownload, base) {
  if (data.privacy?.id !== 1 || data.blacklisted || data.state?.id !== 1) throw Error('The provider has not published this title.');
  const files = (data.files || []).filter(f => f.hasVideo !== false && f.hasAudio !== false && f.fileUrl && /\.mp4(?:\?|$)/i.test(f.fileUrl));
  const variants = files.map(f => ({ url:mediaURL(f.fileUrl,base), label:f.resolution?.label || 'Original', height:Number(f.resolution?.id) || 0, size:Number(f.size) || 0, download:allowDownload && data.downloadEnabled === true ? mediaURL(f.fileDownloadUrl || f.fileUrl,base) : '' })).sort((a,b)=>a.height-b.height);
  if (variants.length) return {mode:'direct', variants};
  const hls = data.streamingPlaylists?.find(p=>p.playlistUrl && p.type === 1);
  if (hls) return {mode:'hls',url:mediaURL(hls.playlistUrl,base)};
  if (data.embedPath?.startsWith('/videos/embed/')) return {mode:'embed',url:new URL(data.embedPath,ORIGIN).href};
  throw Error('No playable rendition is currently published.');
}
export async function sourceFor(data, signal) {
  const {format,src,id} = data;
  if (format === 'peer') {
    try {
      const res = await fetch(`${ORIGIN}/api/v1/videos/${encodeURIComponent(src)}`, {signal:AbortSignal.any([signal,AbortSignal.timeout(9000)]), credentials:'omit',referrerPolicy:'no-referrer'});
      if (!res.ok) throw Error(`Provider returned HTTP ${res.status}.`);
      return peerManifest(await res.json(), data.download === 'true', document.baseURI);
    } catch (e) {
      // A public CC release can play cross-origin even when discovery is blocked by CORS.
      // Do not infer download permission or quality from this fallback.
      if (id !== 'steel' || signal.aborted || !['TypeError','TimeoutError'].includes(e.name)) throw e;
      return {mode:'direct',variants:[{url:`${ORIGIN}/object-storage/web_videos/8533ea43-4271-4a57-9694-e9d0b35e1aa1-480.mp4`,label:'Original',size:0,download:''}]};
    }
  }
  const url=mediaURL(src);
  if (['embed','hls','dash'].includes(format)) return {mode:format,url};
  return {mode:'direct',variants:[{url,label:'Original',size:0,download:data.download==='true'?url:''}]};
}
export async function probe({format,url}) {
  try {
    if (format==='embed') return {label:'Embed status not exposed; open the title to test playback',ok:null};
    if (format==='peer') {
      const r=await fetch(`${ORIGIN}/api/v1/videos/${encodeURIComponent(url)}`,{signal:AbortSignal.timeout(9000),credentials:'omit'});
      if (!r.ok) throw Error(`HTTP ${r.status}`);
      const m=peerManifest(await r.json(),false,document.baseURI);return {label:m.mode==='direct'?'Connected · media index verified':'Connected · provider index verified',ok:true};
    }
    if (format==='hls'||format==='dash') {
      const r=await fetch(mediaURL(url),{signal:AbortSignal.timeout(9000),credentials:'omit'});
      if (!r.ok) throw Error(`HTTP ${r.status}`);
      const reader=r.body.getReader();let text='';const decoder=new TextDecoder();
      try {while(text.length<8192){const chunk=await reader.read();if(chunk.done)break;text+=decoder.decode(chunk.value,{stream:true});}}finally{await reader.cancel();}
      if (!(format==='hls'?text.trimStart().startsWith('#EXTM3U'):/<MPD[\s>]/.test(text))) throw Error('Invalid manifest');
      return {label:'Connected · manifest verified',ok:true};
    }
    return await new Promise(resolve=>{
      const v=document.createElement('video');v.preload='metadata';const finish=(label,ok)=>{clearTimeout(timer);v.onloadedmetadata=v.onerror=null;v.removeAttribute('src');v.load();resolve({label,ok});};
      const timer=setTimeout(()=>finish('Timed out',false),10000);v.onloadedmetadata=()=>finish(`Connected · ${v.videoWidth} × ${v.videoHeight}`,true);v.onerror=()=>finish('Unavailable or unsupported media',false);v.src=mediaURL(url);
    });
  } catch(e){return {label:e.name==='TimeoutError'?'Timed out':e.name==='TypeError'?'Unreachable or blocked by CORS':e.message,ok:false};}
}
