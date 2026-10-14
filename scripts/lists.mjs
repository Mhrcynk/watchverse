#!/usr/bin/env node
/**
 * Ana sayfadaki platform listelerini hazırlar ve ara sunucuya (Cloudflare KV) yazar.
 * Uygulama bu listeleri sunucudan okur; yeniden yayın gerekmeden her gün güncellenir.
 *  - Netflix: Netflix'in resmî Türkiye haftalık İlk 10 listesi (dizi ve film)
 *  - Diğer platformlar: Türkiye'de o platformda abonelikle izlenebilen yapımlar,
 *    TMDB/JustWatch popülerliğine göre. Birden çok platformda olanlar kendi listesinde öne çıkmaz.
 * Gerekenler: TMDB_TOKEN, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
 */
const { TMDB_TOKEN, CLOUDFLARE_API_TOKEN: CF, CLOUDFLARE_ACCOUNT_ID: ACC } = process.env;
if (!TMDB_TOKEN) { console.log('::warning::TMDB_TOKEN yok; listeler hazırlanmadı.'); process.exit(0); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function tmdb(path, params = {}) {
  const u = new URL('https://api.themoviedb.org/3' + path);
  for (const [k, v] of Object.entries({ language: 'tr-TR', ...params })) if (v !== undefined) u.searchParams.set(k, String(v));
  for (let i = 0; i < 3; i++) {
    const r = await fetch(u, { headers: { Authorization: `Bearer ${TMDB_TOKEN}`, accept: 'application/json' } });
    if (r.status === 429) { await sleep(1500); continue; }
    if (!r.ok) throw new Error(`TMDB ${r.status} ${path}`);
    return r.json();
  }
  throw new Error('TMDB sınır');
}
const slim = (r, m) => ({
  id: r.id, m, title: (m === 'movie' ? r.title : r.name) || '', orig: (m === 'movie' ? r.original_title : r.original_name) || '',
  date: (m === 'movie' ? r.release_date : r.first_air_date) || null, p: r.poster_path || null, b: r.backdrop_path || null,
  vote: r.vote_average || 0, votes: r.vote_count || 0, overview: (r.overview || '').slice(0, 400), lang: r.original_language || '',
});

/* ---------- platformlar ---------- */
const WANT = [
  ['Netflix', /^netflix$/i, "Netflix'te"], ['Disney+', /^disney plus$/i, "Disney+'ta"], ['Prime Video', /^amazon prime video$/i, "Prime Video'da"],
  ['HBO Max', /^(hbo )?max$|^hbo max$/i, "HBO Max'te"], ['Apple TV+', /^apple tv\+?$|^apple tv plus$/i, "Apple TV+'ta"], ['TOD', /^tod$/i, "TOD'da"],
  ['Exxen', /^exxen$/i, "Exxen'de"], ['tabii', /^tabii$/i, "tabii'de"], ['Gain', /^gain$/i, "Gain'de"], ['BluTV', /^blutv$/i, "BluTV'de"],
];
async function providerIds() {
  const [tv, mv] = await Promise.all([tmdb('/watch/providers/tv', { watch_region: 'TR' }), tmdb('/watch/providers/movie', { watch_region: 'TR' })]);
  const all = [...(tv.results || []), ...(mv.results || [])];
  const out = [];
  for (const [name, re, at] of WANT) {
    const p = all.find((x) => re.test(x.provider_name.trim()));
    if (p && !out.some((o) => o.id === p.provider_id)) out.push({ id: p.provider_id, name, at });
  }
  return out;
}
async function popularOn(pid, m) {
  const res = [];
  for (const page of [1, 2]) {
    const j = await tmdb(`/discover/${m}`, { watch_region: 'TR', with_watch_providers: pid, with_watch_monetization_types: 'flatrate', sort_by: 'popularity.desc', include_adult: 'false', 'vote_count.gte': m === 'movie' ? 30 : 10, page });
    res.push(...(j.results || []).filter((r) => r.poster_path).map((r) => slim(r, m)));
  }
  return res;
}

/* ---------- Netflix resmî İlk 10 ---------- */
function parseTsv(text) {
  const [head, ...rows] = text.trim().split(/\r?\n/);
  const cols = head.split('\t');
  return rows.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cols[i], v])));
}
async function netflixTop10() {
  const r = await fetch('https://www.netflix.com/tudum/top10/data/all-weeks-countries.tsv', { headers: { 'user-agent': 'Mozilla/5.0 WatchVerse' } });
  if (!r.ok) throw new Error('Netflix verisi ' + r.status);
  const rows = parseTsv(await r.text()).filter((x) => x.country_iso2 === 'TR');
  const week = rows.map((x) => x.week).sort().pop();
  const cur = rows.filter((x) => x.week === week).sort((a, b) => Number(a.weekly_rank) - Number(b.weekly_rank));
  const pick = async (cat, m) => {
    const out = [];
    for (const x of cur.filter((y) => (m === 'tv' ? /tv/i.test(y.category) : /film/i.test(y.category)))) {
      const q = x.show_title || x.season_title;
      const j = await tmdb(`/search/${m}`, { query: q, include_adult: 'false' });
      const exact = (j.results || []).find((r) => [r.name, r.title, r.original_name, r.original_title].some((t) => t && t.toLowerCase() === q.toLowerCase()));
      const hit = exact || (j.results || [])[0];
      if (hit) out.push({ ...slim(hit, m), rank: Number(x.weekly_rank), label: x.season_title && x.season_title !== 'N/A' ? x.season_title : null });
    }
    return out;
  };
  return { week, tv: await pick('TV', 'tv'), movie: await pick('Films', 'movie') };
}

