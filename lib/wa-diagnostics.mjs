/** Classify a WhatsApp-Web startup failure without pretending a QR is ready. */
export function whatsappFailure(error) {
  const text = String(error?.message || error || 'Unknown WhatsApp startup error');
  if (/Cannot read properties of (?:null|undefined) \(reading [\'\"]Socket[\'\"]\)|WAWebSocketModel|Socket\.on/i.test(text)) {
    return { kind: 'web_internal', explanation: 'WhatsApp Web internals are not compatible with the installed whatsapp-web.js session. QR could not be created. Use Retry QR once; if it repeats, a maintained library update or the official WhatsApp Business Cloud API is needed.', raw: text.slice(0,200) };
  }
  if (/Could not find Chrome|Failed to launch the browser|executable.*not found|Browser was not found|ENOENT/i.test(text)) {
    return {kind:'browser_missing',explanation:'Chrome/Edge browser could not be launched. Check that Chrome is installed and that this Windows account can open it.',raw:text.slice(0,200)};
  }
  if (/Target closed|Session closed|Protocol error|Navigation failed/i.test(text)) {
    return {kind:'browser_closed',explanation:'The Chrome connection ended while WhatsApp Web was loading. Check the Chrome installation and retry manually.',raw:text.slice(0,200)};
  }
  return {kind:'unknown',explanation:'WhatsApp could not start. Check the CMD log for the detailed error. No WhatsApp messages were sent.',raw:text.slice(0,200)};
}
