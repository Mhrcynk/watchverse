#!/usr/bin/env node
/**
 * Ana sayfa ve Keşfet'teki koleksiyonları hazırlar, ara sunucuya (Cloudflare KV, "collections") yazar.
 *  - Ödül listeleri Wikidata'daki resmî ödül kayıtlarından gelir (yalnızca kazananlar; adaylıklar değil):
 *    Oscar En İyi Film, Emmy En İyi Drama / Komedi Dizisi, Cannes Altın Palmiye.
 *  - Diğerleri TMDB'den: klasikler, gizli hazineler, mini diziler, gerçek hikâyeler, kitap uyarlamaları.
 * Her gün çalışır; son yazımdan bu yana 20 saat geçmediyse (FORCE yoksa) hiçbir şey yapmaz.
 * Gerekenler: TMDB_TOKEN, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
 */
const { TMDB_TOKEN, CLOUDFLARE_API_TOKEN: CF, CLOUDFLARE_ACCOUNT_ID: ACC, FORCE } = process.env;
if (!TMDB_TOKEN || !CF || !ACC) { console.log('::warning::Anahtarlar eksik; koleksiyonlar hazırlanmadı.'); process.exit(0); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = { 'user-agent': 'WatchVerse/1.0 (watchverse.destek@gmail.com) collections builder', accept: 'application/json' };
async function tmdb(path, params = {}) {
  const u = new URL('https://api.themoviedb.org/3' + path);
  for (const [k, v] of Object.entries({ language: 'tr-TR', ...params })) if (v !== undefined) u.searchParams.set(k, String(v));
  for (let i = 0; i < 4; i++) {
    const r = await fetch(u, { headers: { Authorization: `Bearer ${TMDB_TOKEN}`, accept: 'application/json' } });
    if (r.status === 429) { await sleep(1500); continue; }
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`TMDB ${r.status} ${path}`);
    return r.json();
  }
  return null;
}
async function pool(items, n, fn) { const q = [...items]; await Promise.all(Array.from({ length: n }, async () => { for (let x = q.shift(); x !== undefined; x = q.shift()) await fn(x); })); }
const slim = (r, m, note) => ({
  id: r.id, m, title: (m === 'movie' ? r.title : r.name) || '', orig: (m === 'movie' ? r.original_title : r.original_name) || '',
  date: (m === 'movie' ? r.release_date : r.first_air_date) || null, p: r.poster_path || null, b: r.backdrop_path || null,
  vote: r.vote_average || 0, votes: r.vote_count || 0, overview: (r.overview || '').slice(0, 300), lang: r.original_language || '', ...(note ? { note } : {}),
});

