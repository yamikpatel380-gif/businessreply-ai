import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { listenOnAvailablePort, makeLocalLaunchUrl } from './lib/startup.mjs';
import express from 'express';
import { createWhatsAppConnector } from './lib/whatsapp-baileys.mjs';
import { createWhatsAppReplyHandler } from './lib/wa-replies.mjs';
import { google } from 'googleapis';
import {inboxQuery,gmailMessageDecision,sanitizeCustomerEmail,safeGmailError} from './lib/gmail-monitor.mjs';
import { createProvider } from './lib/ai.mjs';
import { loadBusiness, makeBusinessPrompt } from './lib/business.mjs';
import { validateBusinessEdit } from './lib/business-editor.mjs';
import {
  extractAddress, shouldHandleEmail, shouldHandleWhatsApp, makeMimeReply,
  stripQuotedText, decodeMessageBody
} from './lib/logic.mjs';

const base = process.cwd();
let PORT = Number(process.env.PORT || 5055);
if (!Number.isInteger(PORT) || PORT < 1025 || PORT > 65535) throw new Error('Invalid local PORT');
const app = express();
app.disable('x-powered-by');
// Reject other hostnames so this loopback-only dashboard cannot be used by DNS rebinding.
app.use((req, res, next) => {
  const host = req.headers.host || '';
  if (!/^(?:127\.0\.0\.1|localhost):\d{2,5}$/i.test(host)) return res.status(403).end('Local access only');
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    const origin = req.get('origin');
    if (origin && origin !== `http://${host}`) return res.status(403).json({error:'Cross-origin requests are not allowed'});
  }
  next();
});
app.use(express.json({ limit: '24kb' }));
app.use(express.static(path.join(base,'public'), { etag: false, maxAge: 0 }));
const filepath = f => path.join(base, f);
const readJSON = (name, fallback) => { try { return JSON.parse(fs.readFileSync(filepath(name),'utf8')); } catch { return fallback; } };
const savePrivate = (name,data) => {
  const dest = filepath(name), temp = dest + '.tmp';
  fs.writeFileSync(temp, typeof data === 'string' ? data : JSON.stringify(data,null,2), { mode:0o600 });
  fs.renameSync(temp,dest);
};
const adminToken = fs.existsSync(filepath('.local_admin_token'))
 ? fs.readFileSync(filepath('.local_admin_token'),'utf8').trim()
 : crypto.randomBytes(18).toString('hex');
if (!fs.existsSync(filepath('.local_admin_token'))) savePrivate('.local_admin_token',adminToken);
const defaultState = { autoWa:false, autoGmail:false, gmailSince:0, processedGmail:[], events:[] };
const persisted = readJSON('.local_state.json',defaultState);
const state = {...defaultState, ...persisted, autoWa:false, autoGmail:false};
// Every process restart requires deliberate re-enabling; never send automatically on boot.
state.processedGmail = Array.isArray(state.processedGmail) ? state.processedGmail.slice(-2000) : [];
const events = Array.isArray(state.events) ? state.events.slice(-30) : [];
const saveState = () => savePrivate('.local_state.json',{...state,events:events.slice(-30)});
const logEvent = (kind,detail) => { events.unshift({at:new Date().toISOString(),kind,detail}); events.splice(40); saveState(); console.log(`[${kind}] ${detail}`); };

const ai = createProvider(process.env);
function getBusiness() {
  const profile = loadBusiness(base); // Owner's edits take effect on the next request.
  // Fail closed: deactivation turns both send switches OFF, including if file is later reactivated.
  if (!profile.active && (state.autoWa || state.autoGmail)) {
    state.autoWa = false; state.autoGmail = false;
    saveState();
    logEvent('settings','Business profile inactive; automatic replies disabled');
  }
  return profile;
}
const replyAI = async (channel, question) => {
  const business = getBusiness();
  if (!business.active) throw new Error('Business is not active: ' + business.reason);
  if (!ai.ready) throw new Error('AI provider is not configured');
  return ai.ask(makeBusinessPrompt({business, channel, customerText: question}));
};

const auth = (req,res,next) => {
  const token = req.get('X-Admin-Token') || '';
  const correct = Buffer.from(adminToken), submitted = Buffer.from(token);
  if (submitted.length !== correct.length || !crypto.timingSafeEqual(submitted,correct)) return res.status(401).json({error:'Invalid admin code'});
  next();
};

