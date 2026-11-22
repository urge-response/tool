
'use strict';const data={intensity:5,urge:'',trigger:'',need:'',activity:'',impact:'',values:'',actions:''};let page=-1;const stages=[{name:'Relabel',desc:'Notice and name what you’re experiencing. An urge can feel powerful, but experiencing an urge doesn’t mean you have to act on it. You can acknowledge what you’re feeling without judging yourself.',example:'“I’m noticing an urge to engage in an addictive behaviour. This is an urge, not something I have to act on. I can acknowledge this feeling and choose what happens next.”'},{name:'Reattribute',desc:'Urges can arise from learned patterns in the brain and may be influenced by emotions, stress, habits, physical sensations, or unmet needs. Consider what might be contributing to this urge, without blaming or judging yourself.',example:'“My brain may have learned to associate this behaviour with relief or reward. I can explore what might have triggered this urge without needing to act on it.”'},{name:'Refocus',desc:'Urges often change in intensity over time. Rather than fighting the urge or criticizing yourself for experiencing it, consider what you need right now. You can choose an activity that supports that need or helps you redirect your attention for the next 10–15 minutes.'},{name:'Revalue',desc:'Addictive behaviours can offer a sense of immediate relief, comfort, or reward. At the same time, they may have consequences that conflict with what matters to you. Consider both the short-term appeal of acting on the urge and its possible longer-term effects on your life.'},{name:'Recreate',desc:'Whatever happened with this urge, you can choose what comes next. Consider the kind of life you want to create and the values that matter most to you. Every small action aligned with those values is an opportunity to move in that direction.'}];const $=id=>document.getElementById(id);
const DRAFT_KEY='urge_response_draft_v1', HISTORY_KEY='urge_response_history_v1';
const blank=()=>({intensity:5,urge:'',trigger:'',need:'',activity:'',impact:'',values:'',actions:''});
let view='home', selectedEntry=null, storageOK=true, draftExists=false, lastSaveError='', justSaved=false;
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]))}
// Browser PWA vault: all persistent check-in content is AES-GCM encrypted.
// The passphrase-derived key is only held in memory while unlocked.
const vault={key:null, cache:{}, pending:Promise.resolve(), error:'', db:null};
const VAULT_DB='urge-response-encrypted-v1', RECORD='vault';
const encoder=new TextEncoder(), decoder=new TextDecoder();
function b64(bytes){let s='';for(const n of bytes)s+=String.fromCharCode(n);return btoa(s)}
function unb64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
function openDB(){return new Promise((resolve,reject)=>{
 const req=indexedDB.open(VAULT_DB,1);
 req.onupgradeneeded=()=>req.result.createObjectStore('records');
 req.onerror=()=>reject(req.error);
 req.onsuccess=()=>resolve(req.result);
})}
function dbGet(db,key){return new Promise((resolve,reject)=>{
 const tx=db.transaction('records','readonly');const req=tx.objectStore('records').get(key);
 req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
})}
function dbPut(db,key,value){return new Promise((resolve,reject)=>{
 const tx=db.transaction('records','readwrite');tx.objectStore('records').put(value,key);
 tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
})}
async function derive(pass,salt){
 const base=await crypto.subtle.importKey('raw',encoder.encode(pass),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function seal(obj,key,salt){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(JSON.stringify(obj)));
 return {v:1,salt:b64(salt),iv:b64(iv),ciphertext:b64(new Uint8Array(ciphertext))};
}
async function unseal(record,key){
 const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(record.iv)},key,unb64(record.ciphertext));
 return JSON.parse(decoder.decode(raw));
}
let salt=null, vaultReady=false;
async function initVault(){
 vault.db=await openDB();
 const record=await dbGet(vault.db,RECORD);
 document.getElementById('setupPanel').hidden=!!record;
 document.getElementById('unlockPanel').hidden=!record;
 document.getElementById('gate').hidden=false;
 document.getElementById('gateStatus').textContent='';
}
async function createVault(pass){
 if(pass.length<12)throw Error('Choose a passphrase of at least 12 characters.');
 if(!window.isSecureContext||!crypto?.subtle)throw Error('Encryption requires HTTPS. Open your published GitHub Pages URL (https://), not the HTML file directly.');
 if(!vault.db)throw Error('Browser storage has not initialized. Please reload.');
 if(await dbGet(vault.db,RECORD))throw Error('An encrypted vault already exists.');
 salt=crypto.getRandomValues(new Uint8Array(16));
 const key=await derive(pass,salt);
 const initial={};
 await dbPut(vault.db,RECORD,await seal(initial,key,salt));
 vault.key=key;vault.cache=initial;vaultReady=true;openApp();
}
async function unlockVault(pass){
 const record=await dbGet(vault.db,RECORD);
 if(!record)throw Error('No saved vault found.');
 const key=await derive(pass,unb64(record.salt));
 const plain=await unseal(record,key);
 if(!plain||typeof plain!=='object'||Array.isArray(plain))throw Error('Vault contents invalid.');
 salt=unb64(record.salt);vault.key=key;vault.cache=plain;vaultReady=true;openApp();
}
function persist(){
 if(!vaultReady)throw Error('Vault is locked');
 const snapshot=JSON.parse(JSON.stringify(vault.cache));
 vault.pending=vault.pending.catch(()=>{}).then(async()=>dbPut(vault.db,RECORD,await seal(snapshot,vault.key,salt))).catch(e=>{
  storageOK=false;lastSaveError='Could not save encrypted data. Keep the app open and check device storage.';
  updateSaveState();throw e;
 });
 // Prevent an unhandled rejection while preserving failure for explicit checks.
 vault.pending.catch(()=>{});
 return vault.pending;
}
function readStore(key,fallback){return Object.prototype.hasOwnProperty.call(vault.cache,key)?JSON.parse(JSON.stringify(vault.cache[key])):fallback}
function writeStore(key,value){
 if(!vaultReady||!storageOK)return false;
 vault.cache[key]=JSON.parse(JSON.stringify(value));
 try{persist();return true}catch(e){storageOK=false;lastSaveError='Encrypted save failed.';return false}
}
function removeStore(key){
 if(!vaultReady||!storageOK)return false;
 delete vault.cache[key];
 try{persist();return true}catch(e){storageOK=false;lastSaveError='Encrypted deletion failed.';return false}
}
function openApp(){
 restoreDraft();render();
 document.getElementById('appShell').hidden=false;
 document.getElementById('gate').hidden=true;
 try { if (navigator.storage && typeof navigator.storage.persist === 'function') { navigator.storage.persist().catch(()=>{}); } } catch (_) {}
}
async function gateAction(mode){
 const status=document.getElementById('gateStatus');
 const btn=document.getElementById(mode==='create'?'createVault':'unlockVault');
 const input=document.getElementById(mode==='create'?'newPass':'passphrase');
 status.textContent='Creating encrypted vault…';if(mode==='unlock')status.textContent='Unlocking encrypted vault…';btn.disabled=true;
 try{
  if(mode==='create'){
   if(input.value!==document.getElementById('confirmPass').value)throw Error('Passphrases do not match.');
   await createVault(input.value);
  }else await unlockVault(input.value);
  input.value='';document.getElementById('confirmPass').value='';
 }catch(e){console.error('Vault access failed:',e);status.textContent=(mode==='unlock'?'Unable to unlock. Check the passphrase, or the vault may be damaged.':'Unable to create vault: ')+(e?.message||String(e))}
 finally{btn.disabled=false}
}
function restoreDraft(){const raw=readStore(DRAFT_KEY,null);if(raw && typeof raw==='object' && raw.answers && typeof raw.answers==='object'){Object.assign(data,blank(),raw.answers);data.intensity=Math.max(0,Math.min(10,Number(data.intensity)||0));page=Number.isInteger(raw.page)?Math.max(0,Math.min(4,raw.page)):0;draftExists=true;return true}return false}
function saveDraft(){if(!hasContent(data)&&page===0&&!draftExists)return;draftExists=writeStore(DRAFT_KEY,{answers:{...data},page,updatedAt:new Date().toISOString()});updateSaveState()}
function updateSaveState(){const node=$('saveState');if(!node)return;node.textContent=lastSaveError||(view==='checkin'&&draftExists?'Encrypted draft saving automatically':'')}
function getHistory(){const raw=readStore(HISTORY_KEY,[]);return Array.isArray(raw)?raw.filter(x=>x&&typeof x==='object'&&x.id&&x.answers):[]}
function field(key,label,placeholder='Write your thoughts here...'){return `<label class="question" for="${key}">${label}</label><textarea class="field" id="${key}" data-key="${key}" placeholder="${placeholder}">${esc(data[key])}</textarea>`}
function buttons(){return `<div class="actions"><button type="button" class="btn secondary" data-action="restart">Start over</button>${page>0?'<button type="button" class="btn secondary" data-action="back">← Back</button>':''}${page<4?'<button type="button" class="btn primary" data-action="next">Continue →</button>':'<button type="button" class="btn primary" data-action="save">Save check-in</button>'}</div>${page===4?'<div class="actions"><button type="button" class="btn outline" data-action="copy">Copy my responses</button><button type="button" class="btn outline" data-action="discard">Discard draft</button></div>':''}<p id="status" class="toast" role="status"></p>`}
function summary(d=data){return `4 Steps + 1: Addiction Urge Response\n\n1. Relabel\nUrge intensity: ${d.intensity}/10\nDescription: ${d.urge||'—'}\n\n2. Reattribute\nPossible cause: ${d.trigger||'—'}\n\n3. Refocus\nCurrent need: ${d.need||'—'}\n10–15 minute activity: ${d.activity||'—'}\n\n4. Revalue\nImpact of acting on the urge: ${d.impact||'—'}\n\n+1. Recreate\nValues and what matters: ${d.values||'—'}\nValues-aligned actions: ${d.actions||'—'}`}
function dateLabel(date){const d=new Date(date);return Number.isNaN(d.getTime())?'Date unavailable':d.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}
function render(){if(view!=='history')justSaved=false;const home=view==='home', history=view==='history', detail=view==='detail', checkin=view==='checkin';
$('headerTitle').textContent=home?'Addiction Urge Tool':history?'Check-in history':detail?'Saved reflection':`${page===4?'+1':page+1}. ${stages[page].name}`;
$('headerDesc').textContent=home?'A gentle space to pause, reflect, and choose what comes next.':history?'Your reflections, saved on this device.':detail?'Review or copy your saved responses.':'Take your time. You can go back or start over at any point.';
$('progress').hidden=!checkin;$('progress').innerHTML=checkin?stages.map((s,i)=>`<span class="segment ${i===page?'active':i<page?'done':''}" aria-label="Step ${i+1}: ${esc(s.name)}"></span>`).join(''):'';
$('home').hidden=home;document.querySelectorAll('[data-nav]').forEach(b=>b.setAttribute('aria-current',b.dataset.nav===view?'page':'false'));
let html='';
if(home){html=`<div class="eyebrow">Welcome</div><h2 class="lead">A space to pause without judgment</h2><p class="description">Urges are a common part of changing an addictive behaviour. Whether you act on an urge or not, you can approach yourself with curiosity and compassion. This tool offers a space to pause, reflect, and choose what comes next.</p><div class="card"><h3>Five guided stages</h3><p>Relabel → Reattribute → Refocus → Revalue → Recreate. No account required. Drafts are saved on this device; completed entries are saved only if you choose.</p></div>${draftExists?'<div class="notice">You have an unfinished check-in saved on this device.</div><button class="btn primary start" data-action="resume">Resume draft →</button><button class="btn secondary start" data-action="new">Start a new check-in</button>':'<button class="btn primary start" data-action="start">Begin a check-in →</button>'}<button class="btn outline start" data-action="history">View saved check-ins (${getHistory().length})</button><div class="notice" role="note"><strong>About this tool:</strong> This is a self-help reflection tool, not a substitute for professional medical or mental-health care. If you may be experiencing dangerous substance withdrawal, seek medical advice promptly. If you’re in immediate danger, seek emergency assistance.</div><div class="card"><h3>Install this app on your home screen</h3><p>Keep 4 Steps + 1 one tap away. After opening this website once, you can also use it offline.</p><p><strong>Android (Chrome):</strong> Tap the three-dot menu, then <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p><p><strong>iPhone (Safari):</strong> Tap the Share button, then <strong>Add to Home Screen</strong>.</p><p class="muted">Installation options vary by browser. Your encrypted reflections stay in this browser’s storage; installing does not create a backup.</p></div><div class="card"><h3>Privacy</h3><p>Your drafts and saved check-ins are encrypted on this device using your passphrase. If you forget it, your entries cannot be recovered. Browser storage may be cleared by the browser or device.</p><button class="btn secondary start" data-action="lock">Lock app</button></div><button class="btn danger start" data-action="delete-all">Delete all saved data</button>`}
else if(history){const entries=getHistory().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));html=`<div class="eyebrow">History</div><h2 class="lead">Saved check-ins</h2><p class="description">Only check-ins you explicitly saved appear here. Deleting a saved entry cannot be undone.</p>${justSaved?'<div class="notice" role="status">Thank you for taking time to reflect. Whatever happened, this moment doesn’t define you. You can return to your values and make another choice whenever you’re ready.</div>':''}`+(entries.length?entries.map(e=>`<article class="history-item"><h3>${esc(dateLabel(e.createdAt))}</h3><p>Urge intensity: ${esc(e.answers.intensity)}/10</p><div class="history-actions"><button class="btn primary" data-action="view" data-id="${esc(e.id)}">View</button><button class="btn danger" data-action="delete" data-id="${esc(e.id)}">Delete</button></div></article>`).join(''):'<div class="card"><h3>No saved check-ins yet</h3><p>When you finish a check-in, choose “Save check-in” to keep it here.</p></div>')}
else if(detail){const e=getHistory().find(x=>x.id===selectedEntry);if(!e){view='history';return render()}html=`<div class="eyebrow">Saved ${esc(dateLabel(e.createdAt))}</div><div class="review">${esc(summary(e.answers))}</div><div class="actions"><button class="btn secondary" data-action="history">← History</button><button class="btn primary" data-action="copy-entry" data-id="${esc(e.id)}">Copy responses</button><button class="btn danger" data-action="delete" data-id="${esc(e.id)}">Delete</button></div><p id="status" class="toast" role="status"></p>`}
else if(checkin){const s=stages[page];html=`<div class="eyebrow">Step ${page+1} of 5</div><p class="description" style="margin-top:14px">${esc(s.desc)}</p>${s.example?`<div class="quote">${esc(s.example)}</div>`:''}`;
if(page===0)html+=`<label class="question" for="intensity">How strong is the urge right now?</label><div class="rangebox"><div class="rangerow"><span>Urge intensity</span><span class="rating" id="rating">${data.intensity}/10</span></div><input id="intensity" type="range" min="0" max="10" step="1" value="${data.intensity}" aria-label="Urge intensity from zero to ten"><div class="rangeends"><span>0 · None</span><span>10 · Extremely strong</span></div></div>`+field('urge','Describe the urge and how it feels mentally and physically.');
if(page===1)html+=field('trigger','What might have caused this urge?');
if(page===2)html+=field('need','What do you need right now?')+field('activity','What could you do for 10–15 minutes to meet that need?')+`<div class="card"><h3>Tip</h3><p>If you’re unsure what you need, that’s okay. Consider doing something comforting, enjoyable, meaningful, or distracting. You don’t need to find the perfect activity.</p></div>`;
if(page===3)html+=field('impact','Reflecting on the facts, what impact does acting on the urge have on your life?');
if(page===4)html+=`<p class="description">Take a moment to reflect on what you care about and what gives your life meaning. You don’t need to make a major change right now. One small, meaningful action is enough to begin.</p>`+field('values','Take a moment to write down some of your values and what you find meaningful.')+field('actions','What behaviours or actions could you do that are aligned with those values?');html+=buttons()}
$('content').innerHTML=html;updateSaveState();