/* ---------- çalıştır ---------- */
const plats = await providerIds();
const lists = [];
for (const p of plats) {
  const [tv, movie] = await Promise.all([popularOn(p.id, 'tv'), popularOn(p.id, 'movie')]);
  lists.push({ ...p, tv, movie });
}
// Birden çok platformda bulunanlar: kendi listesine özgü olanlar öne
for (const m of ['tv', 'movie']) {
  const count = new Map();
  for (const l of lists) for (const x of l[m]) count.set(x.id, (count.get(x.id) || 0) + 1);
  for (const l of lists) l[m] = l[m].map((x, i) => ({ x, s: i + (count.get(x.id) > 1 ? 12 : 0) })).sort((a, b) => a.s - b.s).map((y) => y.x).slice(0, 20);
}
let netflix = null;
try { netflix = await netflixTop10(); } catch (e) { console.log('::warning::Netflix resmî İlk 10 alınamadı: ' + e.message); }

const data = { updated: new Date().toISOString(), netflix, platforms: lists.filter((l) => l.tv.length + l.movie.length >= 6) };

// Özet: göz kontrolü için
const top = (arr) => arr.slice(0, 4).map((x) => x.title).join(', ');
console.log(`::notice::Listeler: ${data.platforms.map((l) => `${l.name} [dizi: ${top(l.tv)}] [film: ${top(l.movie)}]`).join(' || ')}`);
if (netflix) console.log(`::notice::Netflix TR İlk 10 (${netflix.week}) dizi: ${top(netflix.tv)} | film: ${top(netflix.movie)}`);
for (const m of ['tv', 'movie']) {
  const sets = data.platforms.map((l) => new Set(l[m].slice(0, 10).map((x) => x.id)));
  let shared = 0, pairs = 0;
  for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) { pairs++; shared += [...sets[i]].filter((x) => sets[j].has(x)).length; }
  console.log(`::notice::${m === 'tv' ? 'Dizi' : 'Film'} listelerinde ilk 10'da ortak yapım ortalaması: ${(shared / Math.max(1, pairs)).toFixed(1)}`);
}

// Ara sunucuya yaz
if (!CF || !ACC) { console.log('::warning::Cloudflare bilgileri yok; listeler sunucuya yazılmadı.'); process.exit(0); }
const api = (p, init = {}) => fetch(`https://api.cloudflare.com/client/v4/accounts/${ACC}${p}`, { ...init, headers: { Authorization: `Bearer ${CF}`, ...(init.headers || {}) } });
const ns = (await (await api('/storage/kv/namespaces?per_page=100')).json()).result?.find((n) => n.title === 'watchverse-data');
if (!ns) { console.log('::warning::Depolama alanı bulunamadı; önce ara sunucu kurulmalı.'); process.exit(0); }
const w = await api(`/storage/kv/namespaces/${ns.id}/values/lists`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
console.log(w.ok ? `Listeler yazıldı (${(JSON.stringify(data).length / 1024).toFixed(0)} KB).` : `::warning::Listeler yazılamadı (${w.status})`);
