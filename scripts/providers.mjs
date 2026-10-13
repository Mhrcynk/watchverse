#!/usr/bin/env node
/**
 * Her yapım için Türkiye'de abonelikle izlenebildiği platformları TMDB'den alır (veri: JustWatch).
 * Haftalık görevde çalışır. Kiralık/satılık seçenekler yazılmaz, yalnızca abonelik.
 *   TMDB_TOKEN=... node scripts/providers.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(here, '..', 'src', 'data', 'catalog.json');
const TOKEN = process.env.TMDB_TOKEN;
if (!TOKEN || TOKEN.length < 100) { console.error('TMDB_TOKEN eksik.'); process.exit(1); }
const REGION = process.env.REGION || 'TR';

// TMDB adlarını kısa ve tanıdık hale getir; aynı platformun reklamlı/kanal sürümlerini birleştir
const NAME = [
  [/disney/i, 'Disney+'], [/netflix/i, 'Netflix'], [/amazon|prime video/i, 'Prime Video'], [/hbo|^max\b/i, 'HBO Max'],
  [/apple tv/i, 'Apple TV+'], [/blutv/i, 'BluTV'], [/^tod\b|tod tv/i, 'TOD'], [/exxen/i, 'Exxen'], [/gain/i, 'Gain'],
  [/tabii/i, 'tabii'], [/mubi/i, 'MUBI'], [/puhu/i, 'puhutv'], [/paramount/i, 'Paramount+'], [/tv\+|tvplus/i, 'TV+'],
];
const nice = (n) => (NAME.find(([re]) => re.test(n)) || [null, n])[1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function providers(m, id) {
  for (let a = 0; a < 4; a++) {
    const res = await fetch(`https://api.themoviedb.org/3/${m}/${id}/watch/providers`, { headers: { Authorization: `Bearer ${TOKEN}`, accept: 'application/json' } });
    if (res.status === 429) { await sleep(1500 * (a + 1)); continue; }
    if (res.status === 401) { console.error('TMDB token reddedildi.'); process.exit(1); }
    if (!res.ok) return null;
    const j = await res.json();
    const r = j.results?.[REGION];
    if (!r) return [];
    return [...new Set((r.flatrate || []).sort((x, y) => (x.display_priority ?? 99) - (y.display_priority ?? 99)).map((p) => nice(p.provider_name)))];
  }
  return null;
}

/** Resmî YouTube fragmanı; yoksa boş metin (bir daha aranmaz) */
async function trailer(m, id) {
  for (const lang of ['tr-TR', 'en-US']) {
    const res = await fetch(`https://api.themoviedb.org/3/${m}/${id}/videos?language=${lang}`, { headers: { Authorization: `Bearer ${TOKEN}`, accept: 'application/json' } });
    if (res.status === 429) { await sleep(2000); return null; }
    if (!res.ok) return null;
    const v = (await res.json()).results?.filter((x) => x.site === 'YouTube' && /Trailer|Teaser/.test(x.type)) || [];
    v.sort((a, b) => (b.official - a.official) || ((a.type === 'Trailer' ? 0 : 1) - (b.type === 'Trailer' ? 0 : 1)) || (b.size || 0) - (a.size || 0));
    if (v[0]) return v[0].key;
  }
  return '';
}

const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const list = d.catalog.filter((t) => t.tmdb?.id > 0);
let changed = 0, found = 0, trailers = 0, i = 0;
async function worker() {
  while (i < list.length) {
    const t = list[i++];
    const pl = await providers(t.tmdb.m || t.media, t.tmdb.id);
    if (pl === null) continue; // hata: eski bilgiyi koru
    if (pl.length) found++;
    const before = JSON.stringify(t.pl || []);
    if (pl.length) t.pl = pl; else delete t.pl;
    if (JSON.stringify(t.pl || []) !== before) changed++;
    if (t.yt === undefined) { const y = await trailer(t.tmdb.m || t.media, t.tmdb.id); if (y !== null) { t.yt = y; if (y) trailers++; changed++; } }
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
if (changed) { d.rev = new Date().toISOString(); fs.writeFileSync(FILE, JSON.stringify(d)); }
console.log(`Platform bilgisi: ${found}/${list.length} yapımda var. Yeni fragman: ${trailers}. Değişen: ${changed}.`);