document.querySelectorAll('textarea[data-key]').forEach(t=>{
  t.addEventListener('input',()=>{data[t.dataset.key]=t.value;saveDraft()});
  // WebView's visual viewport updates asynchronously during keyboard animation.
  // Recheck after opening so a lower field can be scrolled into view.
  t.addEventListener('focus',()=>{
    const field=t;
    setTimeout(()=>{if(document.activeElement===field)field.scrollIntoView({block:'center',behavior:'instant'});},320);
  });
});const r=$('intensity');if(r)r.addEventListener('input',()=>{data.intensity=Number(r.value);$('rating').textContent=`${data.intensity}/10`;saveDraft()});}
// Returns 'handled' or 'exit' for Android's system Back gesture.
window.urgeAppBack = function(){
  if(view==='detail'){selectedEntry=null;view='history';render();}
  else if(view==='history'){view='home';render();}
  else if(view==='checkin' && page>0){nav(page-1);}
  else if(view==='checkin'){view='home';render();}
  else return 'exit';
  focusScreen();
  return 'handled';
};
function focusScreen(){
  const heading=document.getElementById('headerTitle');
  if(heading){heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}
  window.scrollTo({top:0,behavior:'instant'});
}
function nav(n){page=Math.max(0,Math.min(4,n));view='checkin';saveDraft();render();focusScreen()}
function clearDraft(){if(!removeStore(DRAFT_KEY))return false;Object.assign(data,blank());draftExists=false;page=0;return true}
function newCheckin(){if(draftExists&&!confirm('Discard the unfinished draft and start a new check-in?'))return;if(!clearDraft())return;nav(0)}
async function saveEntry(){const entries=getHistory();const entry={id:(typeof crypto!=='undefined'&&crypto.randomUUID)?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`,createdAt:new Date().toISOString(),answers:{...data}};if(!writeStore(HISTORY_KEY,[entry,...entries])){$('status').textContent=lastSaveError;return}if(!clearDraft()){$('status').textContent='Check-in saved, but the draft could not be cleared.';return}try{await vault.pending}catch(e){$('status').textContent='Encrypted save failed. Please retry.';return}justSaved=true;view='history';render()}
async function deleteEntry(id){if(!confirm('Permanently delete this saved check-in?'))return;const entries=getHistory();if(!writeStore(HISTORY_KEY,entries.filter(e=>e.id!==id)))return;try{await vault.pending}catch(e){alert('Encrypted deletion failed.');return}selectedEntry=null;view='history';render()}
function showActionError(e){
 console.error('Check-in navigation failed',e);
 const status=document.getElementById('status')||document.getElementById('saveState');
 if(status)status.textContent='Something went wrong: '+(e?.message||String(e))+'. Please try again.';
}
document.getElementById('content').addEventListener('click',event=>{
 const button=event.target.closest('button[data-action]');
 if(!button||!event.currentTarget.contains(button))return;
 event.preventDefault();
 try{const result=action(button.dataset.action,button.dataset.id);
  if(result&&typeof result.catch==='function')result.catch(showActionError);
 }catch(e){showActionError(e)}
});
function action(a,id){if(a==='lock'){
 document.getElementById('gateStatus').textContent='Saving before locking…';
 vault.pending.then(()=>{vault.key=null;vault.cache={};vaultReady=false;view='home';Object.assign(data,blank());draftExists=false;
 document.getElementById('appShell').hidden=true;document.getElementById('gate').hidden=false;
 document.getElementById('unlockPanel').hidden=false;document.getElementById('setupPanel').hidden=true;
 document.getElementById('gateStatus').textContent='App locked.';}).catch(()=>alert('Unable to finish saving. App remains unlocked.'));
 return;
}if(a==='delete-all'){if(confirm('Permanently delete all saved check-ins and the unfinished draft? This cannot be undone.')){if(removeStore(DRAFT_KEY)&&removeStore(HISTORY_KEY)){Object.assign(data,blank());draftExists=false;page=0;selectedEntry=null;view='home';render()}else alert('Some data could not be deleted. Please try again.')}return;}if(a==='start'||a==='resume'){nav(draftExists?page:0)}else if(a==='new')newCheckin();else if(a==='next')nav(Math.min(page+1,4));else if(a==='back')nav(Math.max(page-1,0));else if(a==='restart'||a==='discard'){if(confirm('Discard this unfinished check-in and clear its draft?')&&clearDraft()){view='home';render()}}else if(a==='save')return saveEntry();else if(a==='copy')copyResponses(summary());else if(a==='copy-entry'){const e=getHistory().find(x=>x.id===id);if(e)copyResponses(summary(e.answers))}else if(a==='history'){view='history';render()}else if(a==='view'){selectedEntry=id;view='detail';render()}else if(a==='delete')return deleteEntry(id)}
async function copyResponses(s){if(!confirm('Copying will place your private reflections on the system clipboard, outside this app’s encryption. Continue?'))return;try{await navigator.clipboard.writeText(s);$('status').textContent='Responses copied to clipboard.'}catch(e){const box=document.createElement('textarea');box.className='field';box.value=s;box.setAttribute('aria-label','Your responses, select to copy');$('status').replaceWith(box);box.focus();box.select();try{document.execCommand('copy')}catch(_){} }}
$('home').addEventListener('click',()=>{view='home';render()});document.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.nav==='home')view='home';else if(b.dataset.nav==='history')view='history';else if(b.dataset.nav==='checkin'){if(!draftExists&&view!=='checkin'){Object.assign(data,blank());page=0}view='checkin'}render()}));
document.getElementById('createVault').addEventListener('click',()=>gateAction('create'));
document.getElementById('unlockVault').addEventListener('click',()=>gateAction('unlock'));
document.getElementById('passphrase').addEventListener('keydown',e=>{if(e.key==='Enter')gateAction('unlock')});
initVault().catch(e=>{document.getElementById('gate').hidden=false;document.getElementById('setupPanel').hidden=true;document.getElementById('unlockPanel').hidden=true;document.getElementById('gateStatus').textContent='Unable to open secure browser storage. Please try a supported browser in normal browsing mode. Error: '+(e?.message||'Unknown error');});

if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}
