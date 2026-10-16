#!/usr/bin/env node
/**
 * WatchVerse — haftalık katalog güncelleyici
 *
 * GitHub üzerinde haftada bir kendiliğinden çalışır (.github/workflows/update.yml).
 * 1) Katalogdaki her dizi için TMDB'de yayınlanmış yeni bölüm ve sezon var mı bakar, ekler.
 * 2) scripts/sources.json'daki seri, anahtar kelime ve yapım şirketlerinden
 *    son aylarda yayınlanmış ama katalogda olmayan film ve dizileri bulur, ekler.
 * Değişiklik varsa src/data/catalog.json'a yazar ve "changes" listesine not düşer;
 * uygulama "Yeni eklenenler" bölümünü buradan gösterir.
 *
 * Elle çalıştırmak için:  TMDB_TOKEN=... node scripts/update-catalog.mjs [--dry] [--days=180]
 * Yanlış eklenen bir yapımı bir daha eklememesi için scripts/update-ignore.json'a "movie:123" ya da "tv:456" yaz.
 */
import { attachEpisodeIds } from './catalog-episode-ids.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = process.env.CATALOG_FILE || path.join(here, '..', 'src', 'data', 'catalog.json');
const SOURCES = path.join(here, 'sources.json');
const IGNORE = path.join(here, 'update-ignore.json');

const TOKEN = process.env.TMDB_TOKEN;
if (!TOKEN || TOKEN.length < 100 || /[^\x21-\x7e]/.test(TOKEN)) {
  console.error('TMDB_TOKEN eksik ya da hatalı. GitHub\'da Settings → Secrets → Actions altına TMDB_TOKEN adıyla ekle.');
  process.exit(1);
}
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const DRY = !!args.dry;
const DAYS = Number(args.days || 180);
const MAX_NEW = Number(args.max || 30);

const TODAY = (process.env.TODAY || new Date().toISOString()).slice(0, 10);
const SINCE = new Date(Date.parse(TODAY) - DAYS * 864e5).toISOString().slice(0, 10);
const RECENT = new Date(Date.parse(TODAY) - 120 * 864e5).toISOString().slice(0, 10);
const TOMORROW = new Date(Date.parse(TODAY) + 864e5).toISOString().slice(0, 10);
const HORIZON = new Date(Date.parse(TODAY) + 400 * 864e5).toISOString().slice(0, 10);
/** Yakında: çıkış tarihi belli yeni bölüm, sezon, film ve diziler */
const upcoming = [];

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const { sources } = JSON.parse(fs.readFileSync(SOURCES, 'utf8'));
const ignore = new Set(fs.existsSync(IGNORE) ? JSON.parse(fs.readFileSync(IGNORE, 'utf8')).ignore || [] : []);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, 'and').replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
const log = (...a) => console.log(...a);

async function api(p, params = {}) {
  const u = new URL('https://api.themoviedb.org/3' + p);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(u, { headers: { Authorization: `Bearer ${TOKEN}`, accept: 'application/json' } });
    if (res.status === 429) { await sleep(1500 * (attempt + 1)); continue; }
    if (res.status === 401) { console.error('TMDB token\'ı kabul etmedi (401).'); process.exit(1); }
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`${res.status} ${p}`);
    return res.json();
  }
  throw new Error('Çok fazla istek: ' + p);
}

const change = { date: TODAY, added: [], seasons: [] };
const byId = Object.fromEntries(data.catalog.map((t) => [t.id, t]));
const known = new Set(data.catalog.filter((t) => t.tmdb?.id > 0).map((t) => `${t.tmdb.m || t.media}:${t.tmdb.id}`));
const knownName = new Set(data.catalog.flatMap((t) => [-1, 0, 1].map((d) => `${norm(t.title)}|${t.year + d}`)));
// "Henüz yayımlanmamış" diye dışarıda bırakılanlar yayınlanınca eklenebilir; diğerleri bilerek dışarıda
const blocked = new Set((data.excluded || []).filter((x) => !/yayımlanmamış|yayınlanmamış/i.test(x.reason) || /veya/i.test(x.reason)).map((x) => norm(x.title)));

