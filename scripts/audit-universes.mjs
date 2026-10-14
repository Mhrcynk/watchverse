#!/usr/bin/env node
/**
 * Evren denetimi (yalnızca okur, hiçbir şeyi değiştirmez):
 * Her evrenin katalogdaki yapımlarının TMDB anahtar kelimelerine ve yapım şirketlerine bakar;
 * evrende sık geçenleri bulur, bunlarla TMDB'de arama yapar ve katalogda OLMAYAN yapımları listeler.
 * Amaç: güncelleyicinin kaynak listesinde (sources.json) eksik kalan anahtar kelime / şirketi yakalamak.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const d = JSON.parse(fs.readFileSync(path.join(here, '..', 'src', 'data', 'catalog.json'), 'utf8'));
const { sources } = JSON.parse(fs.readFileSync(path.join(here, 'sources.json'), 'utf8'));
const ignore = new Set(JSON.parse(fs.readFileSync(path.join(here, 'update-ignore.json'), 'utf8')).ignore || []);
const TOKEN = process.env.TMDB_TOKEN;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(p, params = {}) {
  const u = new URL('https://api.themoviedb.org/3' + p);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  for (let i = 0; i < 4; i++) {
    const r = await fetch(u, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (r.status === 429) { await sleep(1500); continue; }
    if (!r.ok) return null;
    return r.json();
  }
  return null;
}
const known = new Set(d.catalog.filter((t) => t.tmdb?.id > 0).map((t) => `${t.tmdb.m || t.media}:${t.tmdb.id}`));
for (const m of d.moved || []) if (m.key) known.add(m.key);
const TODAY = new Date().toISOString().slice(0, 10);
const out = {};
for (const u of d.universes) {
  const titles = d.catalog.filter((t) => t.u === u.id && t.tmdb?.id > 0);
  const kw = new Map(), co = new Map();
  for (const t of titles) {
    const m = t.tmdb.m || t.media;
    const [k, det] = await Promise.all([api(`/${m}/${t.tmdb.id}/keywords`), api(`/${m}/${t.tmdb.id}`)]);
    for (const x of (k?.keywords || k?.results || [])) { const e = kw.get(x.id) || { id: x.id, name: x.name, n: 0 }; e.n++; kw.set(x.id, e); }
    for (const x of (det?.production_companies || [])) { const e = co.get(x.id) || { id: x.id, name: x.name, n: 0 }; e.n++; co.set(x.id, e); }
  }
  const min = Math.max(2, Math.ceil(titles.length * 0.3));
  const used = new Set(sources.filter((s) => s.u === u.id).map((s) => (s.keyword || s.company || s.collection || '').toLowerCase()));
  const refs = [...[...kw.values()].filter((x) => x.n >= min).map((x) => ({ ...x, kind: 'keyword' })), ...[...co.values()].filter((x) => x.n >= min).map((x) => ({ ...x, kind: 'company' }))]
    .sort((a, b) => b.n - a.n).slice(0, 8);
  const missing = new Map();
  for (const ref of refs) {
    for (const m of ['movie', 'tv']) {
      const dateField = m === 'movie' ? 'primary_release_date' : 'first_air_date';
      for (let page = 1; page <= 2; page++) {
        const r = await api(`/discover/${m}`, { [ref.kind === 'keyword' ? 'with_keywords' : 'with_companies']: ref.id, [`${dateField}.gte`]: '2023-01-01', [`${dateField}.lte`]: '2027-12-31', sort_by: 'popularity.desc', without_genres: m === 'movie' ? '99' : '99,10767,10763,10764', page });
        for (const x of r?.results || []) {
          const k = `${m}:${x.id}`;
          if (known.has(k) || ignore.has(k) || (x.popularity || 0) < 4) continue;
          const e = missing.get(k) || { k, title: x.title || x.name, date: x.release_date || x.first_air_date || '', pop: Math.round(x.popularity || 0), via: [] };
          e.via.push(`${ref.kind}:${ref.name}`); missing.set(k, e);
        }
        if (!r || page >= r.total_pages) break;
      }
    }
  }
  out[u.id] = {
    refs: refs.map((r) => `${r.kind}:${r.name} (${r.n}/${titles.length})${used.has(r.name.toLowerCase()) ? ' ✓' : ''}`),
    missing: [...missing.values()].sort((a, b) => b.pop - a.pop).slice(0, 25).map((x) => `${x.title} [${x.k}] ${x.date}${x.date > TODAY ? ' (yakında)' : ''} pop${x.pop} ← ${[...new Set(x.via)].slice(0, 2).join(', ')}`),
  };
  console.log(`\n== ${u.id}\n  kaynak adayları: ${out[u.id].refs.join(' | ')}\n  eksik olabilir:\n    ${out[u.id].missing.join('\n    ')}`);
}
fs.writeFileSync(path.join(here, '..', 'audit.json'), JSON.stringify(out, null, 1));
