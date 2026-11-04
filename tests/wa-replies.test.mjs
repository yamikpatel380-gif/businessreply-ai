import test from 'node:test';
import assert from 'node:assert/strict';
import {createWhatsAppReplyHandler,redactCustomerSecrets} from '../lib/wa-replies.mjs';

const msg=(text,id='m1')=>({id,from:'123@s.whatsapp.net',text,sendReply:async()=>{}});

test('OTP help question is NOT silently ignored', async()=>{
 const logs=[]; const sent=[];
 const handler=createWhatsAppReplyHandler({getEligibility:()=>({enabled:true,connected:true}),askAI:async(_channel,q)=>{assert.match(q,/OTP not received/i);return 'Please check spam folder.';},onDiagnostic:e=>logs.push(e)});
 await handler({...msg('My OTP not received'),sendReply:async r=>sent.push(r)});
 assert.deepEqual(sent,['Please check spam folder.']);
 assert.equal(logs.at(-1).stage,'sent');
});

test('when Auto Reply OFF, no AI request or delivery; reason is visible', async()=>{
 const events=[];
 const handler=createWhatsAppReplyHandler({getEligibility:()=>({enabled:false,connected:true}),askAI:()=>{throw new Error('must not run')},onDiagnostic:e=>events.push(e)});
 await handler(msg('hello'));
 assert.ok(events.some(e=>e.stage==='skipped' && e.detail.includes('OFF')));
});

test('sensitive OTP code is masked before Gemini receives it', async()=>{
 let received='';
 const handler=createWhatsAppReplyHandler({getEligibility:()=>({enabled:true,connected:true}),askAI:async (_c,q)=>{received=q;return 'Please do not send codes.';}});
 await handler(msg('My OTP is 123456. Need help.'));
 assert.doesNotMatch(received,/123456/);
 assert.match(received,/\[REDACTED\]/);
});

test('AI errors become diagnostic instead of silent failure; retry stays possible', async()=>{
 const events=[]; let tries=0;
 const handler=createWhatsAppReplyHandler({getEligibility:()=>({enabled:true,connected:true}),askAI:async()=>{tries++;if(tries===1)throw new Error('Gemini HTTP 503');return 'OK'},onDiagnostic:e=>events.push(e)});
 await handler(msg('hello'));
 await handler(msg('hello'));
 assert.equal(tries,2);
 assert.ok(events.some(e=>e.stage==='failed' && e.detail.includes('503')));
 assert.ok(events.some(e=>e.stage==='sent'));
});

test('does not deliver AI reply after owner disables auto-reply mid-request',async()=>{
 let enabled=true,deliveries=0;
 const handler=createWhatsAppReplyHandler({getEligibility:()=>({enabled,connected:true}),askAI:async()=>{enabled=false;return 'ready'}});
 await handler({...msg('test'),sendReply:async()=>deliveries++});
 assert.equal(deliveries,0);
});

test('duplicate messages and rapid duplicates do not send multiple replies',async()=>{
 let deliveries=0,clock=10000;
 const handler=createWhatsAppReplyHandler({getEligibility:()=>({enabled:true,connected:true}),askAI:async()=> 'Reply',now:()=>clock});
 await handler({...msg('hello'),sendReply:async()=>deliveries++});
 await handler({...msg('hello'),sendReply:async()=>deliveries++});
 clock+=1500;
 await handler({...msg('next','m2'),sendReply:async()=>deliveries++});
 clock+=3000;
 await handler({...msg('later','m3'),sendReply:async()=>deliveries++});
 assert.equal(deliveries,2);
});

test('base message privacy masking',()=>{
 assert.equal(redactCustomerSecrets('OTP is 654321'),'OTP: [REDACTED]');
 assert.equal(redactCustomerSecrets('OTP not received'),'OTP not received');
});