let wa = null;
let waStatus='starting', waQR=null, waAccount=null, waError=null, waErrorKind=null;
let waStarting=false;
const waCounters = {received:0,skipped:0,processing:0,failed:0,sent:0};
const waActivity=[];
function recordWaEvent({stage,detail}) {
  if (Object.hasOwn(waCounters,stage)) waCounters[stage]++;
  const safe=String(detail||'').replace(/AIza[0-9A-Za-z_-]{20,}/g,'[REDACTED_KEY]').replace(/\b\d{8,15}@(s\.whatsapp\.net|lid)\b/gi,'[REDACTED_CHAT]').slice(0,180);
  waActivity.unshift({at:new Date().toISOString(),stage,detail:safe});
  waActivity.splice(8);
  // Never log message bodies, full WhatsApp phone numbers, message IDs, or tokens.
  console.log(`[wa-reply] ${stage}: ${safe}`);
}
const handleWaMessage = createWhatsAppReplyHandler({
  getEligibility:()=>({enabled:state.autoWa && getBusiness().active,connected:waStatus==='connected'}),
  askAI:replyAI,
  onDiagnostic:recordWaEvent
});
function getWaStatus() {return {status:waStatus,qr:waQR,account:waAccount,error:waError,errorKind:waErrorKind,autoReply:state.autoWa,retrying:waStarting,counters:waCounters,activity:waActivity};}
async function initWhatsApp() {
  if (waStarting) return;
  waStarting=true;waStatus='starting';waQR=null;waError=null;waErrorKind=null;
  try {
    wa=createWhatsAppConnector({
      authDir:filepath('.baileys_auth'),
      onStatus(s) {
        if(s.status) waStatus=s.status;
        if(s.qr!==undefined) waQR=s.qr;
        if(s.account!==undefined) waAccount=s.account;
        if(s.error!==undefined) waError=s.error;
        if(s.kind!==undefined) waErrorKind=s.kind;
        if(s.status==='connected') logEvent('whatsapp','Baileys WhatsApp connection established');
        if(['disconnected','logged_out','error'].includes(s.status)) { state.autoWa=false;saveState(); }
      },
      onMessage:handleWaMessage,
      onDiagnostic:recordWaEvent
    });
    await wa.start();
  }catch(e){
    waStatus='error';waQR=null;waError='WhatsApp startup failed: '+String(e.message).slice(0,200);waErrorKind='baileys_error';
    state.autoWa=false;saveState();console.error('WhatsApp connector startup:',e);
  }finally {waStarting=false;}
}
async function retryWhatsApp() {
  if(waStarting) return false;
  state.autoWa=false;saveState();waStarting=true;
  waStatus='restarting';waQR=null;waError=null;waErrorKind=null;
  const old=wa;wa=null;
  if(old) await old.stop();
  waStarting=false;
  await initWhatsApp();
  return true;
}

let gmailConnected=false, gmailAddress='', gmailError='', oauthState=null;
const credentialFile=filepath('credentials.json');
const tokenFile=filepath('.gmail_token.json');
function getGmailOAuth() {
  if(!fs.existsSync(credentialFile)) return null;
  const data=readJSON('credentials.json',{});
  const c=data.installed || data.web;
  if (!c?.client_id || !c?.client_secret) return null;
  return new google.auth.OAuth2(c.client_id,c.client_secret,`http://127.0.0.1:${PORT}/oauth/callback`);
}
function authClient() {
  const oauth=getGmailOAuth();
  if (!oauth) return null;
  const stored=readJSON('.gmail_token.json',null);
  if (!stored) return null;
  oauth.setCredentials(stored);
  return oauth;
}
const GMAIL_SCOPES=['https://www.googleapis.com/auth/gmail.readonly','https://www.googleapis.com/auth/gmail.send'];
async function validateGmail() {
  const client=authClient();
  if(!client){ gmailConnected=false;gmailAddress='';return false; }
  try {
    const info=await google.gmail({version:'v1',auth:client}).users.getProfile({userId:'me'});
    gmailAddress=info.data.emailAddress||'';gmailConnected=true;gmailError='';return true;
  } catch(e){ gmailConnected=false;gmailError=String(e.message).slice(0,200);return false; }
}
app.get('/oauth/callback',async (req,res)=>{
  if (!oauthState || req.query.state !== oauthState || Date.now()-Number(oauthStateAt)>600000) return res.status(403).send('Invalid or expired login. Restart Gmail Connect from the local dashboard.');
  oauthState=null;
  if (!req.query.code) return res.status(400).send('Google sign-in was cancelled.');
  try {
    const oauth=getGmailOAuth();
    const {tokens}=await oauth.getToken(String(req.query.code));
    const prev=readJSON('.gmail_token.json',{});
    savePrivate('.gmail_token.json',{...prev,...tokens, refresh_token:tokens.refresh_token||prev.refresh_token});
    if (!await validateGmail()) throw new Error('Google connected but Gmail API access failed: '+gmailError);
    state.autoGmail=false;state.gmailSince=Math.floor(Date.now()/1000);saveState();
    logEvent('gmail','Gmail OAuth connected');
    res.send('<meta charset="utf-8"><body style="font:20px Arial;background:#07150e;color:#baffcc;padding:40px"><h2>Gmail connected</h2><p>Return to the local BusinessReply AI tab and enable Email Auto Reply when ready.</p></body>');
  } catch(e){gmailError=String(e.message).slice(0,200);res.status(500).send('Gmail login failed: '+gmailError);}
});
let oauthStateAt=0;
app.post('/api/gmail/connect',auth,(req,res)=>{
  const oauth=getGmailOAuth();
  if(!oauth) return res.status(400).json({error:'Place Google Cloud OAuth Desktop application credentials.json in the project folder first. Enable the Gmail API.'});
  oauthState=crypto.randomBytes(22).toString('hex');oauthStateAt=Date.now();
  const url=oauth.generateAuthUrl({access_type:'offline',prompt:'consent',scope:GMAIL_SCOPES,state:oauthState});
  res.json({url});
});