/* ---------- 1. Dizilerde yeni bölüm ve sezonlar ---------- */
// Aynı TMDB kaydına bağlı birden çok yapım varsa (bölünmüş diziler) dokunma
const tvCount = {};
for (const t of data.catalog) if (t.tmdb?.m === 'tv' && t.tmdb.id > 0) tvCount[t.tmdb.id] = (tvCount[t.tmdb.id] || 0) + 1;

async function updateSeries() {
  const list = data.catalog.filter((t) => t.tmdb?.m === 'tv' && t.tmdb.id > 0 && t.ep.length && tvCount[t.tmdb.id] === 1);
  log(`Diziler kontrol ediliyor: ${list.length}`);
  for (const t of list) {
    const r = await api(`/tv/${t.tmdb.id}`, { language: 'en-US' });
    if (!r) continue;
    const nx = r.next_episode_to_air;
    if (nx?.air_date && nx.air_date > TODAY && nx.air_date <= HORIZON) {
      upcoming.push({ k: `tv:${t.tmdb.id}`, id: t.id, u: t.u, title: t.title, kind: nx.episode_number === 1 ? 'season' : 'episode', season: nx.season_number, episode: nx.episode_number, date: nx.air_date, p: t.tmdb.p || null });
    }
    const last = r.last_episode_to_air;
    if (!last || !last.season_number || last.air_date > TODAY) continue;
    // Yalnızca son aylarda yeni bölümü çıkan dizilere dokun; eski dizilerde TMDB'nin farklı sayımı yanlış ekleme yapar
    if (last.air_date < RECENT) continue;
    const ours = {};
    for (const [s] of t.ep) ours[s] = (ours[s] || 0) + 1;
    const ourSeasons = Object.keys(ours).map(Number).sort((a, b) => a - b);
    const maxS = ourSeasons[ourSeasons.length - 1];
    // Katalogdaki sezonlar 1..N kesintisiz değilse bu kayıt dizinin bir parçasıdır; dokunma
    if (ourSeasons[0] !== 1 || ourSeasons.length !== maxS) continue;
    const tm = Object.fromEntries((r.seasons || []).filter((s) => s.season_number > 0).map((s) => [s.season_number, s.episode_count]));
    // Eski sezonların bölüm sayıları tutmuyorsa yanlış eşleşme olabilir; dokunma
    let ok = true;
    for (const s of ourSeasons.slice(0, -1)) if (!tm[s] || Math.abs(tm[s] - ours[s]) > 2) ok = false;
    if (!ok || last.season_number < maxS || last.season_number - maxS > 2) continue;
    const aired = (s) => (s < last.season_number ? tm[s] || 0 : last.episode_number);
    const mins = r.episode_run_time?.[0] || last.runtime || null;
    let added = 0;
    for (let s = maxS; s <= last.season_number; s++) {
      const have = ours[s] || 0;
      const n = aired(s);
      if (n <= have) continue;
      for (let e = have + 1; e <= n; e++) t.ep.push([s, e, s === last.season_number && e === n ? last.runtime || mins : mins]);
      change.seasons.push({ id: t.id, season: s, episodes: n - have });
      added += n - have;
    }
    if (added) {
      t.ep.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      t.episodes = t.ep.length;
      t.seasons = Math.max(...t.ep.map((e) => e[0]));
      log(`  + ${t.title}: ${added} yeni bölüm (son: ${last.season_number}. sezon ${last.episode_number}. bölüm)`);
    }
  }
}

