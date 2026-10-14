import { Platform } from 'react-native';
import { EN, EN_PATTERNS } from './en';

/**
 * Dil seçimi. Uygulamanın kaynak dili Türkçedir; İngilizce seçilirse ekrandaki yazılar
 * sayfa çizildikten sonra sözlükten çevrilir (yalnızca web). Dil değişince sayfa yeniden yüklenir.
 */
export type Lang = 'tr' | 'en';
const KEY = 'watchverse:lang';

function read(): Lang {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === 'en' ? 'en' : 'tr'; } catch { return 'tr'; }
}
export const LANG: Lang = Platform.OS === 'web' ? read() : 'tr';
export const isEn = LANG === 'en';

export function setLang(l: Lang) {
  try { localStorage.setItem(KEY, l); } catch {}
  if (typeof location !== 'undefined') location.reload();
}

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

/* ---------- sayfadaki yazıları çevir (web) ---------- */
const ATTRS = ['aria-label', 'placeholder', 'title', 'alt'];
const done = new WeakMap<Node, string>();
function textNode(n: Text) {
  const v = n.nodeValue || '';
  if (done.get(n) === v) return;
  const t = tr2en(v);
  done.set(n, t);
  if (t !== v) n.nodeValue = t;
}
function element(el: Element) {
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (!v) continue;
    const t = tr2en(v);
    if (t !== v) el.setAttribute(a, t);
  }
}
function walk(root: Node) {
  if (root.nodeType === 3) { textNode(root as Text); return; }
  if (root.nodeType !== 1) return;
  const el = root as Element;
  if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
  element(el);
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.nextNode(); n; n = w.nextNode()) n.nodeType === 3 ? textNode(n as Text) : element(n as Element);
}

let started = false;
export function startTranslator() {
  if (!isEn || started || Platform.OS !== 'web' || typeof document === 'undefined') return;
  started = true;
  document.documentElement.lang = 'en';
  walk(document.body);
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') textNode(m.target as Text);
      else if (m.type === 'attributes') element(m.target as Element);
      else m.addedNodes.forEach(walk);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  const tt = document.querySelector('title');
  if (tt) new MutationObserver(() => { const v = document.title; const t = tr2en(v); if (t !== v) document.title = t; }).observe(tt, { childList: true, characterData: true, subtree: true });
}
