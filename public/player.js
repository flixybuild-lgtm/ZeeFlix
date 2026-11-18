import {sourceFor} from './sources.js';
export const clock = n => {const t=Math.max(0,Math.floor(Number.isFinite(n)?n:0));return t>=3600?`${Math.floor(t/3600)}:${String(Math.floor(t/60)%60).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`:`${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`;};
const options=(select,items,selected)=>{select.replaceChildren(...items.map(([value,label])=>new Option(label,String(value))));select.value=String(selected);select.parentElement.hidden=!items.length;};
export function mountPlayer(root,{change,toast,svg}) {
  const $=sel=>root.querySelector(sel), v=$('video'), stage=$('#stage'), message=$('#player-message'), data=root.dataset;
  const life=new AbortController(), signal=life.signal;
  let stream=null, format='', variants=[], index=0, pendingSeek=Number(data.resume)||0, wanted=true, lastSaved=-1,lastTap=null,idleTimer,loadTimer,playEpoch=0;
  const listen=(el,event,fn)=>el?.addEventListener(event,fn,{signal});
  const status=text=>{message.textContent=text;message.hidden=!text;};
  const displayError=text=>{
    clearTimeout(loadTimer);status(text);const retry=document.createElement('button');retry.textContent='Retry';retry.onclick=()=>location.reload();message.append(retry);
    if (data.format==='peer') {const a=document.createElement('a');a.href=`https://video.blender.org/w/${encodeURIComponent(data.src)}`;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Open original';message.append(a);}
    if (data.id!=='sintel'){const a=document.createElement('a');a.href='#watch/sintel';a.textContent='Watch local Sintel';message.append(a);}
  };
  const save=()=>{if(v.readyState && Number.isFinite(v.duration)&&v.duration>0&&v.currentTime>=1){change('progress',data.id,Math.floor(v.currentTime),Math.ceil(v.duration));lastSaved=v.currentTime;}};
  const seek=s=>{if(Number.isFinite(v.duration))v.currentTime=Math.max(0,Math.min(v.duration,v.currentTime+s));};
  const tryPlay=async()=>{try{await v.play();}catch(e){if(!signal.aborted&&e.name==='NotAllowedError')status('Press play to start.');}};
  const toggle=()=>{if(v.paused){wanted=true;tryPlay();}else{wanted=false;v.pause();}};
  const volume=n=>{v.volume=Math.min(1,Math.max(0,n));v.muted=false;};
  const fullscreen=async()=>{try{if(document.fullscreenElement){await document.exitFullscreen();}else if(stage.requestFullscreen){await stage.requestFullscreen();if(matchMedia('(pointer:coarse)').matches) try{await screen.orientation?.lock?.('landscape');}catch{/* Unsupported on this device. */}}else if(v.webkitEnterFullscreen){v.webkitEnterFullscreen();}else{toast('Fullscreen is unavailable in this browser.');}}catch{toast('Fullscreen was declined by the browser.');}};
  function syncTracks(){
    const cc=$('#subtitles'), audio=$('#audio-tracks');
    if(format==='hls'&&stream){const t=stream.subtitleTracks||[];options(cc,t.length?[[-1,'Off'],...t.map((t,i)=>[i,t.name||t.lang||`Track ${i+1}`])]:[],stream.subtitleTrack);const a=stream.audioTracks||[];options(audio,a.map((t,i)=>[i,t.name||t.lang||`Audio ${i+1}`]),stream.audioTrack);return;}
    if(format==='dash'&&stream){const t=stream.getTracksFor('text')||[];options(cc,t.length?[[-1,'Off'],...t.map((t,i)=>[i,t.lang||`Track ${i+1}`])]:[],stream.getCurrentTextTrackIndex?.()??-1);const a=stream.getTracksFor('audio')||[];options(audio,a.map((t,i)=>[i,t.lang||`Audio ${i+1}`]),a.findIndex(t=>t.id===stream.getCurrentTrackFor('audio')?.id));return;}
    const tracks=Array.from(v.textTracks||[]);options(cc,tracks.length?[[-1,'Off'],...tracks.map((t,i)=>[i,t.label||t.language||`Track ${i+1}`])]:[],tracks.findIndex(t=>t.mode==='showing'));
    const a=Array.from(v.audioTracks||[]);options(audio,a.map((t,i)=>[i,t.label||t.language||`Audio ${i+1}`]),a.findIndex(t=>t.enabled));
  }
  const armTimeout=()=>{clearTimeout(loadTimer);loadTimer=setTimeout(()=>{if(!signal.aborted&&v.readyState<2)displayError('The stream is taking too long to respond.');},17000);};
  function directSource(n,initial=false){
    if(!initial){pendingSeek=v.currentTime;wanted=!v.paused;save();}index=n;v.src=variants[n].url;
    $('#download-current').hidden=!variants[n].download;status('Loading film…');armTimeout();v.load();
  }
  listen(v,'loadedmetadata',()=>{
    if(pendingSeek && Number.isFinite(v.duration))v.currentTime=Math.min(pendingSeek,Math.max(0,v.duration-1));pendingSeek=0;
    if(format==='direct') {if(variants.length===1){variants[0].label=v.videoWidth&&v.videoHeight?`${v.videoWidth} × ${v.videoHeight}`:'Original';}options($('#quality'),variants.map((s,i)=>[i,s.label]),index);}
    syncTracks();status('');if(wanted)tryPlay();
  });
  listen(v,'playing',()=>{clearTimeout(loadTimer);status('');$('[data-media=play]').innerHTML=svg('pause');});
  listen(v,'canplay',()=>{clearTimeout(loadTimer);if(!v.paused)status('');});
  listen(v,'pause',()=>{$('[data-media=play]').innerHTML=svg('play');save();});
  listen(v,'timeupdate',()=>{const d=v.duration;$('#time').textContent=`${clock(v.currentTime)} / ${Number.isFinite(d)?clock(d):'–:––'}`;if(Number.isFinite(d)&&d>0)$('#seek').value=Math.round(v.currentTime/d*1000);if(v.currentTime>=3&&Math.abs(v.currentTime-lastSaved)>=5)save();});
  listen(v,'ended',()=>{save();if(data.next&&data.autoplay==='true')location.hash=`watch/${data.next}`;else status('End of film. Press play to watch again.');});
  listen(v,'error',()=>{if(!signal.aborted)displayError('This media could not be played. The source or codec may be unavailable.');});
  listen(v,'waiting',()=>{if(!v.paused)status('Buffering…');});listen(v,'volumechange',()=>{$('#volume').value=String(v.muted?0:v.volume);$('[data-media=mute]').innerHTML=svg(v.muted||!v.volume?'mute':'volume');});
  listen(v.textTracks,'addtrack',syncTracks);listen(v.audioTracks,'addtrack',syncTracks);listen(window,'pagehide',save);listen(document,'visibilitychange',()=>{if(document.hidden)save();});
  listen($('#seek'),'input',e=>{if(Number.isFinite(v.duration))v.currentTime=v.duration*Number(e.target.value)/1000;});listen($('#volume'),'input',e=>volume(Number(e.target.value)));listen($('#speed'),'change',e=>v.playbackRate=Number(e.target.value));
  listen($('#quality'),'change',e=>{const n=Number(e.target.value);if(format==='direct')directSource(n);else if(format==='hls')stream.currentLevel=n;else if(format==='dash'){stream.updateSettings({streaming:{abr:{autoSwitchBitrate:{video:n===-1}}}});if(n!==-1)stream.setRepresentationForTypeById('video',stream.getRepresentationsByType('video')[n].id);}});
  listen($('#subtitles'),'change',e=>{const n=Number(e.target.value);if(format==='hls'&&stream)stream.subtitleTrack=n;else if(format==='dash')stream.setTextTrack(n);else Array.from(v.textTracks).forEach((t,i)=>{t.mode=i===n?'showing':'disabled';});});
  listen($('#audio-tracks'),'change',e=>{const n=Number(e.target.value);if(format==='hls'&&stream)stream.audioTrack=n;else if(format==='dash')stream.setCurrentTrack(stream.getTracksFor('audio')[n]);else Array.from(v.audioTracks||[]).forEach((t,i)=>t.enabled=i===n);});
  listen(root,'click',async e=>{const cmd=e.target.closest('[data-media]')?.dataset.media;if(cmd==='play')toggle();if(cmd==='mute')v.muted=!v.muted;if(cmd==='fullscreen')fullscreen();if(cmd==='pip')try{if(document.pictureInPictureElement)await document.exitPictureInPicture();else await v.requestPictureInPicture();}catch{toast('Picture-in-picture is not available for this stream.');}});
  listen(v,'click',e=>{if(e.detail===1&&!matchMedia('(pointer:coarse)').matches)toggle();});
  listen(v,'pointerup',e=>{if(e.pointerType!=='touch')return;const x=e.clientX-v.getBoundingClientRect().left,side=x<v.clientWidth/2?-1:1;const now=performance.now();if(lastTap&&now-lastTap.time<350&&lastTap.side===side){seek(side*10);toast(side===1?'Forward 10 seconds':'Back 10 seconds');lastTap=null;}else{lastTap={side,time:now};stage.classList.remove('idle');}});
  listen(stage,'pointermove',()=>{clearTimeout(idleTimer);stage.classList.remove('idle');idleTimer=setTimeout(()=>{if(!v.paused)stage.classList.add('idle');},2500);});
  listen(document,'keydown',e=>{if($('#embed-slot iframe')||e.altKey||e.ctrlKey||e.metaKey||e.target.closest('input,select,textarea,button,dialog,a,#profile-menu')||document.querySelector('dialog[open]'))return;const fn={k:toggle,' ':toggle,ArrowRight:()=>seek(10),ArrowLeft:()=>seek(-10),ArrowUp:()=>volume(v.volume+.1),ArrowDown:()=>volume(v.volume-.1),m:()=>{v.muted=!v.muted;},f:fullscreen}[e.key];if(fn){e.preventDefault();fn();}});
  listen($('#download-current'),'click',async()=>{const epoch=playEpoch;const mod=await import('./downloads.js');if(!signal.aborted&&epoch===playEpoch)mod.offerDownload(data,variants,index);});
  async function start(){
    const src=await sourceFor(data,signal);if(signal.aborted)return;format=src.mode;
    if(format==='embed'){
      v.hidden=true;$('#controls').hidden=true;$('#playback-options').querySelectorAll('label').forEach(l=>l.hidden=true);const iframe=document.createElement('iframe');iframe.title=data.title;iframe.src=src.url;iframe.allow='autoplay; fullscreen; picture-in-picture';iframe.referrerPolicy='strict-origin-when-cross-origin';iframe.setAttribute('sandbox','allow-scripts allow-same-origin allow-presentation');iframe.allowFullscreen=true;$('#embed-slot').append(iframe);status('');return;
    }
    if(document.pictureInPictureEnabled&&typeof v.requestPictureInPicture==='function')$('[data-media=pip]').hidden=false;
    if(['steel','sintel'].includes(data.id)){const t=document.createElement('track');t.kind='subtitles';t.label='English';t.srclang='en';t.src=`media/${data.id}-en.vtt`;v.append(t);}
    if(format==='direct'){
      variants=src.variants;const target=navigator.connection?.saveData?360:720;const preferred=variants.findIndex(s=>s.height>=target);directSource(Math.max(0,preferred),true);return;
    }
    armTimeout();
    if(format==='hls'){
      if(v.canPlayType('application/vnd.apple.mpegurl')){format='native-hls';v.src=src.url;return;}
      const {default:Hls}=await import('./vendor/hls.mjs');if(signal.aborted)return;if(!Hls.isSupported())throw Error('HLS is not supported on this device.');
      stream=new Hls({maxBufferLength:25,maxMaxBufferLength:45,backBufferLength:15,capLevelToPlayerSize:true});
      stream.on(Hls.Events.MANIFEST_PARSED,()=>{options($('#quality'),[[-1,'Auto'],...stream.levels.filter(l=>l.height).map(l=>[stream.levels.indexOf(l),`${l.height}p`])],-1);syncTracks();});
      stream.on(Hls.Events.AUDIO_TRACKS_UPDATED,syncTracks);stream.on(Hls.Events.SUBTITLE_TRACKS_UPDATED,syncTracks);stream.on(Hls.Events.ERROR,(_,e)=>{if(e.fatal)displayError('The HLS stream is unavailable or unsupported.');});stream.attachMedia(v);stream.loadSource(src.url);
    }else if(format==='dash'){
      if(!window.MediaSource)throw Error('DASH requires Media Source Extensions in this browser.');
      const {MediaPlayer}=await import('./vendor/dash.mjs');if(signal.aborted)return;stream=MediaPlayer().create();
      stream.updateSettings({streaming:{buffer:{bufferToKeep:12,bufferTimeDefault:20}}});stream.on(MediaPlayer.events.STREAM_INITIALIZED,()=>{options($('#quality'),[[-1,'Auto'],...stream.getRepresentationsByType('video').map((r,i)=>[i,r.height?`${r.height}p`:`${Math.round(r.bandwidth/1000)} kbps`])],-1);syncTracks();});stream.on(MediaPlayer.events.ERROR,()=>displayError('The DASH stream is unavailable or unsupported.'));stream.initialize(v,src.url,true);
    }
  }
  start().catch(e=>{if(!signal.aborted)displayError(e.name==='TypeError'?'Provider unreachable. Check your connection or try the original release.':e.message);});
  return ()=>{save();playEpoch++;life.abort();clearTimeout(idleTimer);clearTimeout(loadTimer);if(stream){if(format==='dash')stream.reset();else stream.destroy();}v.pause();v.removeAttribute('src');v.replaceChildren();v.load();$('#embed-slot').replaceChildren();};
}