/* ---------- 2. Yeni yapımlar ---------- */
const resolved = {};
async function resolveSource(src) {
  // Elle seçilmiş yapımlar (anahtar kelime / şirketle güvenle bulunamayan evren yapımları)
  if (src.ids) return { kind: 'ids', ids: src.ids };
  const kind = src.collection ? 'collection' : src.keyword ? 'keyword' : 'company';
  const q = src[kind];
  const key = `${kind}:${q}`;
  if (key in resolved) return resolved[key];
  const r = await api(`/search/${kind}`, { query: q });
  const must = norm(src.must || q);
  const results = (r?.results || []).filter((x) => norm(x.name).includes(must));
  const pick = results.find((x) => norm(x.name) === norm(q) || norm(x.name) === norm(q + ' collection')) || results[0] || null;
  resolved[key] = pick ? { kind, id: pick.id, name: pick.name } : null;
  log(pick ? `  ${kind} "${q}" → ${pick.name} (#${pick.id})` : `  ${kind} "${q}" bulunamadı`);
  return resolved[key];
}

async function candidates(src, ref) {
  const out = [];
  if (ref.kind === 'ids') {
    for (const k of ref.ids) {
      const [m, id] = k.split(':');
      const r = await api(`/${m}/${id}`, { language: 'en-US' });
      const date = r && (m === 'movie' ? r.release_date : r.first_air_date);
      if (date && date <= TODAY) out.push({ m, r });
    }
    return out;
  }
  if (ref.kind === 'collection') {
    const c = await api(`/collection/${ref.id}`, { language: 'en-US' });
    for (const p of c?.parts || []) if (p.release_date && p.release_date <= TODAY && p.release_date >= SINCE) out.push({ m: 'movie', r: p, collection: c });
    return out;
  }
  for (const m of src.media || ['movie', 'tv']) {
    const dateField = m === 'movie' ? 'primary_release_date' : 'first_air_date';
    for (let page = 1; page <= 3; page++) {
      const r = await api(`/discover/${m}`, {
        [ref.kind === 'keyword' ? 'with_keywords' : 'with_companies']: ref.id,
        [`${dateField}.gte`]: SINCE,
        [`${dateField}.lte`]: TODAY,
        without_genres: m === 'movie' ? '99' : '99,10767,10763,10764',
        include_adult: false,
        sort_by: `${dateField}.desc`,
        page,
      });
      for (const x of r?.results || []) out.push({ m, r: x });
      if (!r || page >= r.total_pages) break;
    }
  }
  return out;
}

function siblingOf(u, branch) {
  return data.catalog.filter((t) => t.u === u && t.branch === branch).sort((a, b) => b.release - a.release)[0];
}

