import test from 'node:test';
import assert from 'node:assert/strict';
import {whatsappFailure} from '../lib/wa-diagnostics.mjs';
test('Socket null gets a clear compatibility error',()=>{
  const x=whatsappFailure(new TypeError("Cannot read properties of null (reading 'Socket')"));
  assert.equal(x.kind,'web_internal');assert.match(x.explanation,/not compatible/);
});
test('Chrome issue gets browser diagnostic',()=>assert.equal(whatsappFailure('Failed to launch the browser').kind,'browser_missing'));
test('Unknown startup error stays unknown, not a fake success',()=>assert.equal(whatsappFailure('mystery').kind,'unknown'));
