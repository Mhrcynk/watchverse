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

async function saveSubscriptionToSupabase(env, endpoint, subscription) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    await fetch(`${env.SUPABASE_URL}/rest/v1/push_subscriptions`, {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ endpoint, subscription })
    });
  } catch (e) {
    console.error('Supabase push kayıt hatası:', e);
  }
}

async function sync(req, env) {
  const raw = await req.text();
  if (raw.length > 60000) return json({ error: 'çok büyük' }, 413);
  let b; try { b = JSON.parse(raw); } catch { return json({ error: 'okunamadı' }, 400); }
  if (!/^[a-f0-9-]{16,64}$/.test(b.id || '')) return json({ error: 'kimlik' }, 400);
  
  const sub = b.sub && typeof b.sub.endpoint === 'string' && /^https:\/\//.test(b.sub.endpoint) ? b.sub : null;
  
  // Eğer geçerli bir push aboneliği varsa, Supabase'deki güvenli tabloya kaydedelim
  if (sub) {
    await saveSubscriptionToSupabase(env, sub.endpoint, sub);
  }

  const rec = {
    follow: Array.isArray(b.follow) ? b.follow.filter((x) => typeof x === 'string').slice(0, 40) : [],
    tv: Array.isArray(b.tv) ? b.tv.filter((x) => Number.isInteger(x) && x > 0).slice(0, 600) : [],
    t: Date.now(),
  };
  await env.WV.put('dev:' + b.id, JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 180 });
  return json({ ok: true });
}

async function devices(req, env) {
  if (req.headers.get('x-admin') !== (await adminKey(env.TMDB_TOKEN))) return json({ error: 'yetki yok' }, 403);
  
  // Supabase'den kayıtlı push abonelerini çekelim
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const res = await fetch(`${env.SUPABASE_URL}/rest/v1/push_subscriptions?select=*`, {
        headers: {
          'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        }
      });
      if (res.ok) {
        const rows = await res.json();
        return json(rows.map(r => ({ endpoint: r.endpoint, subscription: r.subscription })));
      }
    } catch (e) {
      console.error('Supabase devices okuma hatası:', e);
    }
  }
  return json([]);
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
