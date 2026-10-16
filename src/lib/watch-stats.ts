import { TBY } from './catalog';
import type { State } from './types';
/* ---------- aylık izleme özeti ---------- */
const monthKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
/** Bir film ya da bölümün dakikası (bilinmiyorsa 0) */
export function minutesOf(s: State, key: string, n?: number) {
  const t = TBY[key];
  if (t) return t.episodes ? t.ep[(n || 1) - 1]?.[2] || 0 : t.minutes || 0;
  return s.lib[key]?.runtime || 0;
}
export function bump(s: State, d: { f?: number; e?: number; m?: number }, at = Date.now()): State['log'] {
  const k = monthKey(at);
  const cur = s.log[k] || { f: 0, e: 0, m: 0 };
  return { ...s.log, [k]: { f: Math.max(0, cur.f + (d.f || 0)), e: Math.max(0, cur.e + (d.e || 0)), m: Math.max(0, cur.m + (d.m || 0)) } };
}
/** Bölüm listesindeki değişimi özete yansıtır */
export function bumpEps(s: State, key: string, before: number[], after: number[]) {
  const a = new Set(before), b = new Set(after);
  let e = 0, m = 0;
  for (const n of b) if (!a.has(n)) { e++; m += minutesOf(s, key, n); }
  for (const n of a) if (!b.has(n)) { e--; m -= minutesOf(s, key, n); }
  return e || m ? bump(s, { e, m }) : s.log;
}
