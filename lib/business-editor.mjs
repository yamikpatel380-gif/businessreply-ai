import { parseBusiness } from './business.mjs';

/** Validate a user-owned business.txt edit without enabling replies or sending messages. */
export function validateBusinessEdit(value) {
  if (typeof value !== 'string') throw new Error('Business profile must be plain text');
  if (!value.trim()) throw new Error('Business profile cannot be empty');
  if (Buffer.byteLength(value, 'utf8') > 12000) throw new Error('Business profile is too large (12 KB maximum)');
  if (value.includes('\0')) throw new Error('Business profile contains invalid characters');
  if (!/^\s*ACTIVE\s*=\s*(?:YES|NO)\s*$/mi.test(value)) throw new Error('Add ACTIVE=YES or ACTIVE=NO on its own line');
  if (!/^\s*BUSINESS_NAME\s*=\s*.+$/mi.test(value)) throw new Error('Add BUSINESS_NAME=Your real business name');
  const profile = parseBusiness(value);
  if (profile.requestedActive && !profile.active) throw new Error(profile.reason || 'Business information is incomplete');
  return { text: value.replace(/\r\n/g, '\n'), profile };
}