async function buildTitle(src, c) {
  const { m, r } = c;
  const [tr, en] = await Promise.all([api(`/${m}/${r.id}`, { language: 'tr-TR' }), api(`/${m}/${r.id}`, { language: 'en-US' })]);
  if (!tr || !en || !en.poster_path) return null;
  const name = m === 'movie' ? en.title : en.name;
  const trName = m === 'movie' ? tr.title : tr.name;
  const date = m === 'movie' ? en.release_date : en.first_air_date;
  if (!date || date > TODAY) return null;
  const year = Number(date.slice(0, 4));
  if (src.minVotes && (en.vote_count || 0) < src.minVotes) return null;
  if ((src.skipIfTitleHas || []).some((w) => norm(name).includes(norm(w)))) return null;
  if (blocked.has(norm(name)) || knownName.has(`${norm(name)}|${year}`) || knownName.has(`${norm(en.original_title || en.original_name)}|${year}`)) return null;

  let branch = src.branch, tier = src.tier ?? 1, deps = [], phase;
  if (c.collection) {
    // Serinin katalogdaki son filmini bul: rota ve ön koşul ondan gelir
    const ids = new Set(c.collection.parts.map((p) => p.id));
    const prev = data.catalog.filter((t) => t.tmdb?.m === 'movie' && ids.has(t.tmdb.id) && t.release < Number(date.replace(/-/g, ''))).sort((a, b) => b.release - a.release)[0];
    if (prev) { branch = prev.branch; tier = prev.tier; deps = [prev.id]; phase = prev.phase; }
  }
  const sib = siblingOf(src.u, branch);
  if (!sib) return null;
  phase ||= sib.phase;
  const animated = (en.genres || []).some((g) => g.id === 16);

  let ep = [], type, minutes;
  if (m === 'tv') {
    const last = en.last_episode_to_air;
    if (!last || last.air_date > TODAY) return null;
    const tm = Object.fromEntries((en.seasons || []).filter((s) => s.season_number > 0).map((s) => [s.season_number, s.episode_count]));
    minutes = en.episode_run_time?.[0] || last.runtime || 45;
    for (let s = 1; s <= last.season_number; s++) {
      const n = s < last.season_number ? tm[s] || 0 : last.episode_number;
      for (let e = 1; e <= n; e++) ep.push([s, e, null]);
    }
    // Tek bölümlük tanıtım ya da kısa yapımları alma (seri kayıtları hariç).
    // Yeni başlayan dizi: henüz 1-2 bölüm yayınlanmış olsa da sezonu en az 3 bölüm olarak duyurulduysa hemen ekle
    const announced = Object.values(tm).reduce((a, b) => a + b, 0);
    if (!ep.length || (!c.collection && ep.length < 3 && announced < 3)) return null;
    type = 'Dizi';
  } else {
    minutes = en.runtime || 0;
    // Anahtar kelime ve şirket aramalarında kısa film, tanıtım ve özel bölüm gürültüsü çok; uzun metraj olmayanı alma
    if (!c.collection && minutes < 60) return null;
    type = minutes && minutes < 40 ? 'Special' : 'Film';
  }
  const summary = (tr.overview || '').trim() || null;
  return {
    id: `${src.u}-tmdb-${m}${r.id}`,
    u: src.u,
    title: name,
    trTitle: trName && norm(trName) !== norm(name) ? trName : null,
    year,
    type,
    minutes,
    episodes: ep.length,
    branch,
    phase,
    release: Number(date.replace(/-/g, '')),
    chrono: null,
    tier,
    deps,
    source: `https://www.themoviedb.org/${m}/${r.id}`,
    animated,
    seasons: ep.length ? ep[ep.length - 1][0] : 0,
    summary,
    ...(summary ? { summarySource: 'tmdb' } : {}),
    media: m,
    ep,
    tmdb: { id: r.id, m, p: en.poster_path, b: en.backdrop_path || null },
    auto: true,
    addedAt: TODAY,
  };
}

async function findNew() {
  log(`Yeni yapımlar aranıyor (${SINCE} – ${TODAY})`);
  const seen = new Set();
  for (const src of sources) {
    const ref = await resolveSource(src);
    if (!ref) continue;
    for (const c of await candidates(src, ref)) {
      const k = `${c.m}:${c.r.id}`;
      if (seen.has(k) || known.has(k) || ignore.has(k)) continue;
      seen.add(k);
      if (!c.r.poster_path) continue;
      if (change.added.length >= MAX_NEW) { log(`  Sınır (${MAX_NEW}) doldu, kalanlar gelecek hafta.`); return; }
      const t = await buildTitle(src, c);
      if (!t || byId[t.id]) continue;
      data.catalog.push(t);
      byId[t.id] = t;
      known.add(k);
      for (const d of [-1, 0, 1]) knownName.add(`${norm(t.title)}|${t.year + d}`);
      data.excluded = (data.excluded || []).filter((x) => norm(x.title) !== norm(t.title));
      change.added.push(t.id);
      log(`  + ${t.title} (${t.year}, ${t.type}) → ${t.u}/${t.branch}`);
    }
  }
}

