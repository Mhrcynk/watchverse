#!/usr/bin/env node
/**
 * Ara sunucuyu (Cloudflare Worker) kendiliğinden kurar ya da günceller.
 * GitHub görevinde çalışır. Gerekenler (GitHub secret):
 *   CLOUDFLARE_API_TOKEN  — Cloudflare'de "Edit Cloudflare Workers" şablonuyla oluşturulan anahtar
 *   CLOUDFLARE_ACCOUNT_ID — Cloudflare hesap kimliği
 *   TMDB_TOKEN            — zaten var
 * Sonuç: sunucu adresini GITHUB_OUTPUT'a api_url olarak yazar.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(here, '..', 'worker');
const { CLOUDFLARE_API_TOKEN: CF, CLOUDFLARE_ACCOUNT_ID: ACC, TMDB_TOKEN } = process.env;
const out = (k, v) => process.env.GITHUB_OUTPUT && fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`);
if (!CF || !ACC) { console.log('::warning::Cloudflare bilgileri yok; ara sunucu kurulmadı (arama kapalı kalır).'); out('api_url', ''); process.exit(0); }
if (!TMDB_TOKEN) { console.error('TMDB_TOKEN yok.'); process.exit(1); }

const WRANGLER = 'wrangler@4.146.0';
async function cf(p, init = {}) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACC}${p}`, { ...init, headers: { Authorization: `Bearer ${CF}`, 'content-type': 'application/json', ...(init.headers || {}) } });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok && j.success !== false, status: r.status, j };
}

// 1) Depolama alanı
let ns = (await cf('/storage/kv/namespaces?per_page=100')).j.result?.find((n) => n.title === 'watchverse-data');
if (!ns) {
  const r = await cf('/storage/kv/namespaces', { method: 'POST', body: JSON.stringify({ title: 'watchverse-data' }) });
  if (!r.ok) { console.error('::error::Depolama alanı oluşturulamadı:', JSON.stringify(r.j.errors || r.status)); process.exit(1); }
  ns = r.j.result;
}
console.log('Depolama alanı:', ns.id);

// 2) workers.dev alt alan adı (yoksa oluştur)
let sub = (await cf('/workers/subdomain')).j.result?.subdomain;
if (!sub) {
  const base = (process.env.GITHUB_REPOSITORY_OWNER || 'watchverse').toLowerCase().replace(/[^a-z0-9-]/g, '');
  for (const cand of [base, `${base}-wv`, `${base}-${Math.floor(Math.random() * 9000 + 1000)}`]) {
    const r = await cf('/workers/subdomain', { method: 'PUT', body: JSON.stringify({ subdomain: cand }) });
    if (r.ok) { sub = cand; break; }
  }
  if (!sub) { console.error('::error::workers.dev adresi alınamadı. Cloudflare panelinde Workers & Pages sayfasını bir kez açıp tekrar dene.'); process.exit(1); }
}

// Resolve server credentials inside this process; never expose them as build outputs.
let databaseUrl = process.env.SUPABASE_URL;
let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const projectRef = (process.env.SUPABASE_PROJECT_REF || '').match(/[a-z]{20}/)?.[0];
if ((!databaseUrl || !serviceKey) && projectRef && process.env.SUPABASE_ACCESS_TOKEN) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` },
  });
  if (!r.ok) throw new Error(`Supabase sunucu anahtarı alınamadı: HTTP ${r.status}`);
  const keys = await r.json();
  serviceKey ||= keys.find((k) => k.name === 'service_role')?.api_key;
  databaseUrl ||= `https://${projectRef}.supabase.co`;
}
if (!databaseUrl || !serviceKey) throw new Error('Bildirim sunucusu için Supabase ayarları gerekli.');
console.log(`::add-mask::${serviceKey}`);

// 3) Ayar dosyası ve yayın
fs.writeFileSync(path.join(dir, 'wrangler.toml'), `name = "watchverse"
main = "index.js"
compatibility_date = "2026-09-01"
workers_dev = true

[[kv_namespaces]]
binding = "WV"
id = "${ns.id}"

[[ratelimits]]
name = "SYNC_LIMITER"
namespace_id = "928401"
simple = { limit = 60, period = 60 }
`);
const env = { ...process.env, CLOUDFLARE_API_TOKEN: CF, CLOUDFLARE_ACCOUNT_ID: ACC };
execFileSync('npx', ['--yes', WRANGLER, 'deploy', '--config', path.join(dir, 'wrangler.toml')], { stdio: 'inherit', env });
execFileSync('npx', ['--yes', WRANGLER, 'secret', 'bulk', '--config', path.join(dir, 'wrangler.toml')], {
  input: JSON.stringify({ TMDB_TOKEN, SUPABASE_URL: databaseUrl, SUPABASE_SERVICE_ROLE_KEY: serviceKey }),
  stdio: ['pipe', 'inherit', 'inherit'], env,
});

const url = `https://watchverse.${sub}.workers.dev`;
// 4) Kısa deneme: sunucu ve TMDB bağlantısı çalışıyor mu
let test = 'deneme yapılamadı';
for (let i = 0; i < 6; i++) {
  try {
    const r = await fetch(`${url}/tmdb/search/multi?query=yarg%C4%B1`);
    const j = await r.json();
    test = r.ok ? `TMDB aramasi calisiyor (${j.results?.length ?? 0} sonuc)` : `TMDB hatasi ${r.status}`;
    if (r.ok) break;
  } catch (e) { test = 'sunucuya ulasilamadi'; }
  await new Promise((res) => setTimeout(res, 5000));
}
console.log(`::notice::Ara sunucu hazir: ${url} | ${test}`);
out('api_url', url);
