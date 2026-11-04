// This file checks dependencies only; it does not start a server or read secrets.
const names = ['dotenv', 'express', 'googleapis', 'qrcode', '@whiskeysockets/baileys'];
let failed = false;
for (const name of names) {
  try {
    await import(name);
    console.log('[OK] ' + name);
  } catch (err) {
    failed = true;
    console.error('[MISSING/BROKEN] ' + name + ': ' + String(err?.message || err).slice(0, 200));
  }
}
process.exitCode = failed ? 1 : 0;