// GMAIL_V7_4_MONITOR: New mail even when opened/read; diagnostics and manual check.
let pollBusy=false;
const gmailDiagnostics = {lastChecked:null,lastResult:'Not checked yet',found:0,eligible:0,sent:0,skipped:0,error:null};
function setGmailDiagnostic(detail) { gmailDiagnostics.lastResult=detail; }
async function pollGmail() {
  if (pollBusy) return {ok:false,info:'Gmail check already running'};
  if (!state.autoGmail) { setGmailDiagnostic('Auto Reply OFF — no email is being sent');return {ok:false,info:gmailDiagnostics.lastResult}; }
  if (!gmailConnected) { setGmailDiagnostic('Gmail not connected');return {ok:false,info:gmailDiagnostics.lastResult}; }
  if (!ai.ready) { setGmailDiagnostic('AI provider is not configured');return {ok:false,info:gmailDiagnostics.lastResult}; }
  if (!getBusiness().active) {setGmailDiagnostic('business.txt is inactive');return {ok:false,info:gmailDiagnostics.lastResult};}
  pollBusy=true;
  Object.assign(gmailDiagnostics,{lastChecked:new Date().toISOString(),found:0,eligible:0,sent:0,skipped:0,error:null,lastResult:'Checking Gmail inbox'});
  try {
    const client=authClient(); if(!client) throw new Error('Gmail OAuth disconnected');
    const gmail=google.gmail({version:'v1',auth:client});
    const query=inboxQuery(state.gmailSince);
    const ids=await gmail.users.messages.list({userId:'me',q:query,maxResults:30});
    const rows=(ids.data.messages||[]).reverse();
    gmailDiagnostics.found=rows.length;
    const processed=new Set(state.processedGmail);
    for (const row of rows) {
      if(gmailDiagnostics.sent>=4) break;
      if(!state.autoGmail) {setGmailDiagnostic('Auto Reply turned OFF before send');break;}
      if(processed.has(row.id)){gmailDiagnostics.skipped++;continue;}
      const entry=await gmail.users.messages.get({userId:'me',id:row.id,format:'full'});
      // Defense in depth: Gmail query is time-filtered, but check received time again.
      const receivedMs=Number(entry.data.internalDate);
      if(!Number.isFinite(receivedMs)||receivedMs < state.gmailSince*1000){gmailDiagnostics.skipped++;continue;}
      const hdr=Object.fromEntries((entry.data.payload?.headers||[]).map(h=>[String(h.name).toLowerCase(),String(h.value)]));
      const from=extractAddress(hdr.from||'');
      const body=stripQuotedText(decodeMessageBody(entry.data.payload));
      const subject=String(hdr.subject||'');
      const automated=Boolean(hdr['auto-submitted']&&hdr['auto-submitted'].toLowerCase()!=='no') || /bulk|list|junk/i.test(hdr.precedence||'') || Boolean(hdr['list-unsubscribe']);
      const decision=gmailMessageDecision({message:{...entry.data,automated},from,self:gmailAddress,body,subject,shouldHandle:shouldHandleEmail});
      if(decision!=='eligible'){
        gmailDiagnostics.skipped++;
        // Ineligible mail is remembered, so every poll does not re-process it.
        state.processedGmail.push(row.id);processed.add(row.id);state.processedGmail=state.processedGmail.slice(-2000);saveState();
        continue;
      }
      gmailDiagnostics.eligible++;
      const question=`Subject: ${subject}\nBody: ${sanitizeCustomerEmail(body)}`;
      const answer=await replyAI('email',question);
      if(!answer||!String(answer).trim()) throw new Error('AI provider returned an empty email reply');
      if(!state.autoGmail || !gmailConnected || !getBusiness().active) {setGmailDiagnostic('Auto Reply disabled, Gmail disconnected, or business.txt inactive before send');break;}
      const raw=makeMimeReply({to:from,from:gmailAddress,subject,body:`${answer}\n\n— BusinessReply AI (automated assistant)`,messageId:hdr['message-id'],references:hdr.references});
      await gmail.users.messages.send({userId:'me',requestBody:{raw,threadId:entry.data.threadId}});
      state.processedGmail.push(row.id);processed.add(row.id);state.processedGmail=state.processedGmail.slice(-2000);saveState();
      gmailDiagnostics.sent++;
      logEvent('gmail','AI email reply sent (no message content saved)');
    }
    setGmailDiagnostic(`Checked ${gmailDiagnostics.found} recent inbox message(s), sent ${gmailDiagnostics.sent}, skipped ${gmailDiagnostics.skipped}. Only mail received after Auto Reply was enabled is eligible.`);
    return {ok:true,info:gmailDiagnostics.lastResult};
  } catch(e){
    const reason=safeGmailError(e);
    gmailDiagnostics.error=reason;setGmailDiagnostic('Gmail check failed: '+reason);
    logEvent('error','Gmail automatic reply failed: '+reason);
    if (/invalid_grant|unauthorized|insufficient authentication/i.test(reason)) {gmailConnected=false;state.autoGmail=false;saveState();}
    return {ok:false,info:gmailDiagnostics.lastResult};
  } finally { pollBusy=false; }
}


