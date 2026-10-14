#!/usr/bin/env node
/**
 * Ana sayfadaki platform listelerini hazırlar ve ara sunucuya (Cloudflare KV) yazar.
 * Uygulama bu listeleri sunucudan okur; yeniden yayın gerekmeden her gün güncellenir.
 *  - Netflix: Netflix'in resmî Türkiye haftalık İlk 10 verisi; son 4 hafta birleştirilir (izlenme sırasına göre).
 *  - Diğer platformlar: izleme verisi yayınlanmıyor. Türkiye'de o platformda abonelikle izlenebilen yapımların
 *    TMDB/JustWatch ilgisi her gün kaydedilir, son 30 günün ortalamasıyla sıralanır.
 *    Birden çok platformda olanlar kendi listesinde öne çıkmaz.
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
// Türkiye'de hizmet veren abonelik platformları (TMDB/JustWatch adlarıyla eşleşir)
const WANT = [
  ['Netflix', ['netflix'], "Netflix'te"], ['Disney+', ['disneyplus'], "Disney+'ta"], ['Prime Video', ['amazonprimevideo', 'primevideo'], "Prime Video'da"],
  ['HBO Max', ['hbomax', 'max'], "HBO Max'te"], ['Apple TV+', ['appletvplus', 'appletv'], "Apple TV+'ta"], ['TOD', ['tod', 'todtv'], "TOD'da"],
  ['Exxen', ['exxen'], "Exxen'de"], ['tabii', ['tabii'], "tabii'de"], ['Gain', ['gain'], "Gain'de"], ['MUBI', ['mubi'], "MUBI'de"],
  ['puhutv', ['puhutv'], "puhutv'de"], ['TV+', ['tvplus'], "TV+'ta"], ['Tivibu', ['tivibu'], "Tivibu'da"], ['Crunchyroll', ['crunchyroll'], "Crunchyroll'da"],
  ['BluTV', ['blutv'], "BluTV'de"],
];
const norm = (n) => n.toLowerCase().replace(/\+/g, 'plus').replace(/[^a-z0-9]/g, '');
async function providerIds() {
  const [tv, mv] = await Promise.all([tmdb('/watch/providers/tv', { watch_region: 'TR' }), tmdb('/watch/providers/movie', { watch_region: 'TR' })]);
  const all = [...(tv.results || []), ...(mv.results || [])];
  console.log(`::notice::TMDB'de Turkiye platformlari: ${[...new Set(all.map((x) => x.provider_name))].join(', ')}`);
  const out = [];
  for (const [name, keys, at] of WANT) {
    const p = keys.map((k) => all.find((x) => norm(x.provider_name) === k)).find(Boolean);
    if (p && !out.some((o) => o.id === p.provider_id)) out.push({ id: p.provider_id, name, at, logo: p.logo_path || null });
  }
  return out;
}
async function popularOn(pid, m) {
  const res = [];
  for (const page of [1, 2, 3]) {
    const j = await tmdb(`/discover/${m}`, { watch_region: 'TR', with_watch_providers: pid, with_watch_monetization_types: 'flatrate', sort_by: 'popularity.desc', include_adult: 'false', 'vote_count.gte': m === 'movie' ? 3 : 1, page });
    res.push(...(j.results || []).filter((r) => r.poster_path).map((r) => slim(r, m)));
    if ((j.total_pages || 1) <= page) break;
  }
  return res;
}

/* ---------- Türkçe Wikipedia ilgisi (son 30 gün) ---------- */
const UA = { 'user-agent': 'WatchVerse/1.0 (watchverse.destek@gmail.com) list builder' };
async function pool(items, n, fn) { const q = [...items]; await Promise.all(Array.from({ length: n }, async () => { for (let x = q.shift(); x !== undefined; x = q.shift()) await fn(x); })); }
/** TMDB → Wikidata → Türkçe Wikipedia sayfa adı (önbellekli; sayfası yoksa '') */
const diag = { keys: 0, qid: 0, site: 0, views: 0, err: '' };
async function trwikiTitles(keys, cache) {
  const need = keys.filter((k) => cache[k] === undefined || cache[k] === '');
  diag.keys = need.length;
  const qid = {};
  await pool(need, 8, async (k) => {
    const [m, id] = k.split(':');
    try { const j = await tmdb(`/${m}/${id}/external_ids`, { language: undefined }); qid[k] = j.wikidata_id || null; if (qid[k]) diag.qid++; } catch (e) { qid[k] = null; diag.err ||= 'tmdb ' + e.message; }
  });
  const ids = [...new Set(Object.values(qid).filter(Boolean))];
  const site = {};
  for (let i = 0; i < ids.length; i += 50) {
    const u = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=sitelinks&sitefilter=trwiki&ids=${ids.slice(i, i + 50).join('|')}`;
    try {
      const r = await fetch(u, { headers: UA });
      if (!r.ok) { diag.err ||= 'wikidata ' + r.status; continue; }
      const j = await r.json();
      for (const [q, e] of Object.entries(j.entities || {})) { site[q] = e.sitelinks?.trwiki?.title || ''; if (site[q]) diag.site++; }
    } catch (e) { diag.err ||= 'wikidata ' + e.message; }
  }
  for (const k of need) cache[k] = qid[k] ? site[qid[k]] ?? '' : '';
  return cache;
}
const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
async function pageviews(titles) {
  const end = new Date(Date.now() - 864e5), start = new Date(Date.now() - 30 * 864e5);
  const out = {};
  await pool([...new Set(titles)].filter(Boolean), 6, async (t) => {
    const u = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/tr.wikipedia/all-access/user/${encodeURIComponent(t.replace(/ /g, '_'))}/daily/${ymd(start)}/${ymd(end)}`;
    try {
      const r = await fetch(u, { headers: UA });
      if (!r.ok && r.status !== 404) diag.err ||= 'pageviews ' + r.status;
      out[t] = r.ok ? ((await r.json()).items || []).reduce((n, x) => n + x.views, 0) : 0;
      if (out[t]) diag.views++;
    } catch (e) { out[t] = 0; diag.err ||= 'pageviews ' + e.message; }
  });
  return out;
}

