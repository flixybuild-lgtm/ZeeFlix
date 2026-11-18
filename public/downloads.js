// Authorized progressive files only. HLS, DASH and embed URLs never enter this queue.
const jobs = new Map(), MEMORY_BUDGET = 48 * 1024 * 1024;
const $ = s => document.querySelector(s);
export const sizeLabel = n => n > 0 ? `${(n/1048576).toFixed(n<10485760?2:1)} MiB` : 'Size not supplied';
const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function rangeDecision(response, offset, validator) {
  if (!response.ok) throw Error(`HTTP ${response.status}`);
  if (response.status === 200) return {restart:offset>0,total:Number(response.headers.get('Content-Length')) || 0};
  if (response.status !== 206) throw Error('Unexpected download response.');
  const r = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('Content-Range') || '');
  if (!r || Number(r[1])!==offset || Number(r[2])<offset || Number(r[3])<=Number(r[2])) throw Error('The provider returned an invalid byte range. Restart the file.');
  const tag = response.headers.get('ETag') || response.headers.get('Last-Modified');
  if (offset && (!validator || tag!==validator)) throw Error('The source changed. Restart the file.');
  return {restart:false,total:Number(r[3])};
}
function fileName(title, url) {return `${title.replace(/[^\p{L}\p{N} -]/gu,'').slice(0,90) || 'ZeeFlix'}${/\.webm(?:$|\?)/i.test(url)?'.webm':'.mp4'}`;}
function native(job) { const a=document.createElement('a');a.href=job.url;a.download=job.name;a.target='_blank';a.rel='noopener noreferrer';a.click();job.state='Browser transfer';job.message='Progress and resume are managed by your browser or provider.';paintDownloads(); }
function clearData(j){j.chunks=[];j.offset=0;j.validator='';j.ranges=false;}
function allocated(){return [...jobs.values()].reduce((n,j)=>n+(j.writer?0:j.offset),0);}
export async function runTransfer(j) {
  if (j.running) return;j.running=true;j.ctrl=new AbortController();j.state='Downloading';j.message='';paintDownloads();const ctrl=j.ctrl;
  try {
    const resume=j.offset>0&&j.ranges&&j.validator;
    if (!resume && j.offset){clearData(j);if(j.writer){await j.writer.truncate(0);await j.writer.seek(0);}}
    const headers=resume?{Range:`bytes=${j.offset}-`,'If-Range':j.validator}:{};
    const r=await fetch(j.url,{headers,signal:ctrl.signal,credentials:'omit',referrerPolicy:'no-referrer'});
    const plan=rangeDecision(r,j.offset,j.validator);
    if(plan.restart){clearData(j);if(j.writer){await j.writer.truncate(0);await j.writer.seek(0);}}
    j.total=plan.total||j.total;j.ranges=r.headers.get('Accept-Ranges')==='bytes'||r.status===206;
    const tag=r.headers.get('ETag');j.validator=tag&&!tag.startsWith('W/')?tag:r.headers.get('Last-Modified')||'';
    if(!j.writer && j.total-j.offset+allocated()>MEMORY_BUDGET) {await r.body?.cancel();throw Error('File exceeds the in-tab memory limit. Use the browser transfer below.');}
    const reader=r.body.getReader();let last=0;
    for(;;){const {done,value}=await reader.read();if(done)break;if(ctrl.signal.aborted)throw new DOMException('Paused','AbortError');if(j.writer)await j.writer.write(value);else {if(allocated()+value.byteLength>MEMORY_BUDGET){await reader.cancel();throw Error('Memory limit reached. Use browser transfer.');}j.chunks.push(value);}j.offset+=value.byteLength;if(performance.now()-last>150){paintDownloads();last=performance.now();}}
    if(j.total && j.offset!==j.total)throw Error('Transfer interrupted before the file was complete.');
    if(j.writer){await j.writer.close();j.writer=null;j.state='Saved';j.offset=0;}else j.state='Ready to save';
  } catch(e) {if(j.state!=='Cancelled'){j.state=e.name==='AbortError'?'Paused':'Interrupted';j.message=e.name==='AbortError'?'':e.message;}}
  finally{j.running=false;paintDownloads();}
}
function jobCard(j){const pct=j.total?Math.min(100,Math.round(j.offset/j.total*100)):0;const line=j.state==='Saved'?sizeLabel(j.total):`${sizeLabel(j.offset).replace('Size not supplied','0 B')} / ${sizeLabel(j.total)}`;
  const button=(action,text)=>`<button data-job="${escape(j.key)}" data-transfer="${action}">${text}</button>`;
  let buttons='';if(j.state==='Downloading')buttons+=button('pause','Pause');if(['Paused','Interrupted'].includes(j.state))buttons+=button('resume',j.ranges&&j.validator?'Resume':'Restart')+button('native','Use browser transfer');if(j.state==='Ready to save')buttons+=button('save','Save file');if(!['Saved','Browser transfer','Cancelled'].includes(j.state))buttons+=button('cancel','Cancel');else buttons+=button('dismiss','Dismiss');
  return `<div class="transfer"><div class="transfer-top"><strong>${escape(j.title)}</strong><span>${escape(j.label)} · ${escape(j.state)}</span></div><progress max="100" ${j.total?`value="${j.state==='Saved'?100:pct}"`:''} aria-label="Download progress"></progress><span>${line}${j.total&&j.state==='Downloading'?` · ${pct}%`:''}</span>${j.message?`<p class="fine">${escape(j.message)}</p>`:''}<div class="transfer-actions">${buttons}</div></div>`;
}
export function paintDownloads(){const all=$('#download-jobs');if(all)all.innerHTML=jobs.size?[...jobs.values()].map(jobCard).join(''):'<div class="empty"><span class="empty-icon"><svg class="ico"><use href="icons.svg#download"></use></svg></span><h2>No transfers yet</h2><p>Open a film and use Download beneath the player to save an authorized file.</p><a class="btn subtle" href="#movies">Explore movies</a></div>';const slot=$('#transfer-slot');if(slot){const id=$('#player')?.dataset.id;slot.innerHTML=[...jobs.values()].filter(j=>j.id===id).map(jobCard).join('');}}
async function cancel(j){j.state='Cancelled';j.ctrl?.abort();if(j.writer){const w=j.writer;j.writer=null;await w.abort().catch(()=>{});}clearData(j);j.message='';paintDownloads();}
if(typeof document!=='undefined')document.addEventListener('click', async e=>{const b=e.target.closest('[data-transfer]');if(!b)return;const j=jobs.get(b.dataset.job);if(!j)return;switch(b.dataset.transfer){case 'pause':j.ctrl?.abort();break;case 'resume':runTransfer(j);break;case 'cancel':await cancel(j);break;case 'native':await cancel(j);native(j);break;case 'dismiss':jobs.delete(j.key);paintDownloads();break;case 'save':{const blob=new Blob(j.chunks,{type:j.name.endsWith('.webm')?'video/webm':'video/mp4'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=j.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);clearData(j);j.state='Saved';j.message='File handed to your browser for saving.';paintDownloads();break;}}});
export function offerDownload(data,variants,index){
  const allowed=variants.filter(v=>v.download);if(!allowed.length)return;
  const dialog=$('#dialog'),box=$('#dialog-content');box.innerHTML='<p class="eyebrow">OFFLINE VIEWING</p><h2>Download film</h2><p class="muted" id="dl-title"></p><div class="filters"><label>Available quality<select id="dl-quality"></select></label></div><p class="fine" id="dl-size"></p><div class="actions" style="margin-top:16px"><button class="btn gold" id="dl-start">Start download</button></div><p class="fine">Use for authorized viewing only. Large files use a disk picker or your browser’s download manager.</p>';
  $('#dl-title').textContent=data.title;const select=$('#dl-quality');allowed.forEach((v,i)=>select.add(new Option(v.label,i)));select.value=String(Math.max(0,allowed.indexOf(variants[index])));
  let probe=0;const update=async()=>{const n=++probe,variant=allowed[Number(select.value)];$('#dl-size').textContent=sizeLabel(variant.size);if(!variant.size)try{const r=await fetch(variant.download,{method:'HEAD',signal:AbortSignal.timeout(5000),credentials:'omit'});if(r.ok)variant.size=Number(r.headers.get('Content-Length'))||0;if(n===probe&&dialog.open&&$('#dl-size'))$('#dl-size').textContent=sizeLabel(variant.size);}catch{/* Size stays unknown; do not invent it. */}};select.onchange=update;dialog.showModal();update();
  $('#dl-start').onclick=async()=>{const v=allowed[Number(select.value)],key=`${data.id}:${v.label}`,previous=jobs.get(key);if(previous&&!['Cancelled','Saved','Browser transfer'].includes(previous.state)){dialog.close();paintDownloads();return;}
    const j={key,id:data.id,title:data.title,label:v.label,url:v.download,total:v.size||0,offset:0,chunks:[],name:fileName(data.title,v.url),state:'Queued',message:''};
    if(j.total+allocated()>MEMORY_BUDGET){if('showSaveFilePicker' in window){try{const handle=await window.showSaveFilePicker({suggestedName:j.name});j.writer=await handle.createWritable();}catch(e){if(e.name==='AbortError')return;jobs.set(key,j);dialog.close();native(j);return;}}else{jobs.set(key,j);dialog.close();native(j);return;}}
    jobs.set(key,j);dialog.close();runTransfer(j);
  };
}
