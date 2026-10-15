/**
 * WatchVerse ara sunucusu (Cloudflare Worker)
 * - /tmdb/...  : TMDB isteklerini gizli anahtarla iletir
 * - /sync      : cihazın bildirim aboneliğini Supabase'e, takip listelerini KV'ye kaydeder
 * - /devices   : günlük bildirim görevi için kayıtlı cihazlar (Supabase tablosundan)
 * Gizli değerler: TMDB_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (Cloudflare secrets). Depolama: WV (KV).
 */
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

// Push addresses are capabilities. Never log them or database credentials.
const dbReady = (env) => !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
async function database(env, query, init = {}) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/push_subscriptions${query}`, {
    ...init,
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(`push database status ${r.status}`);
  return r;
}
function validSubscription(sub) {
  try {
    const u = new URL(sub.endpoint);
    const host = u.hostname;
    const provider = host === 'web.push.apple.com' || host.endsWith('.push.apple.com') ||
      host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com' ||
      host.endsWith('.notify.windows.com');
    return provider && u.protocol === 'https:' && !u.username && !u.password && !u.port &&
      sub.endpoint.length <= 4096 && /^[A-Za-z0-9_-]{87}=?$/.test(sub.keys?.p256dh || '') &&
      /^[A-Za-z0-9_-]{22}={0,2}$/.test(sub.keys?.auth || '');
  } catch { return false; }
}
async function sync(req, env) {
  if (!dbReady(env) || !env.SYNC_LIMITER) return json({ error: 'bildirim servisi hazır değil' }, 503);
  // Cloudflare supplies this header; never use a client-controlled device id as the only quota key.
  const { success } = await env.SYNC_LIMITER.limit({ key: req.headers.get('CF-Connecting-IP') || 'unknown' });
  if (!success) return json({ error: 'çok sık istek' }, 429, { 'Retry-After': '60' });
  const reader = req.body?.getReader();
  if (!reader) return json({ error: 'okunamadı' }, 400);
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 60000) { await reader.cancel(); return json({ error: 'çok büyük' }, 413); }
    chunks.push(value);
  }
  let b; try { b = JSON.parse(await new Blob(chunks).text()); } catch { return json({ error: 'okunamadı' }, 400); }
  if (!b || typeof b !== 'object' || !/^[a-f0-9-]{16,64}$/.test(b.id || '')) return json({ error: 'kimlik' }, 400);
  if (b.sub != null && !validSubscription(b.sub)) return json({ error: 'geçersiz abonelik' }, 400);
  const rec = {
    follow: Array.isArray(b.follow) ? [...new Set(b.follow.filter((x) => typeof x === 'string' && x.length <= 100))].slice(0, 40) : [],
    tv: Array.isArray(b.tv) ? [...new Set(b.tv.filter((x) => Number.isSafeInteger(x) && x > 0))].slice(0, 600) : [],
    t: Date.now(),
  };
  try {
    if (b.sub) {
      await database(env, '?on_conflict=endpoint', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ endpoint: b.sub.endpoint, subscription: b.sub, device_id: b.id,
          follow: rec.follow, tv: rec.tv, updated_at: new Date(rec.t).toISOString() }),
      });
      // A browser may rotate its push endpoint. Remove the superseded subscription only after saving.
      await database(env, `?device_id=eq.${encodeURIComponent(b.id)}&endpoint=neq.${encodeURIComponent(b.sub.endpoint)}`, { method: 'DELETE' });
    } else {
      await database(env, `?device_id=eq.${encodeURIComponent(b.id)}`, { method: 'DELETE' });
    }
    await env.WV.put('dev:' + b.id, JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 180 });
    return json({ ok: true });
  } catch { return json({ error: 'bildirim kaydı yapılamadı' }, 503); }
}
async function devices(req, env) {
  if (!env.TMDB_TOKEN || req.headers.get('x-admin') !== (await adminKey(env.TMDB_TOKEN))) return json({ error: 'yetki yok' }, 403);
  if (!dbReady(env)) return json({ error: 'bildirim servisi hazır değil' }, 503);
  const result = new Map();
  // Preserve old KV subscriptions until each device has synced to the new database.
  let cursor;
  do {
    const page = await env.WV.list({ prefix: 'dev:', ...(cursor ? { cursor } : {}) });
    for (const key of page.keys) {
      const raw = await env.WV.get(key.name);
      if (!raw) continue;
      const rec = JSON.parse(raw);
      if (rec.sub && validSubscription(rec.sub)) result.set(rec.sub.endpoint, { id: key.name.slice(4), ...rec });
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  // Paginate instead of silently dropping subscriptions beyond the server's row limit.
  for (let offset = 0; ; ) {
    const rows = await (await database(env, `?select=*&order=id&limit=500&offset=${offset}`)).json();
    if (!rows.length) break;
    for (const row of rows) {
      if (validSubscription(row.subscription)) result.set(row.endpoint, {
        id: row.device_id, sub: row.subscription, follow: row.follow || [], tv: row.tv || [],
      });
    }
    offset += rows.length;
  }
  return json([...result.values()]);
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      if (url.pathname.startsWith('/tmdb/') && req.method === 'GET') return await tmdb(url, env, ctx);
      if (url.pathname === '/sync' && req.method === 'POST') return await sync(req, env);
      if ((url.pathname === '/lists' || url.pathname === '/collections') && req.method === 'GET') {
        const v = await env.WV.get(url.pathname.slice(1));
        return v ? new Response(v, { headers: { 'content-type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${url.pathname === '/lists' ? 60 : 600}`, ...CORS } }) : json({ error: 'yok' }, 404);
      }
      if (url.pathname === '/devices' && req.method === 'GET') return await devices(req, env);
      if (url.pathname === '/') return json({ ok: true, name: 'watchverse' });
      return json({ error: 'bulunamadı' }, 404);
    } catch (e) {
      return json({ error: 'sunucu hatası' }, 500);
    }
  },
};
