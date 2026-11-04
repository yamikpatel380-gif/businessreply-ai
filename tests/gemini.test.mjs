import test from 'node:test';
import assert from 'node:assert/strict';
import { createGeminiReply } from '../lib/gemini.mjs';
const makeResp = (status, data) => ({ok:status===200,status, json:async()=>data});
test('Gemini sends correct JSON and API header, not query key',async()=>{
  let url,opts;
  const client=createGeminiReply({apiKey:'testSECRET',model:'gemini-3.1-flash-lite',systemInstruction:'Support agent',fetchImpl:async(u,o)=>{url=u;opts=o;return makeResp(200,{candidates:[{content:{parts:[{text:'Hello there!'}]}}]})}});
  assert.equal(await client('Test question'),'Hello there!');
  assert.match(url,/models\/gemini-3\.1-flash-lite:generateContent/);
  assert.ok(!url.includes('testSECRET'));
  assert.equal(opts.headers['x-goog-api-key'],'testSECRET');
  const body=JSON.parse(opts.body);
  assert.equal(body.systemInstruction.parts[0].text,'Support agent');
  assert.equal(body.contents[0].parts[0].text,'Test question');
});
test('empty Gemini key stops the request',async()=>{
 const client=createGeminiReply({apiKey:'',fetchImpl:async()=>{throw new Error('must not call')}});
 await assert.rejects(()=>client('hi'),/GEMINI_API_KEY/);
});
test('quota 429 is described without leaking secrets',async()=>{
 const client=createGeminiReply({apiKey:'SECRET',fetchImpl:async()=>makeResp(429,{error:'bad'})});
 await assert.rejects(()=>client('hi'),e=>e.message.includes('quota')&&!e.message.includes('SECRET'));
});
test('bad Gemini key reports 403',async()=>{
 const client=createGeminiReply({apiKey:'SECRET',fetchImpl:async()=>makeResp(403,{})});
 await assert.rejects(()=>client('hi'),/access denied/);
});
test('empty candidate text handled',async()=>{
 const client=createGeminiReply({apiKey:'SECRET',fetchImpl:async()=>makeResp(200,{candidates:[]})});
 await assert.rejects(()=>client('hi'),/no text/);
});
