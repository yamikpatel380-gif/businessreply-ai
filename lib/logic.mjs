export function safeEmail(email) {
  return /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(email || '') && email.length <= 254;
}
export function extractAddress(header) {
  const match = String(header || '').match(/<([^<>]+)>/);
  return (match ? match[1] : String(header || '')).trim().replace(/^"|"$/g, '');
}
export function sanitizeSubject(str) {
  return String(str || '').replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').slice(0, 180).trim();
}
export function stripQuotedText(str) {
  return String(str || '')
    .split(/\n(?:On .+ wrote:|From: .+|-----Original Message-----|>)/i)[0]
    .replace(/\r/g, '').trim().slice(0, 2800);
}
export function shouldHandleEmail({from, toSelf, text, subject}) {
  const address = extractAddress(from).toLowerCase();
  if (!safeEmail(address) || address === String(toSelf || '').toLowerCase()) return false;
  if (/(?:^|[.-])(no-?reply|mailer-daemon|postmaster)(?:@|[.-])/.test(address)) return false;
  if (/out of office|automatic reply|auto reply|delivery failure|undeliverable/i.test(subject || '')) return false;
  return Boolean(String(text || '').trim());
}
export function shouldHandleWhatsApp(msg) {
  return Boolean(msg && !msg.fromMe && msg.type === 'chat' && typeof msg.body === 'string' && msg.body.trim() &&
    /@(?:c\.us|lid)$/.test(msg.from || '') && !/@g\.us$/.test(msg.from || '') && !/status@broadcast/.test(msg.from || ''));
}
export function makeMimeReply({to, from, subject, body, messageId, references}) {
  if (!safeEmail(to) || !safeEmail(from)) throw new Error('Email address invalid');
  const normalizedSubject = /^(Re|Aw|Sv):/i.test(subject) ? subject : `Re: ${subject || 'Your support request'}`;
  const cleanMessageId = String(messageId || '').replace(/[\r\n]/g,'').trim();
  const cleanRefs = String(references || '').replace(/[\r\n]/g,'').trim();
  const headers = [
    `From: <${from}>`, `To: <${to}>`, `Subject: ${sanitizeSubject(normalizedSubject)}`,
    'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64'
  ];
  if (cleanMessageId) headers.push(`In-Reply-To: ${cleanMessageId}`);
  if (cleanRefs || cleanMessageId) headers.push(`References: ${cleanRefs || cleanMessageId}`);
  return Buffer.from(headers.join('\r\n') + '\r\n\r\n' + Buffer.from(body, 'utf8').toString('base64'))
    .toString('base64url');
}
export function decodeMessageBody(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf8').slice(0,6000);
  }
  for (const p of (payload.parts || [])) {
    const value = decodeMessageBody(p);
    if (value) return value;
  }
  if (payload.body?.data && payload.mimeType !== 'text/html') {
    return Buffer.from(payload.body.data, 'base64url').toString('utf8').slice(0,6000);
  }
  return '';
}
// Deprecated compatibility helper; business-aware prompt lives in lib/business.mjs.
export function customerPrompt(channel, sender, question, knowledge) {
  return `Channel: ${channel}\nCustomer question: ${String(question).slice(0,3500)}\nBusiness reference: ${String(knowledge).slice(0,7000)}`;
}