/* ---------- Cloudflare KV ---------- */
const CFAPI = (p, init = {}) => fetch(`https://api.cloudflare.com/client/v4/accounts/${ACC}${p}`, { ...init, headers: { Authorization: `Bearer ${CF}`, ...(init.headers || {}) } });
const ns = (await (await CFAPI('/storage/kv/namespaces?per_page=100')).json()).result?.find((n) => n.title === 'watchverse-data') || null;
if (!ns) { console.log('::warning::KV bulunamadı; koleksiyonlar yazılmadı.'); process.exit(0); }
const kvGet = async (k) => { const r = await CFAPI(`/storage/kv/namespaces/${ns.id}/values/${k}`); return r.ok ? r.json().catch(() => null) : null; };
const kvPut = (k, v) => CFAPI(`/storage/kv/namespaces/${ns.id}/values/${k}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(v) });
const old = await kvGet('collections');
if (!FORCE && old?.updated && Date.now() - Date.parse(old.updated) < 20 * 3600e3) { console.log('Koleksiyonlar güncel; atlandı.'); process.exit(0); }

/* ---------- Wikidata ödülleri ---------- */
async function qidOf(label, mustInclude) {
  const u = new URL('https://www.wikidata.org/w/api.php');
  for (const [k, v] of Object.entries({ action: 'wbsearchentities', search: label, language: 'en', type: 'item', limit: '10', format: 'json' })) u.searchParams.set(k, v);
  const j = await (await fetch(u, { headers: UA })).json();
  const hit = (j.search || []).find((x) => (x.label || '').toLowerCase() === label.toLowerCase()) || (j.search || []).find((x) => (x.label || '').toLowerCase().includes(mustInclude));
  return hit?.id || null;
}
/** Ödülü kazanan yapımların TMDB kimlikleri ve ödül yılı (en yeni önce) */
async function winners(qid, m) {
  const prop = m === 'movie' ? 'P4947' : 'P4983';
  const q = `SELECT ?tmdb (MAX(YEAR(?t)) AS ?y) WHERE { ?item p:P166 ?st. ?st ps:P166 wd:${qid}. OPTIONAL { ?st pq:P585 ?t } ?item wdt:${prop} ?tmdb. } GROUP BY ?tmdb`;
  const u = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`;
  for (let i = 0; i < 3; i++) {
    const r = await fetch(u, { headers: { ...UA, accept: 'application/sparql-results+json' } });
    if (r.status === 429) { await sleep(5000); continue; }
    if (!r.ok) throw new Error(`Wikidata ${r.status}`);
    const j = await r.json();
    return (j.results?.bindings || []).map((b) => ({ id: Number(b.tmdb.value), y: b.y ? Number(b.y.value) : null })).filter((x) => x.id > 0).sort((a, b) => (b.y || 0) - (a.y || 0));
  }
  return [];
}
async function hydrate(list, m, max = 120) {
  const out = new Array(list.length);
  await pool(list.slice(0, max).map((x, i) => ({ ...x, i })), 4, async (x) => {
    const r = await tmdb(`/${m}/${x.id}`).catch(() => null);
    if (r && r.poster_path) out[x.i] = slim(r, m, x.y ? String(x.y) : null);
  });
  return out.filter(Boolean);
}

const report = [];
const collections = [];
const AWARDS = [
  { id: 'oscar', title: "Oscar'lı filmler", sub: 'Akademi Ödülleri · En İyi Film', label: 'Academy Award for Best Picture', must: 'best picture', m: 'movie' },
  { id: 'emmy-drama', title: "Emmy'li diziler", sub: 'Emmy · En İyi Drama Dizisi', label: 'Primetime Emmy Award for Outstanding Drama Series', must: 'outstanding drama series', m: 'tv' },
  { id: 'emmy-comedy', title: "Emmy'li komediler", sub: 'Emmy · En İyi Komedi Dizisi', label: 'Primetime Emmy Award for Outstanding Comedy Series', must: 'outstanding comedy series', m: 'tv' },
  { id: 'palme', title: 'Altın Palmiye', sub: 'Cannes Film Festivali · En iyi film', label: "Palme d'Or", must: 'palme', m: 'movie' },
];
for (const a of AWARDS) {
  try {
    const qid = await qidOf(a.label, a.must);
    if (!qid) { report.push(`${a.id}: ödül bulunamadı`); continue; }
    const w = await winners(qid, a.m);
    const items = await hydrate(w, a.m);
    report.push(`${a.id} (${qid}): ${items.length}/${w.length}`);
    if (items.length >= 8) collections.push({ id: a.id, title: a.title, sub: a.sub, kind: 'award', source: 'Wikidata', items });
    await sleep(800);
  } catch (e) { report.push(`${a.id}: hata ${e.message}`); }
}

