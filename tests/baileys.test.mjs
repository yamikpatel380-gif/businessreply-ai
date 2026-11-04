import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const s=readFileSync(new URL('../server.mjs',import.meta.url),'utf8');
const w=readFileSync(new URL('../lib/whatsapp-baileys.mjs',import.meta.url),'utf8');
const p=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
test('QR alternative removes Puppeteer Socket dependence',()=>{
 assert.ok(!s.includes('whatsapp-web.js'));
 assert.ok(!s.includes('puppeteer:'));
 assert.ok(!p.dependencies['whatsapp-web.js']);
 assert.ok(p.dependencies['@whiskeysockets/baileys']);
});
test('private text only and no auto reply by default',()=>{
 assert.ok(w.includes("type!=='notify'"));
 assert.ok(w.includes("'@s.whatsapp.net'"));
 assert.ok(s.includes('autoWa:false'));
});
test('Baileys saves auth state and handles QR events',()=>{
 assert.ok(w.includes('useMultiFileAuthState(authDir)'));
 assert.ok(w.includes("'creds.update'"));
 assert.ok(w.includes('update.qr'));
});