/* ---------- Netflix resmî İlk 10 ---------- */
function parseTsv(text) {
  const [head, ...rows] = text.trim().split(/\r?\n/);
  const cols = head.split('\t');
  return rows.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cols[i], v])));
}
async function netflixMonth() {
  const r = await fetch('https://www.netflix.com/tudum/top10/data/all-weeks-countries.tsv', { headers: { 'user-agent': 'Mozilla/5.0 WatchVerse' } });
  if (!r.ok) throw new Error('Netflix verisi ' + r.status);
  const rows = parseTsv(await r.text()).filter((x) => x.country_iso2 === 'TR');
  const weeks = [...new Set(rows.map((x) => x.week))].sort().slice(-4);
  // Her haftada 1. sıra 10 puan, 10. sıra 1 puan; yeni haftalar biraz daha ağır
  const score = new Map();
  for (const x of rows.filter((y) => weeks.includes(y.week))) {
    const m = /tv/i.test(x.category) ? 'tv' : 'movie';
    const title = x.show_title || x.season_title;
    const k = m + '|' + title;
    const w = 1 + weeks.indexOf(x.week) * 0.15;
    const cur = score.get(k) || { m, title, s: 0, weeks: 0 };
    cur.s += (11 - Number(x.weekly_rank)) * w; cur.weeks++;
    score.set(k, cur);
  }
  const ranked = [...score.values()].sort((a, b) => b.s - a.s);
  const out = [];
  for (const x of ranked) {
    const j = await tmdb(`/search/${x.m}`, { query: x.title, include_adult: 'false' });
    const exact = (j.results || []).find((r) => [r.name, r.title, r.original_name, r.original_title].some((t) => t && t.toLowerCase() === x.title.toLowerCase()));
    const hit = exact || (j.results || [])[0];
    if (hit && hit.poster_path) out.push({ ...slim(hit, x.m), score: Math.round(x.s), weeks: x.weeks });
  }
  return { weeks, items: out };
}