/* ---------- TMDB listeleri ---------- */
async function keywordId(name) {
  const r = await tmdb('/search/keyword', { query: name, language: undefined });
  return (r?.results || []).find((x) => x.name.toLowerCase() === name.toLowerCase())?.id || null;
}
async function discover(m, params, pages = 2) {
  const out = [];
  for (let page = 1; page <= pages; page++) {
    const r = await tmdb(`/discover/${m}`, { include_adult: false, without_genres: m === 'movie' ? '99' : '99,10767,10763,10764', ...params, page });
    for (const x of r?.results || []) if (x.poster_path) out.push(slim(x, m));
    if (!r || page >= r.total_pages) break;
  }
  return out;
}
/** Filmler ve diziler dönüşümlü */
const mix = (a, b) => { const out = []; for (let i = 0; i < Math.max(a.length, b.length); i++) { if (a[i]) out.push(a[i]); if (b[i]) out.push(b[i]); } return out; };
const year = new Date().getFullYear();
try {
  const classics = await discover('movie', { 'primary_release_date.lte': '1979-12-31', 'vote_count.gte': 1500, sort_by: 'vote_average.desc' }, 3);
  collections.push({ id: 'classics', title: 'Klasikler', sub: "1980 öncesinin en sevilen filmleri", kind: 'tmdb', source: 'TMDB', items: classics });
  const gemsM = await discover('movie', { 'vote_average.gte': 7.4, 'vote_count.gte': 200, 'vote_count.lte': 1500, 'primary_release_date.gte': `${year - 15}-01-01`, sort_by: 'vote_average.desc' });
  const gemsT = await discover('tv', { 'vote_average.gte': 7.8, 'vote_count.gte': 150, 'vote_count.lte': 1200, 'first_air_date.gte': `${year - 15}-01-01`, sort_by: 'vote_average.desc' });
  collections.push({ id: 'gems', title: 'Gizli hazineler', sub: 'Puanı yüksek ama az bilinen yapımlar', kind: 'tmdb', source: 'TMDB', items: mix(gemsM, gemsT) });
  // Mini diziler: TMDB "Miniseries" türü; 10 bölüm ve altı
  const mini = await discover('tv', { with_type: 2, 'vote_count.gte': 300, sort_by: 'vote_average.desc' }, 3);
  const short = [];
  await pool(mini.map((x, i) => ({ x, i })), 4, async ({ x, i }) => { const d = await tmdb(`/tv/${x.id}`, { language: undefined }).catch(() => null); if (d && d.number_of_episodes && d.number_of_episodes <= 10) short[i] = { ...x, note: `${d.number_of_episodes} bölüm` }; });
  collections.push({ id: 'mini', title: 'Bir haftasonunda biter', sub: 'Tek sezonluk, 10 bölüm ve altı mini diziler', kind: 'tmdb', source: 'TMDB', items: short.filter(Boolean) });
  for (const [id, title, sub, kw] of [['true', 'Gerçek hikâyeler', 'Gerçek olaylara dayanan yapımlar', 'based on true story'], ['novel', 'Kitaptan uyarlamalar', 'Roman ve kitaplardan uyarlananlar', 'based on novel or book']]) {
    const k = await keywordId(kw);
    if (!k) { report.push(`${id}: anahtar kelime yok`); continue; }
    const [mv, tv] = await Promise.all([discover('movie', { with_keywords: k, 'vote_count.gte': 1500, sort_by: 'vote_average.desc' }), discover('tv', { with_keywords: k, 'vote_count.gte': 400, sort_by: 'vote_average.desc' })]);
    collections.push({ id, title, sub, kind: 'tmdb', source: 'TMDB', items: mix(mv, tv) });
    report.push(`${id} (#${k}): ${mv.length}+${tv.length}`);
  }
} catch (e) { report.push(`tmdb: hata ${e.message}`); }

const data = { updated: new Date().toISOString(), collections: collections.filter((c) => c.items.length >= 8) };
const w = await kvPut('collections', data);
console.log(`::notice::Koleksiyonlar (${w.ok ? 'yazıldı' : 'YAZILAMADI ' + w.status}, ${(JSON.stringify(data).length / 1024).toFixed(0)} KB): ${data.collections.map((c) => `${c.id}=${c.items.length}`).join(', ')} || ${report.join(' | ')} || ilkler: ${data.collections.map((c) => `${c.id}: ${c.items.slice(0, 3).map((x) => x.title).join(', ')}`).join(' ; ')}`);
