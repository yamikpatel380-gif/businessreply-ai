import test from 'node:test';
import assert from 'node:assert/strict';
import { createGeminiReply } from '../lib/gemini.mjs';
const response=(status, body={})=>({ok:status===200,status,json:async()=>body});
test('503 twice then 200 returns the answer',async()=>{
 let n=0,sleeps=0;
 const c=createGeminiReply({apiKey:'FAKE',sleepImpl:async()=>{sleeps++},fetchImpl:async()=>{
   n++;return n<3?response(503):response(200,{candidates:[{content:{parts:[{text:'Working response'}]}}]});
 }});
 assert.equal(await c('Hi'),'Working response');assert.equal(n,3);assert.equal(sleeps,2);
});
test('persistent 503 stops after 3 attempts',async()=>{
 let n=0;
 const c=createGeminiReply({apiKey:'FAKE',sleepImpl:async()=>{},fetchImpl:async()=>{n++;return response(503)}});
 await assert.rejects(()=>c('Hi'),/503.*after 3 attempts/);assert.equal(n,3);
});
test('invalid key 403 does not retry',async()=>{
 let n=0;
 const c=createGeminiReply({apiKey:'FAKE',sleepImpl:async()=>{},fetchImpl:async()=>{n++;return response(403)}});
 await assert.rejects(()=>c('Hi'),/403/);assert.equal(n,1);
});
test('no API key never calls network',async()=>{
 const c=createGeminiReply({apiKey:'',fetchImpl:async()=>{throw Error('unexpected')}});
 await assert.rejects(()=>c('Hi'),/GEMINI_API_KEY/);
});
