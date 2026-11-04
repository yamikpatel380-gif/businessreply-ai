/* BusinessReply AI — premium dashboard client. No simulated statuses or auto-sending. */
'use strict';
const $ = (id) => document.getElementById(id);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const safeStorage={getItem(key){try{return sessionStorage.getItem(key)}catch{return null}},setItem(key,value){try{sessionStorage.setItem(key,value)}catch{}},removeItem(key){try{sessionStorage.removeItem(key)}catch{}}};
const icons = {check:'i-check',activity:'i-activity',shield:'i-shield',message:'i-message',mail:'i-mail',info:'i-info'};
function icon(name) {const s=document.createElementNS('http://www.w3.org/2000/svg','svg');const u=document.createElementNS('http://www.w3.org/2000/svg','use');u.setAttribute('href','#'+(icons[name]||icons.activity));s.appendChild(u);return s;}
function text(id,v) {const el=$(id);if(el) el.textContent=String(v??'');}
function tone(id,label,value='') {const el=$(id);if(!el)return;el.textContent=label;el.dataset.tone=value;}
function humanDate(raw) {try{return new Date(raw).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}catch{return ''}}
const date=new Date();
text('todayText',date.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'}));
text('yearText',date.getFullYear());
text('greeting',date.getHours()<12?'Good morning.':date.getHours()<17?'Good afternoon.':'Good evening.');
const params=new URLSearchParams(location.hash.replace(/^#/,''));
const launch=params.get('admin');
if(location.hash) history.replaceState(null,'',location.pathname+location.search);
if(launch && /^[a-f0-9]{36}$/i.test(launch)) safeStorage.setItem('businessreply_admin',launch);
let token=safeStorage.getItem('businessreply_admin')||'';
let snapshot=null;
let statusBusy=false;
let profileRaw='';
let dirty=false;
let profileLoaded=false;
let currentView='overview';
let timer;
let confirmResolver=null;
if(token) $('adminCode').value=token;

async function api(path,opts={}) {
  const headers={'X-Admin-Token':token};
  if(opts.body!==undefined) headers['Content-Type']='application/json';
  let response;
  try { response=await fetch(path,{method:opts.method||'GET',headers,body:opts.body!==undefined?JSON.stringify(opts.body):undefined,cache:'no-store'}); }
  catch { throw new Error('Cannot reach local server. Open the current launch link from START_WINDOWS.bat.'); }
  const data=await response.json().catch(()=>({error:'Server returned an unreadable response'}));
  if(!response.ok) throw new Error(data.error||`HTTP ${response.status}`);
  return data;
}
function toast(message,error=false) {
  const el=$('toast');el.textContent=message;el.classList.toggle('error-toast',error);
  clearTimeout(timer);timer=setTimeout(()=>{el.textContent=''},6000);
}
function showConfirm(title,body){
  $('confirmTitle').textContent=title;$('confirmBody').textContent=body;
  $('confirmModal').hidden=false;
  return new Promise(resolve=>{confirmResolver=resolve;});
}
function closeConfirm(value){$('confirmModal').hidden=true;if(confirmResolver){confirmResolver(value);confirmResolver=null;}}
$('confirmCancel').onclick=()=>closeConfirm(false);
$('confirmYes').onclick=()=>closeConfirm(true);
$('confirmModal').addEventListener('click',e=>{if(e.target===$('confirmModal'))closeConfirm(false)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('confirmModal').hidden)closeConfirm(false)});

function goto(view){
  if(!['overview','channels','studio','business','activity','settings'].includes(view))return;
  currentView=view;
  $$('.view').forEach(el=>el.classList.toggle('active-view',el.id===`view-${view}`));
  $$('.nav-item').forEach(el=>{const active=el.dataset.view===view;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')});
  const names={overview:'OVERVIEW',channels:'CHANNELS',studio:'AI PLAYGROUND',business:'BUSINESS PROFILE',activity:'ACTIVITY',settings:'SETTINGS & HELP'};
  text('topCurrent',names[view]);
  $('sidebar').classList.remove('mobile-open');
  window.scrollTo({top:0,behavior:'smooth'});
  if(view==='business'&&token&&!profileLoaded) loadProfile();
}
$$('[data-view]').forEach(el=>el.addEventListener('click',()=>goto(el.dataset.view)));
$$('[data-goto]').forEach(el=>el.addEventListener('click',()=>goto(el.dataset.goto)));
$('brandLink').onclick=e=>{e.preventDefault();goto('overview')};
$('menuToggle').onclick=()=>$('sidebar').classList.toggle('mobile-open');

function putBadge(id,good,bad,goodWord='Ready',badWord='Not ready'){
  tone(id,good?goodWord:badWord,good?'good':bad?'bad':'warn');
}
function createEvent(e,wide=false) {
  const item=document.createElement('div');item.className='event-item';
  const badge=document.createElement('span');badge.className='event-icon';badge.appendChild(icon(e.kind==='gmail'?'mail':e.kind==='whatsapp'?'message':'activity'));
  const mid=document.createElement('div');const b=document.createElement('b');b.textContent=(e.kind||e.stage||'System').toUpperCase();
  const small=document.createElement('small');small.textContent=String(e.detail||'').slice(0,220);
  mid.append(b,small);const tm=document.createElement('span');tm.className='event-time';tm.textContent=humanDate(e.at);
  item.append(badge,mid,tm);return item;
}
function fillEvents(id,events,empty,max=12) {
  const list=$(id);list.replaceChildren();
  if(!events?.length){const p=document.createElement('p');p.className='empty';p.textContent=empty;list.appendChild(p);return;}
  events.slice(0,max).forEach(e=>list.appendChild(createEvent(e)));
}
function render(s){
  const business=s.business||{},wa=s.wa||{},gmail=s.gmail||{},ai=s.ai||{};
  const goodWa=wa.status==='connected';const goodGmail=!!gmail.connected;
  const goodAI=!!ai.connected;const goodBusiness=!!business.active;
  text('workspaceName',business.name||'Your workspace');
  $('channelDot').classList.toggle('lit',goodWa||goodGmail);
  $('topService').textContent=goodWa||goodGmail?'SYSTEM CONNECTED':'LOCAL WORKSPACE';
  $('topService').parentElement.classList.toggle('live',true);
  text('statWaValue',goodWa?'Connected':'Not linked');
  text('statWaBadge',wa.autoReply?'Auto ON':goodWa?'Ready':'Not linked');
  $('statWaBadge').classList.toggle('good',goodWa);
  text('statGmailValue',goodGmail?'Connected':'Not linked');
  text('statGmailBadge',gmail.autoReply?'Auto ON':goodGmail?'Ready':'Not linked');
  $('statGmailBadge').classList.toggle('good',goodGmail);
  text('statAiValue',goodAI?(ai.provider||'Ready'):'Not set');
  text('statAiBadge',goodAI?'Configured':'No API key');
  $('statAiBadge').classList.toggle('good',goodAI);
  text('statBusinessValue',goodBusiness?'Active':'Inactive');
  text('statBusinessBadge',goodBusiness?'Ready to use':'Needs setup');
  $('statBusinessBadge').classList.toggle('good',goodBusiness);
  tone('overviewWa',wa.autoReply?'Auto reply ON':goodWa?'Connected':'Not linked',goodWa?'good':'warn');
  tone('overviewGmail',gmail.autoReply?'Auto reply ON':goodGmail?'Connected':'Not linked',goodGmail?'good':'warn');
  tone('overviewAI',goodAI?'Configured':'Not configured',goodAI?'good':'warn');
  text('overviewAiSmall',goodAI?`${ai.provider} · ${ai.model}`:'Choose a provider in .env');
  fillEvents('overviewEvents',s.events,'No recent activity yet. New events will appear here.',3);
  tone('waStatus',goodWa?'Connected':wa.status==='error'?'Error':wa.status==='qr'?'Scan QR':(wa.status||'Not linked').replaceAll('_',' '),goodWa?'good':wa.status==='error'?'bad':'warn');
  tone('gmailStatus',goodGmail?'Connected':'Not linked',goodGmail?'good':'warn');
  tone('aiStatus',goodAI?'AI configured':'No AI key',goodAI?'good':'warn');
  tone('businessStatus',goodBusiness?'ACTIVE':'INACTIVE',goodBusiness?'good':'warn');
  text('waAccount',wa.account?`Linked account: ${wa.account}`:'No linked account');
  text('gmailAccount',gmail.address?`Connected as: ${gmail.address}`:'No Gmail account connected');
  text('waError',wa.error||'');
  text('gmailError',gmail.error||(!gmail.credentialsPresent?'To connect Gmail, add credentials.json to the project folder.':''));
  text('gmailDiagnostics',gmail.diagnostics?.lastResult||'No recent Gmail check.');
  text('activityGmailDiag',gmail.diagnostics?.lastResult||'No recent Gmail check.');
  const qr=$('qrBox');qr.replaceChildren();
  if(wa.qr && /^data:image\/(?:png|jpeg|webp);base64,/i.test(wa.qr)){
    const im=document.createElement('img');im.src=wa.qr;im.alt='WhatsApp linked-device QR code';qr.appendChild(im);
  } else if(goodWa) {
    const glyph=document.createElement('div');glyph.className='qr-symbol';glyph.appendChild(icon('check'));
    const p=document.createElement('p');p.textContent='WhatsApp is connected. QR is not needed.';qr.append(glyph,p);
  } else {
    const g=document.createElement('div');g.className='qr-symbol';g.textContent='▦';
    const p=document.createElement('p');p.textContent=wa.status==='error'?'Connection failed. See the error below and retry when appropriate.':wa.status==='starting'?'Connecting to WhatsApp… QR will appear here.':'Open WhatsApp → Linked devices → Link a device when the QR appears.';
    qr.append(g,p);
  }
  $('retryWa').disabled=!!wa.retrying||goodWa;
  $('logoutWa').disabled=!goodWa;
  $('toggleWa').disabled=!(goodWa&&goodAI&&goodBusiness);
  $('toggleGmail').disabled=!(goodGmail&&goodAI&&goodBusiness);
  $('toggleWa').setAttribute('aria-pressed',String(!!wa.autoReply));
  $('toggleGmail').setAttribute('aria-pressed',String(!!gmail.autoReply));
  $('gmailCheckNow').disabled=!(gmail.autoReply&&goodGmail&&goodBusiness);
  $('disconnectGmail').disabled=!goodGmail;
  text('providerName',goodAI?ai.provider:'Not configured');
  text('providerModel',goodAI?ai.model:'Set AI_PROVIDER and key in .env');
  tone('waActivityBadge',goodWa?'Connected':'Waiting',goodWa?'good':'warn');
  const counts=wa.counters||{};
  text('countReceived',counts.received||0);text('countSent',counts.sent||0);
  text('countSkipped',counts.skipped||0);text('countFailed',counts.failed||0);
  fillEvents('waActivity',(wa.activity||[]).map(e=>({...e,kind:e.stage})),'No WhatsApp activity recorded yet.');
  fillEvents('events',s.events,'No activity recorded yet.');
  text('activityCount',Math.min((s.events||[]).length,99));
}
async function refresh(opts={silent:true}) {
  if(!token||statusBusy)return;
  statusBusy=true;
  try {
    const s=await api('/api/status');
    snapshot=s;render(s);
    $('loginOverlay').hidden=true;
    $('loginError').textContent='';
    safeStorage.setItem('businessreply_admin',token);
    if(!opts.silent)toast('Live status updated');
    if(!profileLoaded)loadProfile();
  }catch(e){
    if(/Invalid admin code|HTTP 401/i.test(e.message)){
      token='';safeStorage.removeItem('businessreply_admin');
      $('loginOverlay').hidden=false;$('loginError').textContent='Incorrect or old admin code. Use the launch link from the current terminal.';
    }else if(!opts.silent){toast(e.message,true);}
  }finally{statusBusy=false;}
}
$('loginForm').onsubmit=async e=>{
  e.preventDefault();token=$('adminCode').value.trim();
  if(!token){$('loginError').textContent='Enter your local admin code.';return;}
  $('loginError').textContent='Checking local connection…';
  try {
    const s=await api('/api/status');
    snapshot=s;render(s);$('loginOverlay').hidden=true;
    $('loginError').textContent='';safeStorage.setItem('businessreply_admin',token);
    if(!profileLoaded)loadProfile();
  }catch(err){$('loginError').textContent=err.message;}
};
$('refreshNow').onclick=()=>refresh({silent:false});
$('activityRefresh').onclick=()=>refresh({silent:false});

async function action(path,opts){
  try {const result=await api(path,opts);await refresh();return result;}
  catch(e){toast(e.message,true);return null;}
}
$('connectGmail').onclick=async ()=>{
  // Open a placeholder tab synchronously to avoid popup blockers.
  const popup=window.open('about:blank','_blank');
  const r=await action('/api/gmail/connect',{method:'POST'});
  if(r?.url){if(popup) popup.location.replace(r.url);else toast('Your browser blocked the Google sign-in tab.',true);}
  else if(popup) popup.close();
};
$('disconnectGmail').onclick=async()=>{
  if(!await showConfirm('Disconnect Gmail?','This removes Gmail authorization from this local app and turns email auto-reply OFF.'))return;
  const r=await action('/api/gmail/disconnect',{method:'POST'});if(r)toast('Gmail disconnected locally.');
};
$('retryWa').onclick=async()=>{const r=await action('/api/whatsapp/retry',{method:'POST'});if(r)toast(r.notice||'WhatsApp is restarting…')};
$('logoutWa').onclick=async()=>{
  if(!await showConfirm('Log out WhatsApp?','This disconnects the linked device from this app and stops WhatsApp auto-reply.'))return;
  const r=await action('/api/whatsapp/logout',{method:'POST'});if(r)toast(r.notice||'WhatsApp disconnected.');
};
for(const [id,channel] of [['toggleWa','wa'],['toggleGmail','gmail']]){
  $(id).onclick=async()=>{
    if(!snapshot)return;
    const currently=channel==='wa'?!!snapshot.wa.autoReply:!!snapshot.gmail.autoReply;
    const enabled=!currently;
    if(enabled && !await showConfirm('Enable real automatic replies?',`This will send REAL AI-generated ${channel==='wa'?'WhatsApp messages':'Gmail replies'} to new eligible customer messages. Confirm the business.txt facts are correct. API usage may incur charges.`))return;
    const r=await action('/api/toggle',{method:'POST',body:{channel,enabled}});
    if(r)toast(`${channel==='wa'?'WhatsApp':'Gmail'} automatic replies ${enabled?'ON':'OFF'}.`);
  };
}
$('gmailCheckNow').onclick=async()=>{
  if(!snapshot?.gmail?.autoReply)return toast('Enable Gmail Auto Reply first.',true);
  if(!await showConfirm('Check Gmail inbox now?','This will SEND real AI replies to eligible new emails if your Gmail auto-reply is ON.'))return;
  const r=await action('/api/gmail/check-now',{method:'POST'});
  if(r)toast(r.message||'Gmail checked');
};

$$('[data-question]').forEach(btn=>btn.onclick=()=>{$('question').value=btn.dataset.question;$('question').focus()});
$('testAi').onclick=async()=>{
  if(!token)return toast('Unlock the dashboard first.',true);
  const question=$('question').value.trim();if(!question)return toast('Enter a customer question first.',true);
  const btn=$('testAi');btn.disabled=true;
  $('aiReply').textContent='Contacting your live AI provider…';
  $('copyReply').disabled=true;
  try {
    const r=await api('/api/ai/test',{method:'POST',body:{question}});
    $('aiReply').textContent=r.reply;$('copyReply').disabled=!r.reply;
  }catch(e){$('aiReply').textContent='ERROR: '+e.message;toast(e.message,true);}
  finally {btn.disabled=false;}
};
$('copyReply').onclick=async()=>{
  try{await navigator.clipboard.writeText($('aiReply').textContent);toast('Reply copied.');}
  catch{toast('Copy is unavailable in this browser.',true)}
};

async function loadProfile(force=false){
  if(dirty&&!force){const yes=await showConfirm('Discard unsaved changes?','Reloading business.txt will replace your unsaved editor changes.');if(!yes)return;}
  try{
    const r=await api('/api/business/profile');
    profileRaw=r.text;dirty=false;profileLoaded=true;$('businessText').value=r.text;
    $('businessText').disabled=false;$('saveProfile').disabled=false;$('downloadProfile').disabled=false;
    text('profileDirty','');text('businessSaveMessage','');
  }catch(e){toast('Business file: '+e.message,true);}
}
$('reloadProfile').onclick=()=>loadProfile(false);
$('businessText').oninput=()=>{
  dirty=$('businessText').value!==profileRaw;text('profileDirty',dirty?'· Unsaved changes':'');
};
$('saveProfile').onclick=async()=>{
  if(!profileLoaded)return;
  const txt=$('businessText').value;
  if(!dirty)return toast('No changes to save.');
  if(!await showConfirm('Save business.txt?','Your new facts will be used for future AI answers. Both auto-reply channels will turn OFF until you review and re-enable them.'))return;
  $('saveProfile').disabled=true;
  try {
    const r=await api('/api/business/profile',{method:'PUT',body:{text:txt}});
    profileRaw=txt.replace(/\r\n/g,'\n');dirty=false;text('profileDirty','');
    text('businessSaveMessage',r.notice||'Saved successfully');
    toast('business.txt saved. Auto-replies are now OFF for review.');await refresh();
  }catch(e){text('businessSaveMessage',e.message);toast(e.message,true);}
  finally{$('saveProfile').disabled=false;}
};
$('downloadProfile').onclick=()=>{
  const blob=new Blob([$('businessText').value],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='business.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),300);
};
if(token)refresh();
setInterval(()=>{if(token&&document.visibilityState==='visible')refresh()},6000);
