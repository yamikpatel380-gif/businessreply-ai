import test from 'node:test';
import assert from 'node:assert/strict';
import {createProvider} from '../lib/ai.mjs';
test('defaults to Gemini without key, not ready',()=>{const p=createProvider({});assert.equal(p.ready,false);assert.equal(p.provider,'gemini')});
test('OpenAI needs API key',()=>{const p=createProvider({AI_PROVIDER:'openai'});assert.equal(p.ready,false);});
test('local-compatible accepts missing key',()=>{const p=createProvider({AI_PROVIDER:'openai-compatible'});assert.equal(p.ready,true)});
test('rejects remote plaintext API endpoints',()=>assert.throws(()=>createProvider({AI_PROVIDER:'openai-compatible',AI_BASE_URL:'http://public.example.com/v1'})));
test('compatible adapter uses selected model and returns text',async()=>{
 const request=[];
 const p=createProvider({AI_PROVIDER:'openai-compatible',AI_BASE_URL:'http://127.0.0.1:11434/v1',AI_MODEL:'llama3.2'},async(url,opts)=>{
   request.push({url,opts});return {ok:true,json:async()=>({choices:[{message:{content:'We open at 10 AM.'}}]})};
 });
 assert.equal(await p.ask('business profile and message'),'We open at 10 AM.');
 assert.equal(JSON.parse(request[0].opts.body).model,'llama3.2');
});