async function findUpcoming() {
  log('Yakında çıkacaklar aranıyor');
  const seen = new Set(upcoming.map((x) => x.k));
  for (const src of sources) {
    const ref = await resolveSource(src);
    if (!ref) continue;
    const found = [];
    if (ref.kind === 'ids') {
      for (const k of ref.ids) {
        const [m, id] = k.split(':');
        const r = await api(`/${m}/${id}`, { language: 'en-US' });
        const date = r && (m === 'movie' ? r.release_date : r.first_air_date);
        if (date && date > TODAY && date <= HORIZON) found.push({ m, r });
      }
    } else if (ref.kind === 'collection') {
      const c = await api(`/collection/${ref.id}`, { language: 'en-US' });
      for (const p of c?.parts || []) if (p.release_date && p.release_date > TODAY && p.release_date <= HORIZON) found.push({ m: 'movie', r: p });
    } else if ((src.tier ?? 1) <= 1) {
      for (const m of src.media || ['movie', 'tv']) {
        const dateField = m === 'movie' ? 'primary_release_date' : 'first_air_date';
        const r = await api(`/discover/${m}`, {
          [ref.kind === 'keyword' ? 'with_keywords' : 'with_companies']: ref.id,
          [`${dateField}.gte`]: TOMORROW, [`${dateField}.lte`]: HORIZON,
          without_genres: m === 'movie' ? '99' : '99,10767,10763,10764', include_adult: false, sort_by: 'popularity.desc', page: 1,
        });
        for (const x of r?.results || []) if ((x.popularity || 0) >= 3) found.push({ m, r: x });
      }
    }
    for (const { m, r } of found) {
      const k = `${m}:${r.id}`;
      const name = m === 'movie' ? r.title : r.name;
      const date = m === 'movie' ? r.release_date : r.first_air_date;
      if (!date || seen.has(k) || ignore.has(k) || known.has(k)) continue;
      if ((src.skipIfTitleHas || []).some((w) => norm(name).includes(norm(w)))) continue;
      seen.add(k);
      upcoming.push({ k, u: src.u, title: name, kind: m === 'movie' ? 'film' : 'series', date, p: r.poster_path || null });
    }
  }
}

async function enrichEpisodeIdentities() {
  let count = 0;
  const seasons = new Map();
  for (const t of data.catalog) {
    if (!t.tmdb?.id || !(t.tmdb.m === 'tv' || t.media === 'tv')) continue;
    for (const n of new Set(t.ep.filter(e=>!e[3]).map(e=>e[0]))) {
      const key = `${t.tmdb.id}:${n}`;
      if (!seasons.has(key)) seasons.set(key, await api(`/tv/${t.tmdb.id}/season/${n}`, { language: 'en-US' }));
      const rows = seasons.get(key)?.episodes;
      if (!Array.isArray(rows)) continue;
      const attached = attachEpisodeIds(t.ep, rows);
      t.ep = attached.episodes; count += attached.added;
    }
  }
  log(`Kalıcı bölüm kimliği eklendi: ${count}`);
  return count;
}

await updateSeries();
await findNew();
await findUpcoming();
const identityUpdates = await enrichEpisodeIdentities();
upcoming.sort((a, b) => a.date.localeCompare(b.date));
const upNew = upcoming.slice(0, 80);
const upChanged = JSON.stringify(upNew) !== JSON.stringify(data.upcoming || []);
log(`Yakında: ${upNew.length} kayıt${upChanged ? ' (değişti)' : ''}.`);
if (upChanged && !DRY) {
  data.upcoming = upNew;
  if (!(change.added.length + change.seasons.length)) { data.rev = new Date().toISOString(); fs.writeFileSync(FILE, JSON.stringify(data)); }
}

const changed = change.added.length + change.seasons.length + identityUpdates > 0;
log(`\nSonuç: ${change.added.length} yeni yapım, ${change.seasons.length} sezon güncellemesi.`);
if (changed && !DRY) {
  const prev = (data.changes || []).find((c) => c.date === TODAY);
  if (prev) { prev.added.push(...change.added); prev.seasons.push(...change.seasons); }
  else data.changes = [change, ...(data.changes || [])].slice(0, 20);
  data.updated = TODAY;
  data.rev = new Date().toISOString();
  fs.writeFileSync(FILE, JSON.stringify(data));
  log('Katalog kaydedildi.');
}
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
