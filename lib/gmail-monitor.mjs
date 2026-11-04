// Safety boundary: only Gmail Inbox messages delivered after the owner ENABLES
// automatic replies are eligible. Read/unread status does not change eligibility.
export function inboxQuery(sinceSeconds) {
  if (!Number.isSafeInteger(sinceSeconds) || sinceSeconds <= 0) throw new Error('Missing Gmail enable timestamp');
  return `in:inbox after:${sinceSeconds} -category:promotions -category:social`;
}
export function gmailMessageDecision({message,from,self,body,subject,shouldHandle}) {
  if (!message || !message.id) return 'missing_message';
  if (!message.labelIds?.includes('INBOX')) return 'not_in_inbox';
  const automate = Boolean(message.automated);
  if (automate) return 'automated_sender';
  if (!shouldHandle({from,toSelf:self,text:body,subject})) return 'unsupported_or_self_email';
  return 'eligible';
}
export function sanitizeCustomerEmail(value) {
  return String(value || '')
    .replace(/\b(OTP|verification code|UPI PIN|PIN)\s*(?:is|=|:|-)?\s*(\d{4,8})\b/gi,
      (_m,label)=>`${label}: [REDACTED]`)
    .replace(/\b(password|API key|access token)\s*(?:is|=|:|-)?\s*(\S{4,})/gi,
      (_m,label)=>`${label}: [REDACTED]`)
    .slice(0,2800);
}
export function safeGmailError(error) {
  return String(error?.response?.data?.error?.message || error?.message || error || 'Unknown Gmail error')
    .replace(/AIza[0-9A-Za-z_-]{20,}/g,'[REDACTED_KEY]')
    .replace(/ya29\.[A-Za-z0-9._-]+/g,'[REDACTED_TOKEN]')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'[EMAIL]')
    .slice(0,180);
}
