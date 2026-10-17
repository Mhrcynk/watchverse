import { sanitize } from './state-validation';
import type { State } from './types';
export const BACKUP_PREFIX = 'WATCHVERSE:';
// UTF-8 güvenli base64 (Türkçe karakterler için)
// TextEncoder/TextDecoder her JavaScript motorunda bulunmadığı için elle UTF-8
function utf8Encode(str: string): number[] {
  const out: number[] = [];
  for (const ch of str) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}
function utf8Decode(b: number[]): string {
  let s = '';
  for (let i = 0; i < b.length; ) {
    const x = b[i++];
    let c: number;
    if (x < 0x80) c = x;
    else if (x < 0xe0) c = ((x & 31) << 6) | (b[i++] & 63);
    else if (x < 0xf0) c = ((x & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else c = ((x & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    s += String.fromCodePoint(c);
  }
  return s;
}
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function toBase64(str: string) {
  const bytes = utf8Encode(str);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=');
  }
  return out;
}
export function fromBase64(b64: string) {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12) | ((B64.indexOf(clean[i + 2]) & 63) << 6) | (B64.indexOf(clean[i + 3]) & 63);
    bytes.push((n >> 16) & 255);
    if (clean[i + 2] !== undefined && B64.indexOf(clean[i + 2]) >= 0) bytes.push((n >> 8) & 255);
    if (clean[i + 3] !== undefined && B64.indexOf(clean[i + 3]) >= 0) bytes.push(n & 255);
  }
  return utf8Decode(bytes);
}
export const __b64 = { toBase64, fromBase64 };

export function decodeBackup(code: string): { state: State; createdAt: number | null } {
  if (code.length > 12_000_000) throw new Error('Yedek çok büyük.');
  const raw = JSON.parse(fromBase64(code.trim().replace(/^WATCHVERSE:/, '')));
  if (!raw || raw.v !== 2 || !raw.watched || !raw.episodes || !Array.isArray(raw.list)) throw new Error('Geçerli bir WatchVerse yedeği değil.');
  return {state:sanitize(raw),createdAt:typeof raw.backupCreatedAt==='number' && Number.isFinite(raw.backupCreatedAt) ? raw.backupCreatedAt : null};
}
export function backupSummary(code:string) {
  const {state:s,createdAt}=decodeBackup(code);
  const titles=new Set([...s.list,...Object.keys(s.lib),...Object.keys(s.watched),...Object.keys(s.episodeMarks || {})]);
  return {titles:titles.size,episodes:Object.values(s.episodeMarks || {}).reduce((n,ids)=>n+ids.length,0),unresolved:Object.values(s.unresolvedEpisodes || {}).reduce((n,ids)=>n+ids.length,0),lists:Object.keys(s.lists).length,createdAt};
}
