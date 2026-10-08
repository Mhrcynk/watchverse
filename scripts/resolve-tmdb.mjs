#!/usr/bin/env node
/**
 * WatchVerse — TMDB eşleştirme betiği
 *
 * Katalogdaki her yapımı TMDB'de arar; afiş ve arka plan yolunu, eksikse Türkçe özeti
 * src/data/catalog.json içine yazar. Uygulama çalışırken API anahtarı gerekmez:
 * görseller doğrudan image.tmdb.org adresinden yüklenir.
 *
 * Kullanım (PowerShell):
 *   $env:TMDB_TOKEN="<TMDB API Read Access Token>"; npm run posters
 * Kullanım (macOS / Linux):
 *   TMDB_TOKEN=... npm run posters
 *
 * Seçenekler:  --force (eşleşmiş olanları da yeniden ara)  --limit=50  --only=startrek
 * Hatalı eşleşmeleri scripts/tmdb-overrides.json ile düzelt:  { "<yapım id>": "movie:12345" }
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(here, '..', 'src', 'data', 'catalog.json');
const OVR = path.join(here, 'tmdb-overrides.json');
const REPORT = path.join(here, 'tmdb-report.json');

const TOKEN = process.env.TMDB_TOKEN;
const KEY = process.env.TMDB_API_KEY;
if (!TOKEN && !KEY) {
  console.error('TMDB_TOKEN (önerilen) ya da TMDB_API_KEY tanımlı değil.\nhttps://www.themoviedb.org/settings/api adresinden ücretsiz alabilirsin.');
  process.exit(1);
}
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const LIMIT = args.limit ? Number(args.limit) : Infinity;

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const overrides = fs.existsSync(OVR) ? JSON.parse(fs.readFileSync(OVR, 'utf8')) : {};

const norm = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, 'and').replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(p, params = {}) {
  const u = new URL('https://api.themoviedb.org/3' + p);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  if (KEY && !TOKEN) u.searchParams.set('api_key', KEY);
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(u, { headers: TOKEN ? { Authorization: `Bearer ${TOKEN}`, accept: 'application/json' } : { accept: 'application/json' } });
    if (res.status === 429) { await sleep(1500 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`${res.status} ${p}`);
    return res.json();
  }
  throw new Error('Çok fazla istek: ' + p);
}

function score(t, r, media) {
  const name = media === 'movie' ? r.title : r.name;
  const orig = media === 'movie' ? r.original_title : r.original_name;
  const date = media === 'movie' ? r.release_date : r.first_air_date;
  const y = date ? Number(date.slice(0, 4)) : null;
  const want = norm(t.title);
  let s = 0;
  if (norm(name) === want || norm(orig) === want) s += 60;
  else if (norm(name).includes(want) || want.includes(norm(name))) s += 25;
  if (y && t.year) s += y === t.year ? 30 : Math.abs(y - t.year) === 1 ? 18 : -Math.min(30, Math.abs(y - t.year) * 3);
  s += Math.min(10, Math.log10((r.popularity || 0) + 1) * 4);
  if (r.poster_path) s += 4;
  return s;
}

async function find(t) {
  if (overrides[t.id]) {
    const [media, id] = overrides[t.id].split(':');
    const d = await api(`/${media}/${id}`, { language: 'tr-TR' });
    return { media, r: d, score: 100 };
  }
  const order = t.media === 'tv' ? ['tv', 'movie'] : ['movie', 'tv'];
  let best = null;
  for (const media of order) {
    const q = { query: t.title, language: 'tr-TR', include_adult: false };
    if (media === 'movie') q.year = t.year; else q.first_air_date_year = t.year;
    let res = await api(`/search/${media}`, q);
    if (!res.results?.length) { delete q.year; delete q.first_air_date_year; res = await api(`/search/${media}`, q); }
    for (const r of res.results || []) {
      const s = score(t, r, media) + (media === order[0] ? 6 : 0);
      if (!best || s > best.score) best = { media, r, score: s };
    }
    if (best && best.score >= 80) break;
  }
  return best;
}

const todo = data.catalog.filter((t) => (args.force || !t.tmdb) && (!args.only || t.u === args.only)).slice(0, LIMIT);
console.log(`${todo.length} yapım aranacak (toplam ${data.catalog.length}).`);
const report = { matched: 0, weak: [], missing: [], summaries: 0 };
let i = 0;
const save = () => fs.writeFileSync(FILE, JSON.stringify(data));

async function worker() {
  while (i < todo.length) {
    const t = todo[i++];
    try {
      const m = await find(t);
      if (!m || m.score < 45) { report.missing.push(`${t.id} · ${t.title} (${t.year})`); continue; }
      t.tmdb = { id: m.r.id, m: m.media, p: m.r.poster_path || null, b: m.r.backdrop_path || null };
      if (!t.summary && m.r.overview && m.r.overview.length > 30) { t.summary = m.r.overview.trim(); t.summarySource = 'tmdb'; report.summaries++; }
      report.matched++;
      if (m.score < 70) report.weak.push(`${t.id} · ${t.title} (${t.year}) → ${m.media}:${m.r.id} ${m.r.title || m.r.name} [${Math.round(m.score)}]`);
    } catch (e) {
      report.missing.push(`${t.id} · ${t.title} — ${e.message}`);
    }
    if (i % 25 === 0) { save(); process.stdout.write(`\r${i}/${todo.length}`); }
    await sleep(60);
  }
}

await Promise.all(Array.from({ length: 6 }, worker));
save();
fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
console.log(`\nEşleşen: ${report.matched} · Zayıf eşleşme: ${report.weak.length} · Bulunamayan: ${report.missing.length} · Eklenen Türkçe özet: ${report.summaries}`);
console.log('Ayrıntı: scripts/tmdb-report.json — zayıf eşleşmeleri kontrol edip gerekirse tmdb-overrides.json ile düzelt.');
