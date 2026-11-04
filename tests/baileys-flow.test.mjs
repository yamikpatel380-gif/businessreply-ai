import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createWhatsAppConnector } from '../lib/whatsapp-baileys.mjs';

function mockedConnector() {
  const events=[];
  const sockEvents = new EventEmitter();
  const sent=[];
  const fakeSocket = {
    user:{id:'9999999999:2@s.whatsapp.net'},
    ev:sockEvents,
    sendMessage:async(...args)=>{sent.push(args);return {ok:true}},
    end:()=>{}, ws:{close:()=>{}}, logout:async()=>{}
  };
  const lib={
    default:()=>fakeSocket,
    useMultiFileAuthState:async()=>({state:{creds:{}},saveCreds:()=>{}}),
    DisconnectReason:{loggedOut:401,restartRequired:515}
  };
  let allow=true;
  const agent=createWhatsAppConnector({authDir:'test',loadLibrary:async()=>lib,encodeQR:async(qr)=>'data:image/png;base64,TEST',onStatus:s=>events.push(s),onMessage:async m=>{if(allow)await m.sendReply('Customer reply');}});
  return {agent,events,sockEvents,sent};
}

test('connection QR event produces scannable data URI and then connected',async()=>{
  const t=mockedConnector();await t.agent.start();
  t.sockEvents.emit('connection.update',{qr:'testqrdata'});
  await new Promise(r=>setTimeout(r,40));
  assert.ok(t.events.some(x=>x.status==='qr_ready' && x.qr.startsWith('data:image/png;base64,')));
  t.sockEvents.emit('connection.update',{connection:'open'});
  assert.ok(t.events.some(x=>x.status==='connected'));
  await t.agent.stop();
});

test('incoming private text routes reply, groups and self messages excluded',async()=>{
 const t=mockedConnector();await t.agent.start();
 const m=(remoteJid,fromMe=false)=>({key:{id:'msg'+remoteJid,remoteJid,fromMe},message:{conversation:'hello'}});
 t.sockEvents.emit('messages.upsert',{type:'append',messages:[m('123@s.whatsapp.net')]});
 t.sockEvents.emit('messages.upsert',{type:'notify',messages:[m('123@g.us'),m('123@s.whatsapp.net',true),m('123@s.whatsapp.net'),m('123@lid')]});
 await new Promise(r=>setTimeout(r,50));
 assert.equal(t.sent.length,2);
 assert.ok(t.sent.every(([jid])=>jid==='123@s.whatsapp.net'||jid==='123@lid'));
 await t.agent.stop();
});