// Private profile editor: changes the owner's existing business.txt, not the AI keys.
app.get('/api/business/profile',auth,(req,res)=>{
  try {
    const content=fs.readFileSync(filepath('business.txt'),'utf8');
    const p=getBusiness();
    res.json({text:content,active:p.active,name:p.name,reason:p.reason});
  } catch {res.status(500).json({error:'Could not read business.txt'});}
});
app.put('/api/business/profile',auth,(req,res)=>{
  try {
    const {text,profile}=validateBusinessEdit(req.body?.text);
    // Fail safely: every profile change requires deliberate auto-reply reactivation.
    state.autoWa=false;state.autoGmail=false;saveState();
    savePrivate('business.txt', text);
    logEvent('business','Business profile saved; auto-replies reset OFF for review');
    res.json({ok:true,active:profile.active,name:profile.name,reason:profile.reason,notice:'Saved. Auto-replies remain OFF until you enable them again.'});
  }catch(e){res.status(400).json({error:String(e.message).slice(0,220)});}
});
app.get('/api/health',(req,res)=>res.json({ok:true,app:'BusinessReply AI',port:PORT}));
app.get('/api/status',auth,(req,res)=>res.json({
  server:{name:'BusinessReply AI',port:PORT},
  wa:getWaStatus(),
  gmail:{connected:gmailConnected,address:gmailAddress,error:gmailError,credentialsPresent:!!getGmailOAuth(),autoReply:state.autoGmail,diagnostics:gmailDiagnostics},
  ai:{connected:ai.ready,provider:ai.provider,model:ai.model},business:(()=>{const b=getBusiness();return {active:b.active,name:b.name,website:b.website,reason:b.reason};})(),events:events.slice(0,12),localOnly:true,
  note:'QR WhatsApp connection uses unofficial Baileys; subject to WhatsApp terms and possible account restrictions.'
}));
app.post('/api/toggle',auth,(req,res)=>{
  const {channel,enabled}=req.body||{};
  if(!['wa','gmail'].includes(channel) || typeof enabled!=='boolean') return res.status(400).json({error:'Invalid channel/setting'});
  if(enabled && !ai.ready) return res.status(400).json({error:'Configure an AI provider in .env and restart the app'});
  if(enabled && !getBusiness().active) return res.status(400).json({error:'Edit business.txt and set ACTIVE=YES first: '+getBusiness().reason});
  if(channel==='wa') {
    if(enabled && waStatus!=='connected') return res.status(400).json({error:'Scan WhatsApp QR and wait for Connected first'});
    state.autoWa=enabled;
  } else {
    if(enabled && !gmailConnected) return res.status(400).json({error:'Connect Gmail via Google sign-in first'});
    state.autoGmail=enabled;
    if(enabled) state.gmailSince=Math.floor(Date.now()/1000); // no old mail auto-reply
  }
  saveState();logEvent('settings',`${channel} auto-reply ${enabled?'enabled':'disabled'} by local admin`);
  res.json({ok:true});
});
app.post('/api/ai/test',auth,async(req,res)=>{
  const question=String(req.body?.question||'').slice(0,1500);
  if(!question.trim()) return res.status(400).json({error:'Enter a question'});
  try{res.json({reply:await replyAI('local owner check',question),live:true});}
  catch(e){res.status(502).json({error:'Live AI failed: '+String(e.message).slice(0,250)});}
});
app.post('/api/gmail/check-now',auth,async(_req,res)=>{
  const result=await pollGmail();
  res.status(result.ok?200:409).json({ok:result.ok,message:result.info,diagnostics:gmailDiagnostics});
});
app.post('/api/gmail/disconnect',auth,(req,res)=>{
  state.autoGmail=false;gmailConnected=false;gmailAddress='';
  try{fs.unlinkSync(tokenFile)}catch{};saveState();logEvent('gmail','Disconnected Gmail locally');res.json({ok:true});
});
app.post('/api/whatsapp/retry',auth,(req,res)=>{
  if (waStarting || waStatus==='restarting') return res.status(409).json({error:'WhatsApp is already starting. Check status again.'});
  // Only the local owner can click Retry; no automatic loop or message sending.
  retryWhatsApp().catch(e=>{waStatus='error';waError=String(e.message).slice(0,200);waErrorKind='retry_error';console.error('WhatsApp retry:',e.message)});
  res.status(202).json({ok:true,notice:'WhatsApp connection is restarting. Linked-device session is preserved.'});
});
app.post('/api/whatsapp/logout',auth,async(req,res)=>{
  state.autoWa=false;saveState();
  try{if(!wa) throw new Error('Not connected');await wa.logout();waStatus='disconnected';waQR=null;res.json({ok:true,notice:'WhatsApp logged out. Use Retry QR to link again.'});}
  catch(e){res.status(500).json({error:'Logout failed: '+String(e.message).slice(0,150)});}
});
app.use('/api',(req,res)=>res.status(404).json({error:'Not found'}));
// If V2/V3 is still on 5055, move to the next free loopback port automatically.
// No other process is killed and no old project is modified.
const requestedPort = PORT;
try {
  const binding = await listenOnAvailablePort(app,requestedPort,25);
  PORT = binding.port;
  const launchUrl = makeLocalLaunchUrl(PORT, adminToken);
  console.log('\n==================================================');
  console.log(' BusinessReply AI');
  if (PORT !== requestedPort) console.log(` Port ${requestedPort} was busy; using ${PORT} instead.`);
  console.log(` DASHBOARD: http://127.0.0.1:${PORT}`);
  console.log(' LAUNCH LINK (paste into Chrome if it does not open):');
  console.log(' '+launchUrl);
  console.log(' Automatic launch link securely fills the admin code.');
  console.log(' Keep this window open. Never share the launch link.');
  console.log('==================================================\n');
  // The admin code stays in URL fragment (never sent to HTTP server).
  // Browser page removes it from address bar as soon as it is read.
  if (process.platform === 'win32' && process.env.NO_AUTO_BROWSER !== '1') {
    try {
      const child = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', launchUrl], {detached:true,stdio:'ignore',windowsHide:true});
      child.on('error',err => console.error('Could not auto-open browser: '+err.message));
      child.unref();
    } catch (e) {console.error('Could not auto-open browser: '+e.message);}
  }
  validateGmail().then(ok=>console.log('Gmail:',ok?'connected':'not connected')).catch(()=>{});
  initWhatsApp().catch(e=>{waStatus='error';waError=e.message;console.error('WhatsApp:',e.message)});
  setInterval(pollGmail,45000);
} catch (err) {
  console.error('SERVER START FAILED:', err.message);
  process.exitCode = 1;
}

