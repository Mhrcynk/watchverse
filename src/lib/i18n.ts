import { EN, EN_PATTERNS } from './en';
export type Lang = 'tr' | 'en';
export const LANG: Lang = 'tr';
export const isEn = false;

/* ---------- çeviri ---------- */
const AY: Record<string, string> = { Oca: 'Jan', Şub: 'Feb', Mar: 'Mar', Nis: 'Apr', May: 'May', Haz: 'Jun', Tem: 'Jul', Ağu: 'Aug', Eyl: 'Sep', Eki: 'Oct', Kas: 'Nov', Ara: 'Dec' };
const AY_LONG: Record<string, string> = { Ocak: 'January', Şubat: 'February', Mart: 'March', Nisan: 'April', Mayıs: 'May', Haziran: 'June', Temmuz: 'July', Ağustos: 'August', Eylül: 'September', Ekim: 'October', Kasım: 'November', Aralık: 'December' };
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
type Pat = { re: RegExp; to: string };
let PATS: Pat[] | null = null;
function pats(): Pat[] {
  if (PATS) return PATS;
  PATS = Object.entries(EN_PATTERNS).map(([from, to]) => ({ re: new RegExp('^' + from.split(/\{(\d)\}/).map((part, i) => (i % 2 ? `(?<g${part}>.+?)` : esc(part))).join('') + '$', 's'), to }));
  return PATS;
}

/** Bir metni (baştaki/sondaki boşluklar korunarak) çevirir; çeviri yoksa aynen döndürür */
export function tr2en(text: string, depth = 0): string {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!;
  const core = m[2];
  if (!core || depth > 5) return text;
  const out = translateCore(core, depth);
  return out === core ? text : m[1] + out + m[3];
}
let UPPER: Record<string, string> | null = null;
function translateCore(core: string, depth: number): string {
  const count = /^(\d+) (yapım|bölüm|sezon|liste|kişi|kayıt|evren)$/.exec(core);
  if (count) {
    const nouns: Record<string, [string, string]> = { yapım: ['title', 'titles'], bölüm: ['episode', 'episodes'], sezon: ['season', 'seasons'], liste: ['list', 'lists'], kişi: ['person', 'people'], kayıt: ['item', 'items'], evren: ['universe', 'universes'] };
    return `${count[1]} ${nouns[count[2]][Number(count[1]) === 1 ? 0 : 1]}`;
  }
  const hit = EN[core];
  if (hit !== undefined) return hit;
  if (core.length > 2 && core === core.toLocaleUpperCase('tr')) {
    if (!UPPER) { UPPER = {}; for (const [k, v] of Object.entries(EN)) UPPER[k.toLocaleUpperCase('tr')] = v.toUpperCase(); }
    if (UPPER[core] !== undefined) return UPPER[core];
  }
  // tarih: "14 Eki", "14 Eki 2027", "14 Ekim 2026", "Ekim 2026"
  let d = /^(\d{1,2}) (Oca|Şub|Mar|Nis|May|Haz|Tem|Ağu|Eyl|Eki|Kas|Ara)( \d{4})?$/.exec(core);
  if (d) return `${AY[d[2]]} ${d[1]}${d[3] ? ',' + d[3] : ''}`;
  d = /^(\d{1,2}) (Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık) (\d{4})$/.exec(core);
  if (d) return `${AY_LONG[d[2]]} ${d[1]}, ${d[3]}`;
  d = /^(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık) (\d{4})$/i.exec(core);
  if (d) return `${AY_LONG[d[1][0].toLocaleUpperCase('tr') + d[1].slice(1).toLocaleLowerCase('tr')]} ${d[2]}`;
  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(core)) return core;
  for (const p of pats()) {
    const r = p.re.exec(core);
    if (r) return p.to.replace(/\{(\d)\}/g, (_, n) => tr2en(r.groups?.[`g${n}`] ?? '', depth + 1));
  }
  return core;
}
