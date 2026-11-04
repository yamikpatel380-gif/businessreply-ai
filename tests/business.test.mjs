import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBusiness,makeBusinessPrompt} from '../lib/business.mjs';
const facts=`ACTIVE=YES
BUSINESS_NAME=Sunrise Photo Studio
BUSINESS_WEBSITE=https://example.org
We print photo albums.
An album costs 500 rupees.`;
test('disabled by default',()=>assert.equal(parseBusiness('BUSINESS_NAME=Some Shop').active,false));
test('activation requires real name',()=>assert.equal(parseBusiness('ACTIVE=YES\nBUSINESS_NAME=Your Business Name\nWe sell shoes.').active,false));
test('business can activate with facts',()=>assert.equal(parseBusiness(facts).active,true));
test('owner details feed specific question',()=>{
 const p=makeBusinessPrompt({business:parseBusiness(facts),channel:'WhatsApp',customerText:'How much is an album?'});
 assert.match(p,/Sunrise Photo Studio/);assert.match(p,/500 rupees/);assert.match(p,/Never invent a URL/);assert.match(p,/How much is an album/);
});
test('no invented website',()=>{
 const b=parseBusiness('ACTIVE=YES\nBUSINESS_NAME=Blue Store\nWe sell greeting cards.');
 assert.match(makeBusinessPrompt({business:b,channel:'email',customerText:'Where is website?'}),/Do not invent one/);
});
test('ignore owner false placeholder if inactive',()=>assert.throws(()=>makeBusinessPrompt({business:parseBusiness('ACTIVE=NO'),channel:'wa',customerText:'hi'})));

test('business FAQ question and answer are included in AI reply context',()=>{
 const content = 'ACTIVE=YES\nBUSINESS_NAME=Bright Studio\nABOUT:\nWe print photos.\nFAQ:\nQ: When are you open?\nA: Monday to Friday.';
 const b = parseBusiness(content);
 const prompt = makeBusinessPrompt({business:b,channel:'email',customerText:'When are you open?'});
 assert.match(prompt,/Q: When are you open\?/);
 assert.match(prompt,/A: Monday to Friday/);
});
