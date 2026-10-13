import { strFromU8, unzipSync } from 'fflate';
import { TBY } from './catalog';
import { catalogOf, libFromDetail, libFromItem } from './library';
import { detail, epIndex, searchKind, type TItem } from './tmdb';
import type { LibItem } from './types';

/* ---------- CSV ---------- */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',' || c === ';' || c === '\t') {
      // ayırıcı: ilk satırda hangisi kullanıldıysa o
      if (c === sep(s)) { row.push(cell); cell = ''; } else cell += c;
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
}
let sepCache: [string, string] | null = null;
function sep(s: string) {
  if (sepCache && sepCache[0] === s.slice(0, 200)) return sepCache[1];
  const first = s.split(/\r?\n/, 1)[0] || '';
  const counts = [',', ';', '\t'].map((c) => [c, first.split(c).length] as const).sort((a, b) => b[1] - a[1]);
  sepCache = [s.slice(0, 200), counts[0][0]];
  return counts[0][0];
}

/* ---------- okunan kayıtlar ---------- */
export type Raw =
  | { kind: 'movie'; name: string; year: number | null; at: number | null; rating: number | null; plan: boolean }
  | { kind: 'tv'; name: string; year: number | null; at: number | null; eps: [number, number][]; plan: boolean };
export type Source = 'letterboxd' | 'tvtime' | 'csv';

const pick = (r: Record<string, string>, ...keys: string[]) => { for (const k of keys) if (r[k]) return r[k]; return ''; };
const toYear = (v: string) => { const n = parseInt(v, 10); return n > 1870 && n < 2100 ? n : null; };
const toTime = (v: string) => { if (!v) return null; const t = Date.parse(v.replace(' ', 'T')); return Number.isFinite(t) ? t : null; };

/** Dosyaları okur, hangi uygulamadan geldiğini tanır */
export function readFiles(files: { name: string; text: string }[]): { source: Source; items: Raw[] } {
  const by = (re: RegExp) => files.filter((f) => re.test(f.name.toLowerCase()));
  // Letterboxd: watched.csv, ratings.csv, watchlist.csv, diary.csv
  const lbWatched = by(/(^|\/)watched\.csv$/), lbRatings = by(/(^|\/)ratings\.csv$/), lbWatch = by(/(^|\/)watchlist\.csv$/), lbDiary = by(/(^|\/)diary\.csv$/);
  if (lbWatched.length || lbRatings.length || lbDiary.length) {
    const map = new Map<string, Extract<Raw, { kind: 'movie' }>>();
    const keyOf = (r: Record<string, string>) => `${pick(r, 'name')}|${pick(r, 'year')}`;
    const add = (r: Record<string, string>, extra: Partial<Extract<Raw, { kind: 'movie' }>>) => {
      const name = pick(r, 'name');
      if (!name) return;
      const k = keyOf(r);
      const cur = map.get(k) || { kind: 'movie' as const, name, year: toYear(pick(r, 'year')), at: null, rating: null, plan: false };
      map.set(k, { ...cur, ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== null && v !== undefined)) } as Extract<Raw, { kind: 'movie' }>);
    };
    for (const f of [...lbWatched, ...lbDiary]) for (const r of parseCsv(f.text)) add(r, { at: toTime(pick(r, 'watched date', 'date')), plan: false });
    for (const f of lbRatings) for (const r of parseCsv(f.text)) { const v = parseFloat(pick(r, 'rating')); add(r, { rating: Number.isFinite(v) ? Math.max(1, Math.round(v)) : null }); }
    for (const f of lbWatch) for (const r of parseCsv(f.text)) if (!map.has(keyOf(r))) add(r, { plan: true });
    // Puanlanmış ama izlenme tarihi olmayanlar da izlenmiş sayılır
    return { source: 'letterboxd', items: [...map.values()] };
  }

  // TV Time: dosya adları sürüme göre değişebiliyor; sütunlardan tanınır
  const tv = new Map<string, Extract<Raw, { kind: 'tv' }>>();
  const mv = new Map<string, Extract<Raw, { kind: 'movie' }>>();
  let tvtime = false;
  for (const f of files.filter((x) => x.name.toLowerCase().endsWith('.csv'))) {
    const rows = parseCsv(f.text);
    if (!rows.length) continue;
    const cols = Object.keys(rows[0]);
    const showCol = ['series_name', 'tv_show_name', 'show_name'].find((c) => cols.includes(c));
    const seasonCol = ['season_number', 'episode_season_number'].find((c) => cols.includes(c));
    if (showCol && seasonCol && cols.includes('episode_number')) {
      tvtime = true;
      for (const r of rows) {
        const name = r[showCol];
        const s = parseInt(r[seasonCol], 10), e = parseInt(r.episode_number, 10);
        if (!name || !(s >= 0) || !(e >= 1)) continue;
        const cur = tv.get(name) || { kind: 'tv' as const, name, year: null, at: null, eps: [], plan: false };
        cur.eps.push([s, e]);
        const t = toTime(pick(r, 'created_at', 'updated_at', 'watched_at'));
        if (t && (!cur.at || t > cur.at)) cur.at = t;
        tv.set(name, cur);
      }
      continue;
    }
    if (cols.includes('movie_name')) {
      tvtime = true;
      for (const r of rows) {
        const name = r.movie_name;
        if (!name) continue;
        const type = (r.type || '').toLowerCase();
        const watched = ['watch', 'rewatch', 'watched'].includes(type);
        const cur = mv.get(name) || { kind: 'movie' as const, name, year: toYear((r.release_date || '').slice(0, 4)), at: null, rating: null, plan: !watched };
        if (watched) { cur.plan = false; cur.at = toTime(pick(r, 'updated_at', 'created_at')) || cur.at || Date.now(); }
        mv.set(name, cur);
      }
      continue;
    }
    // Genel CSV: ad / title, yıl / year, tür / type
    const nameCol = ['ad', 'isim', 'title', 'name', 'başlık', 'baslik'].find((c) => cols.includes(c));
    if (nameCol) {
      for (const r of rows) {
        const name = r[nameCol];
        if (!name) continue;
        const type = pick(r, 'tür', 'tur', 'type', 'tip').toLowerCase();
        const isTv = /dizi|tv|series|show/.test(type);
        const year = toYear(pick(r, 'yıl', 'yil', 'year'));
        const at = toTime(pick(r, 'tarih', 'date', 'watched'));
        if (isTv) tv.set(name, { kind: 'tv', name, year, at, eps: [], plan: false });
        else { const v = parseFloat(pick(r, 'puan', 'rating')); mv.set(name, { kind: 'movie', name, year, at: at || Date.now(), rating: Number.isFinite(v) ? Math.min(5, Math.max(1, Math.round(v))) : null, plan: false }); }
      }
    }
  }
  return { source: tvtime ? 'tvtime' : 'csv', items: [...mv.values(), ...tv.values()] };
}

