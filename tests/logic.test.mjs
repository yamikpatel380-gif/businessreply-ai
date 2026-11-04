import test from 'node:test'; import assert from 'node:assert/strict';
import {safeEmail,extractAddress,sanitizeSubject,stripQuotedText,shouldHandleEmail,shouldHandleWhatsApp,makeMimeReply,decodeMessageBody} from '../lib/logic.mjs';
test('email validation',()=>{assert.equal(safeEmail('person@example.com'),true);assert.equal(safeEmail('a\nb@example.com'),false)});
test('from extraction',()=>{assert.equal(extractAddress('John <john@example.com>'),'john@example.com')});
test('subject strips injection',()=>{assert.equal(sanitizeSubject('Hello\r\nBcc:secret'),'Hello Bcc:secret')});
test('old message quoted text removed',()=>{assert.equal(stripQuotedText('Hello\nOn Tue Someone wrote:\nOld'),'Hello')});
test('email filters bots',()=>{assert.equal(shouldHandleEmail({from:'no-reply@example.com',toSelf:'x@example.com',text:'hi'}),false)});
test('email accepts real question',()=>{assert.equal(shouldHandleEmail({from:'client@example.com',toSelf:'help@example.com',text:'help'}),true)});
test('whatsapp excludes groups/status',()=>{assert.equal(shouldHandleWhatsApp({from:'x@g.us',body:'Hi',type:'chat'}),false)});
test('whatsapp excludes outbound',()=>{assert.equal(shouldHandleWhatsApp({from:'1@c.us',fromMe:true,body:'Hi',type:'chat'}),false)});
test('whatsapp accepts incoming direct text',()=>{assert.equal(shouldHandleWhatsApp({from:'1@c.us',body:'Hi',type:'chat'}),true)});
test('gmail reply MIME threading',()=>{const mime=Buffer.from(makeMimeReply({to:'customer@example.com',from:'support@example.com',subject:'Help',body:'નમસ્તે',messageId:'<id@example.com>'}),'base64url').toString();assert.ok(mime.includes('In-Reply-To: <id@example.com>')); assert.ok(mime.includes('Subject: Re: Help'))});
test('decode base64url',()=>{assert.equal(decodeMessageBody({mimeType:'text/plain',body:{data:Buffer.from('hello').toString('base64url')}}),'hello')});

test('new WhatsApp LID contact is eligible',()=>{assert.equal(shouldHandleWhatsApp({from:'123@lid',body:'Need help',type:'chat'}),true)});
