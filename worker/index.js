import catalog from '../src/data/catalog.json';
const ALLOW = [
  /^\/search\/(multi|movie|tv)$/,
  /^\/(movie|tv)\/\d+$/,
  /^\/(movie|tv)\/\d+\/(watch\/providers|videos|recommendations|credits|images)$/,
  /^\/search\/company$/,
  /^\/person\/\d+$/,
  /^\/tv\/\d+\/season\/\d+$/,
  /^\/trending\/(all|movie|tv)\/(day|week)$/,
  /^\/discover\/(movie|tv)$/,
  /^\/(movie|tv)\/(popular|top_rated|now_playing|upcoming|on_the_air|airing_today)$/,
  /^\/genre\/(movie|tv)\/list$/,
  /^\/watch\/providers\/(movie|tv)$/,
];
const TTL = (p) => (/trending|popular|now_playing|airing|on_the_air|discover/.test(p) ? 1800 : /season|\/tv\/\d+$/.test(p) ? 3600 : 21600);
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type, x-admin' };
const json = (o, status = 200, extra = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...CORS, ...extra } });

export async function adminKey(token) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${token}|watchverse-admin`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function tmdb(url, env, ctx) {
  const path = url.pathname.slice(5);
  if (!ALLOW.some((re) => re.test(path))) return json({ error: 'izin verilmeyen istek' }, 404);
  const t = new URL('https://api.themoviedb.org/3' + path);
  for (const [k, v] of url.searchParams) if (k !== 'api_key') t.searchParams.set(k, v);
  if (!t.searchParams.has('language')) t.searchParams.set('language', 'tr-TR');
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const key = new Request(t.toString());
  let res = cache ? await cache.match(key) : null;
  if (!res) {
    const r = await fetch(t, { headers: { Authorization: `Bearer ${env.TMDB_TOKEN}`, accept: 'application/json' } });
    res = new Response(r.body, { status: r.status, headers: { 'content-type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${TTL(path)}` } });
    if (r.ok && cache) ctx?.waitUntil?.(cache.put(key, res.clone()));
  }
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
  return out;
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      if (url.pathname === '/catalog.json' && req.method === 'GET') return json(catalog, 200, { 'Cache-Control': 'public, max-age=1800' });
      if (url.pathname.startsWith('/tmdb/') && req.method === 'GET') return await tmdb(url, env, ctx);
      if (url.pathname === '/sync' || url.pathname === '/devices') return json({ error: 'web bildirim servisi kaldırıldı' }, 410);
      if ((url.pathname === '/lists' || url.pathname === '/collections') && req.method === 'GET') {
        const v = await env.WV.get(url.pathname.slice(1));
        return v ? new Response(v, { headers: { 'content-type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${url.pathname === '/lists' ? 60 : 600}`, ...CORS } }) : json({ error: 'yok' }, 404);
      }

      if (url.pathname === '/') return json({ ok: true, name: 'watchverse' });
      return json({ error: 'bulunamadı' }, 404);
    } catch (e) {
      return json({ error: 'sunucu hatası' }, 500);
    }
  },
};