/** Zip ya da CSV dosyasını metin dosyalarına açar */
export function unpack(name: string, data: Uint8Array): { name: string; text: string }[] {
  if (name.toLowerCase().endsWith('.zip') || (data[0] === 0x50 && data[1] === 0x4b)) {
    const out = unzipSync(data, { filter: (f) => f.name.toLowerCase().endsWith('.csv') && f.originalSize < 30_000_000 });
    return Object.entries(out).map(([n, u]) => ({ name: n, text: strFromU8(u) }));
  }
  return [{ name, text: strFromU8(data) }];
}

/* ---------- TMDB ile eşleştirme ---------- */
export type Matched = { raw: Raw; key: string; title: string; year: number | null; lib?: LibItem; eps?: number[]; catalog: boolean };
const norm = (s: string) => s.toLocaleLowerCase('tr').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function best(list: TItem[], raw: Raw) {
  const n = norm(raw.name);
  const scored = list.map((x) => {
    let sc = 0;
    if (norm(x.title) === n || norm(x.orig || '') === n) sc += 10;
    if (raw.year && x.year) sc += x.year === raw.year ? 6 : Math.abs(x.year - raw.year) === 1 ? 3 : -4;
    sc += Math.min(3, Math.log10(1 + x.votes));
    return { x, sc };
  }).sort((a, b) => b.sc - a.sc);
  return scored[0] && scored[0].sc >= 6 ? scored[0].x : null;
}

/** Her kaydı TMDB'de bulur; dizilerde bölüm numaralarını uygulamanın sırasına çevirir */
export async function matchAll(items: Raw[], onProgress: (done: number, total: number) => void): Promise<{ ok: Matched[]; miss: Raw[] }> {
  const ok: Matched[] = [], miss: Raw[] = [];
  let done = 0;
  const queue = [...items];
  const worker = async () => {
    for (let raw = queue.shift(); raw; raw = queue.shift()) {
      try {
        const res = await searchKind(raw.kind, raw.name, raw.year || undefined);
        const hit = best(res, raw) || (raw.year ? best(await searchKind(raw.kind, raw.name), { ...raw, year: null }) : null);
        if (!hit) { miss.push(raw); continue; }
        const cat = catalogOf(hit.key);
        if (raw.kind === 'movie') {
          ok.push({ raw, key: cat ? cat.id : hit.key, title: cat ? cat.trTitle || cat.title : hit.title, year: hit.year, lib: cat ? undefined : libFromItem(hit), catalog: !!cat });
        } else {
          let eps: number[] = [];
          let lib: LibItem | undefined;
          if (cat) {
            const t = TBY[cat.id];
            eps = raw.eps.map(([s, e]) => t.ep.findIndex((x) => x[0] === s && x[1] === e) + 1).filter((n) => n > 0);
          } else {
            const d = await detail('tv', hit.id);
            lib = libFromDetail(d);
            eps = raw.eps.map(([s, e]) => (s > 0 ? epIndex(d.seasons, s, e) : 0)).filter((n) => n > 0);
          }
          ok.push({ raw, key: cat ? cat.id : hit.key, title: cat ? cat.trTitle || cat.title : hit.title, year: hit.year, lib, eps: [...new Set(eps)], catalog: !!cat });
        }
      } catch { miss.push(raw); } finally { done++; onProgress(done, items.length); }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return { ok, miss };
}
