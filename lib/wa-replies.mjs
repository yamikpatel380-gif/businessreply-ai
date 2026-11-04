// Reply processor: no raw customer text or identifiers are written to diagnostic logs.
// Sessions and automatic-reply settings are owned by server.mjs.
export function redactCustomerSecrets(value) {
  return String(value || '')
    .replace(/\b(OTP|verification code|UPI PIN|PIN)\s*(?:is|=|:|-)?\s*(\d{4,8})\b/gi,
      (_match,label)=>`${label}: [REDACTED]`)
    .replace(/\b(password|API key)\s*(?:is|=|:|-)\s*(\S{4,})/gi,
      (_match,label)=>`${label}: [REDACTED]`)
    .slice(0,3500);
}
export function createWhatsAppReplyHandler({ getEligibility, askAI, onDiagnostic = () => {}, now = () => Date.now() }) {
  const seen = new Map();
  const inFlight = new Set();
  const lastReply = new Map();
  const tell = (stage, detail) => onDiagnostic({stage,detail});
  return async ({id,from,text,sendReply}) => {
    if (!id || !from || typeof text !== 'string' || !text.trim() || typeof sendReply !== 'function') {
      tell('skipped','Invalid incoming text message'); return;
    }
    tell('received','Private text message received');
    const permission = getEligibility();
    if (!permission.enabled) { tell('skipped','Auto Reply is OFF. Click OFF — Enable on the dashboard.'); return; }
    if (!permission.connected) { tell('skipped','WhatsApp not CONNECTED right now'); return; }
    const stamp=now();
    const key=from+'\u0000'+id;
    if (seen.has(key)) { tell('skipped','Duplicate incoming message'); return; }
    if(inFlight.has(from)) { tell('skipped','A previous reply to this chat is still running; send a new test message afterward'); return; }
    if(stamp-(lastReply.get(from)||0)<2500) { tell('skipped','Rapid messages: 2.5-second safety cooldown'); return; }
    seen.set(key,stamp);inFlight.add(from);
    for(const [k,t] of seen) if(stamp-t>60*60*1000)seen.delete(k);
    if(seen.size>1500){const keys=[...seen.keys()];for(const k of keys.slice(0,seen.size-1000))seen.delete(k);}
    try {
      tell('processing','AI provider is generating a reply');
      const answer = await askAI('WhatsApp',redactCustomerSecrets(text));
      if(typeof answer!=='string' || !answer.trim()) throw new Error('AI returned an empty reply');
      // Re-check the switch before sending, so switching OFF during a slow API call is honored.
      if(!getEligibility().enabled || !getEligibility().connected) {tell('skipped','Auto Reply was turned OFF or WhatsApp disconnected before sending');return;}
      await sendReply(answer);
      lastReply.set(from,now());
      tell('sent','WhatsApp AI reply sent');
    } catch (error) {
      seen.delete(key);
      const message=String(error?.message||error).replace(/AIza[0-9A-Za-z_-]{20,}/g,'[REDACTED_KEY]').slice(0,170);
      tell('failed',message);
    } finally { inFlight.delete(from); }
  };
}
