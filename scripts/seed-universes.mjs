#!/usr/bin/env node
/**
 * Yeni evrenleri kataloğa ekler: scripts/seed/*.json içindeki tanımlardan
 * yapımları TMDB'de bulur, bölüm listeleriyle birlikte catalog.json'a yazar.
 * Var olan evrenlere dokunmaz; güvenle tekrar çalıştırılabilir.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(here, '..', 'src', 'data', 'catalog.json');
const SRC = path.join(here, 'sources.json');
const TOKEN = process.env.TMDB_TOKEN;
if (!TOKEN) { console.error('TMDB_TOKEN yok'); process.exit(1); }
const TODAY = new Date().toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(p, params = {}) {
  const u = new URL('https://api.themoviedb.org/3' + p);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  for (let i = 0; i < 4; i++) {
    const r = await fetch(u, { headers: { Authorization: `Bearer ${TOKEN}`, accept: 'application/json' } });
    if (r.status === 429) { await sleep(1500); continue; }
    if (!r.ok) throw new Error(`${r.status} ${p}`);
    return r.json();
  }
  throw new Error('sınır');
}
const norm = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (s) => norm(s).replace(/ /g, '-').slice(0, 40);

const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const specs = fs.readdirSync(path.join(here, 'seed')).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(here, 'seed', f), 'utf8')));
const report = [];

for (const spec of specs) {
  Object.assign(d.groups, spec.groups || {});
  for (const u of spec.universes) {
    if (d.universes.some((x) => x.id === u.id)) { report.push(`${u.id}: zaten var`); continue; }
    const main = `${u.id}-main`;
    d.groups[main] = u.name;
    const made = [];
    for (const t of u.titles) {
      const yk = t.m === 'movie' ? 'primary_release_year' : 'first_air_date_year';
      const s = await api(`/search/${t.m}`, { query: t.q, [yk]: t.year, language: 'en-US' });
      const res = s.results || [];
      const hit = res.find((r) => norm(r.title || r.name) === norm(t.q)) || res[0];
      if (!hit) { report.push(`${u.id}: bulunamadı ${t.q} (${t.year})`); continue; }
      const [en, trd] = await Promise.all([api(`/${t.m}/${hit.id}`, { language: 'en-US' }), api(`/${t.m}/${hit.id}`, { language: 'tr-TR' })]);
      const name = en.title || en.name;
      const trName = trd.title || trd.name;
      const date = (t.m === 'movie' ? en.release_date : en.first_air_date) || `${t.year}-01-01`;
      let ep = [], minutes, type;
      if (t.m === 'tv') {
        const last = en.last_episode_to_air;
        const tm = Object.fromEntries((en.seasons || []).filter((x) => x.season_number > 0).map((x) => [x.season_number, x.episode_count]));
        if (last && last.air_date <= TODAY) for (let sn = 1; sn <= last.season_number; sn++) {
          const n = sn < last.season_number ? tm[sn] || 0 : last.episode_number;
          for (let e = 1; e <= n; e++) ep.push([sn, e, null]);
        }
        minutes = en.episode_run_time?.[0] || last?.runtime || 45;
        type = 'Dizi';
      } else { minutes = en.runtime || 0; type = minutes && minutes < 40 ? 'Special' : 'Film'; }
      const id = `${u.id}-${slug(name)}-${String(date).slice(0, 4)}`;
      made.push({
        id, u: u.id, title: name, trTitle: trName && norm(trName) !== norm(name) ? trName : null, year: Number(String(date).slice(0, 4)), type, minutes,
        episodes: ep.length, branch: t.branch || main, phase: d.groups[t.branch || main] || u.name, release: Number(String(date).replace(/-/g, '').slice(0, 8)),
        chrono: t.chrono ?? null, tier: t.tier, deps: [], _deps: t.deps || [], _q: t.q, source: `https://www.themoviedb.org/${t.m}/${hit.id}`,
        animated: (en.genres || []).some((g) => g.id === 16), seasons: ep.length ? ep[ep.length - 1][0] : 0,
        summary: (trd.overview || '').trim() || null, ...(trd.overview ? { summarySource: 'tmdb' } : {}), media: t.m, ep,
        tmdb: { id: hit.id, m: t.m, p: en.poster_path || null, b: en.backdrop_path || null },
      });
    }
    // ön koşullar: aynı evrendeki adlarla
    for (const x of made) { x.deps = x._deps.map((q) => made.find((y) => norm(y._q) === norm(q))?.id).filter(Boolean); delete x._deps; delete x._q; }
    if (made.length < 2) { report.push(`${u.id}: yeterli yapım bulunamadı, eklenmedi`); continue; }
    const { titles, ...meta } = u;
    d.universes.push({ ...meta, defaultBranch: 'all' });
    d.catalog.push(...made);
    report.push(`${u.id}: ${made.length} yapım (${made.map((x) => `${x.title} ${x.year}`).join(', ')})`);
  }
  for (const s of spec.sources || []) if (!src.sources.some((x) => x.u === s.u && x.collection === s.collection)) src.sources.push(s);
}
fs.writeFileSync(FILE, JSON.stringify(d));
fs.writeFileSync(SRC, JSON.stringify(src, null, 2) + '\n');
console.log(`::notice::Yeni evrenler: ${report.join(' || ')}`);