/* ---------- çalıştır ---------- */
const CFAPI = (p, init = {}) => fetch(`https://api.cloudflare.com/client/v4/accounts/${ACC}${p}`, { ...init, headers: { Authorization: `Bearer ${CF}`, ...(init.headers || {}) } });
let ns = null;
if (CF && ACC) ns = (await (await CFAPI('/storage/kv/namespaces?per_page=100')).json()).result?.find((n) => n.title === 'watchverse-data') || null;
const kvGet = async (k) => { if (!ns) return null; const r = await CFAPI(`/storage/kv/namespaces/${ns.id}/values/${k}`); return r.ok ? r.json().catch(() => null) : null; };
const kvPut = (k, v) => CFAPI(`/storage/kv/namespaces/${ns.id}/values/${k}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(v) });

const plats = await providerIds();
const today = new Date().toISOString().slice(0, 10);
// Geçmiş: { days: { '2026-10-14': { [pid]: { tv: [id…], movie: [id…] } } }, meta: { 'tv:1': slim } }
const hist = (await kvGet('lists-history')) || { days: {}, meta: {} };
hist.days[today] = {};
for (const p of plats) {
  const [tv, movie] = await Promise.all([popularOn(p.id, 'tv'), popularOn(p.id, 'movie')]);
  hist.days[today][p.id] = { tv: tv.map((x) => x.id), movie: movie.map((x) => x.id) };
  for (const x of [...tv, ...movie]) hist.meta[`${x.m}:${x.id}`] = x;
}
const days = Object.keys(hist.days).sort().slice(-30);
hist.days = Object.fromEntries(days.map((d) => [d, hist.days[d]]));

// Son 30 günün ortalama sırası: her gün 1. sıra 60 puan; listede olmadığı gün 0
const lists = plats.map((p) => {
  const out = { ...p, tv: [], movie: [], items: [] };
  for (const m of ['tv', 'movie']) {
    const sc = new Map();
    for (const d of days) (hist.days[d][p.id]?.[m] || []).forEach((id, i) => sc.set(id, (sc.get(id) || 0) + (60 - i)));
    out[m] = [...sc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60).map(([id, s]) => ({ ...hist.meta[`${m}:${id}`], tmdbScore: s / days.length })).filter((x) => x.id);
  }
  return out;
});
// Türkçe Wikipedia: son 30 günün görüntülenmesi (Türkiye'deki ilgi için en yakın açık veri)
hist.wiki = hist.wiki || {};
const allKeys = [...new Set(lists.flatMap((l) => [...l.tv, ...l.movie].map((x) => `${x.m}:${x.id}`)))];
let wikiOk = 0;
try {
  await trwikiTitles(allKeys, hist.wiki);
  const views = await pageviews(allKeys.map((k) => hist.wiki[k]));
  for (const l of lists) for (const m of ['tv', 'movie']) {
    const maxT = Math.max(1, ...l[m].map((x) => x.tmdbScore));
    const maxW = Math.max(1, ...l[m].map((x) => Math.log1p(views[hist.wiki[`${m}:${x.id}`]] || 0)));
    for (const x of l[m]) {
      const v = views[hist.wiki[`${m}:${x.id}`]] || 0;
      if (v) wikiOk++;
      x.views = v;
      x.score = 0.4 * (x.tmdbScore / maxT) + 0.6 * (Math.log1p(v) / maxW);
    }
    l[m].sort((a, b) => b.score - a.score);
  }
} catch (e) {
  console.log('::warning::Wikipedia verisi alınamadı: ' + e.message);
  for (const l of lists) for (const m of ['tv', 'movie']) for (const x of l[m]) x.score = x.tmdbScore;
}
for (const l of lists) for (const m of ['tv', 'movie']) for (const x of l[m]) { delete x.tmdbScore; x.score = Math.round((x.score || 0) * 1000); }
// Başka platformlarda da olanlar kendi listesinde geri düşer
for (const m of ['tv', 'movie']) {
  const count = new Map();
  for (const l of lists) for (const x of l[m].slice(0, 40)) count.set(x.id, (count.get(x.id) || 0) + 1);
  for (const l of lists) l[m] = l[m].map((x, i) => ({ x, s: i + (count.get(x.id) > 1 ? 15 : 0) })).sort((a, b) => a.s - b.s).map((y) => y.x).slice(0, 20);
}
// Hepsi: dizi ve filmler sırayla harmanlanır
for (const l of lists) { l.items = []; for (let i = 0; i < 20; i++) { if (l.tv[i]) l.items.push(l.tv[i]); if (l.movie[i]) l.items.push(l.movie[i]); } l.items = l.items.slice(0, 24); }

// Netflix: resmî son 4 hafta
let netflixMeta = null;
try {
  const nf = await netflixMonth();
  const l = lists.find((x) => x.name === 'Netflix');
  if (l && nf.items.length >= 6) {
    l.items = nf.items.slice(0, 24);
    l.tv = nf.items.filter((x) => x.m === 'tv').slice(0, 20);
    l.movie = nf.items.filter((x) => x.m === 'movie').slice(0, 20);
    l.source = 'netflix';
    netflixMeta = { weeks: nf.weeks };
  }
} catch (e) { console.log('::warning::Netflix resmî verisi alınamadı: ' + e.message); }
for (const l of lists) if (!l.source) l.source = 'tmdb';

const data = { updated: new Date().toISOString(), days: days.length, wiki: wikiOk > 0, netflix: netflixMeta, platforms: lists.filter((l) => l.items.length >= 6) };
const top = (arr) => arr.slice(0, 5).map((x) => x.title).join(', ');
console.log(`::notice::Wikipedia: ${JSON.stringify(diag)}`);
console.log(`::notice::Listeler (${days.length} günlük, Wikipedia eşleşen ${wikiOk}): ${data.platforms.map((l) => `${l.name}: ${top(l.items)}`).join(' || ')}`);

if (!ns) { console.log('::warning::Cloudflare bilgileri ya da depolama alanı yok; listeler sunucuya yazılmadı.'); process.exit(0); }
const w1 = await kvPut('lists', data);
const w2 = await kvPut('lists-history', hist);
console.log(w1.ok && w2.ok ? `Listeler yazıldı (${(JSON.stringify(data).length / 1024).toFixed(0)} KB, geçmiş ${(JSON.stringify(hist).length / 1024).toFixed(0)} KB).` : `::warning::Listeler yazılamadı (${w1.status}/${w2.status})`);
