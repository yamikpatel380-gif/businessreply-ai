import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBusinessEdit} from '../lib/business-editor.mjs';

test('inactive business profile can be saved safely',()=>{
  const r=validateBusinessEdit('ACTIVE=NO\nBUSINESS_NAME=Future Shop\nABOUT:\nWe sell goods.');
  assert.equal(r.profile.active,false);
});
test('real named business can be activated and FAQ passed through',()=>{
  const r=validateBusinessEdit('ACTIVE=YES\nBUSINESS_NAME=Bright Photo Studio\nABOUT:\nWe print photos.\nFAQ:\nQ: When open?\nA: Monday.');
  assert.equal(r.profile.active,true);
  assert.match(r.text,/Q: When open\?/);
});
test('cannot save active placeholder business',()=>assert.throws(()=>validateBusinessEdit('ACTIVE=YES\nBUSINESS_NAME=Your Business Name\nABOUT:\nWe sell goods'),/real BUSINESS_NAME/));
test('cannot save oversized content',()=>assert.throws(()=>validateBusinessEdit('ACTIVE=NO\nBUSINESS_NAME=Shop\n'+('X'.repeat(14000))),/large/));
test('requires explicit activation field',()=>assert.throws(()=>validateBusinessEdit('BUSINESS_NAME=Shop'),/ACTIVE/));
test('rejects invalid input type',()=>assert.throws(()=>validateBusinessEdit({foo:'bar'}),/plain text/));

test('cannot activate empty profile headings and comments',()=>assert.throws(()=>validateBusinessEdit('ACTIVE=YES\nBUSINESS_NAME=Bright Studio\nABOUT:\n# Put your description here.\nFAQ:'),/Describe your services/));
