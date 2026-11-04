import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {listenOnAvailablePort,makeLocalLaunchUrl} from '../lib/startup.mjs';
test('auto moves to next free port without killing older server',async()=>{
 const old=net.createServer(); await new Promise(resolve=>old.listen(0,'127.0.0.1',resolve));
 const busy=old.address().port;
 const fakeApp={listen:(port,host)=>{ const s=net.createServer();s.listen(port,host);return s; }};
 let fresh;
 try {
   fresh=await listenOnAvailablePort(fakeApp,busy,3);
   assert.notEqual(fresh.port,busy);
   assert.equal(old.listening,true);
 } finally { if(fresh)await new Promise(resolve=>fresh.server.close(resolve));await new Promise(resolve=>old.close(resolve)); }
});
test('launch URL uses fragment, not query params, and does not expose token to server',()=>{
 const token='a'.repeat(36);
 const url=new URL(makeLocalLaunchUrl(5057,token));
 assert.equal(url.origin,'http://127.0.0.1:5057');
 assert.equal(url.search,'');
 assert.equal(url.hash,`#admin=${token}`);
});
