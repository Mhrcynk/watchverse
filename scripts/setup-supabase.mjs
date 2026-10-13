#!/usr/bin/env node
/**
 * Üyelik ve veritabanını (Supabase) kendiliğinden kurar ya da günceller.
 * GitHub görevinde çalışır. Gerekenler (GitHub secret):
 *   SUPABASE_ACCESS_TOKEN — supabase.com → Account → Access Tokens
 *   SUPABASE_PROJECT_REF  — proje adresindeki 20 harflik kimlik
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET — isteğe bağlı, Google ile giriş için
 *   SITE_URL — uygulamanın adresi
 * Sonuç: supabase_url ve supabase_key değerlerini GITHUB_OUTPUT'a yazar.
 * Ayrıca son 7 günün hata kayıtlarını görev özetine not düşer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const { SUPABASE_ACCESS_TOKEN: TOKEN, SUPABASE_PROJECT_REF: REF_RAW, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SITE_URL } = process.env;
const out = (k, v) => process.env.GITHUB_OUTPUT && fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`);
const empty = () => { out('supabase_url', ''); out('supabase_key', ''); };

if (!TOKEN || !REF_RAW) { console.log('::warning::Supabase bilgileri yok; üyelik kapalı kalır.'); empty(); process.exit(0); }
// Proje kimliği ya da proje adresi yapıştırılmış olabilir
const REF = (REF_RAW.match(/([a-z]{20})/) || [])[1];
if (!REF) { console.log('::error::SUPABASE_PROJECT_REF geçersiz. Proje adresindeki 20 harflik kimliği yapıştır.'); empty(); process.exit(0); }

async function api(p, init = {}) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}${p}`, { ...init, headers: { Authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json', ...(init.headers || {}) } });
  const text = await r.text();
  let j; try { j = JSON.parse(text); } catch { j = text; }
  return { ok: r.ok, status: r.status, j };
}
const sql = (query) => api('/database/query', { method: 'POST', body: JSON.stringify({ query }) });

// 1) Tablolar ve işlevler
const schema = fs.readFileSync(path.join(here, '..', 'supabase', 'schema.sql'), 'utf8');
const s = await sql(schema);
if (!s.ok) {
  console.log(`::error::Veritabanı kurulamadı (${s.status}): ${JSON.stringify(s.j).slice(0, 300)}`);
  empty(); process.exit(0);
}
console.log('Veritabanı hazır.');

// 2) Giriş ayarları
const site = (SITE_URL || '').replace(/\/?$/, '/');
const auth = {
  site_url: site,
  uri_allow_list: [site + '**', 'http://localhost:8081/**'].join(','),
  external_email_enabled: true,
  mailer_autoconfirm: true, // onay maili beklemeden giriş (ücretsiz mail gönderimi çok sınırlı)
  password_min_length: 8,
};
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) Object.assign(auth, { external_google_enabled: true, external_google_client_id: GOOGLE_CLIENT_ID.trim(), external_google_secret: GOOGLE_CLIENT_SECRET.trim() });
const a = await api('/config/auth', { method: 'PATCH', body: JSON.stringify(auth) });
const google = !!auth.external_google_enabled && a.ok;
if (!a.ok) console.log(`::warning::Giriş ayarları güncellenemedi (${a.status}): ${JSON.stringify(a.j).slice(0, 300)}`);

// 3) Uygulamanın kullanacağı herkese açık anahtar
const k = await api('/api-keys?reveal=false');
const keys = Array.isArray(k.j) ? k.j : [];
const pick = keys.find((x) => x.type === 'publishable' && x.api_key && !x.api_key.includes('·')) || keys.find((x) => x.name === 'anon' && x.api_key);
if (!pick) { console.log(`::error::Herkese açık anahtar alınamadı (${k.status}).`); empty(); process.exit(0); }
const url = `https://${REF}.supabase.co`;
out('supabase_url', url);
out('supabase_key', pick.api_key);

// 4) Son 7 günün hataları
let errs = '';
const e = await sql(`select message, count(*)::int as n, max(at) as last, max(screen) as screen, max(left(coalesce(stack,''),160)) as stack, max(left(platform,60)) as platform from public.app_errors where at > now() - interval '7 days' group by message order by n desc limit 5`);
if (e.ok && Array.isArray(e.j)) errs = e.j.length ? ' | Son 7 gün hatalar: ' + e.j.map((r) => `${r.n}x ${String(r.message).slice(0, 80)} [${r.screen || '-'}] [${String(r.stack || '').replace(/\s+/g, ' ')}] [${r.platform || ''}]`).join(' ;; ') : ' | Son 7 günde hata yok';
const users = await sql('select count(*)::int as n from auth.users');
const n = users.ok && Array.isArray(users.j) ? users.j[0]?.n : '?';

console.log(`::notice::Uyelik hazir: ${url} | Google girisi ${google ? 'acik' : 'kapali'} | ${n} hesap${errs}`);
