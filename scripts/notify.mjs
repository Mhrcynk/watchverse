#!/usr/bin/env node
/**
 * Telefona bildirim gönderir.
 *   node scripts/notify.mjs            → haftalık: evrenlere eklenen yeni yapım ve sezonlar
 *   node scripts/notify.mjs --daily    → günlük: takip ettiğin dizilerde dün/bugün yayınlanan bölümler
 * Abonelikler: ara sunucuya kendiliğinden kaydedilenler (Cloudflare kuruluysa) ve
 * eski yöntemle eklenen PUSH_SUBSCRIPTION secret'ı / scripts/push-subscriptions.txt.
 * Gerekenler: VAPID_PRIVATE_KEY, TMDB_TOKEN; sunucu için CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';

const here = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(here, '..', 'src', 'data', 'catalog.json'), 'utf8'));
const PUBLIC = 'BHBYKXbSeh1aOeMHcYzMkoalpGIfaJkT-H-qzGk17-KFlUrhCp6Gi5KQ_4AeNOA0e2w-2YiQTiquLJkY_AyxY90';
const { VAPID_PRIVATE_KEY: PRIVATE, TMDB_TOKEN, CLOUDFLARE_API_TOKEN: CF, CLOUDFLARE_ACCOUNT_ID: ACC } = process.env;
const SITE = process.env.SITE_URL || '/';
const DAILY = process.argv.includes('--daily');
if (!PRIVATE) { console.log('VAPID_PRIVATE_KEY yok; bildirim gönderilmedi.'); process.exit(0); }

// Türkiye saatine göre bugün ve dün
const trDate = (offsetDays = 0) => new Date(Date.now() + 3 * 3600e3 - offsetDays * 864e5).toISOString().slice(0, 10);
const today = process.env.TODAY || trDate(0);
const yesterday = process.env.YESTERDAY || trDate(1);

/* ---------- abonelikleri topla ---------- */
const subs = [];
const file = path.join(here, 'push-subscriptions.txt');
for (const code of [...(process.env.PUSH_SUBSCRIPTION || '').split(/\s+/), ...(fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\s+/) : [])]) {
  if (!code.startsWith('WVPUSH:')) continue;
  try { const j = JSON.parse(Buffer.from(code.slice(7), 'base64').toString('utf8')); subs.push({ sub: j.s, follow: j.f || [], tv: [] }); } catch { console.log('Okunamayan kod atlandı.'); }
}
async function apiUrl() {
  if (process.env.API_URL) return process.env.API_URL;
  if (!CF || !ACC) return null;
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACC}/workers/subdomain`, { headers: { Authorization: `Bearer ${CF}` } }).then((x) => x.json()).catch(() => null);
  return r?.result?.subdomain ? `https://watchverse.${r.result.subdomain}.workers.dev` : null;
}
const API = await apiUrl();
if (API && TMDB_TOKEN) {
  const key = crypto.createHash('sha256').update(`${TMDB_TOKEN}|watchverse-admin`).digest('hex');
  const response = await fetch(`${API}/devices`, { headers: { 'x-admin': key } });
  if (!response.ok) throw new Error(`Cihazlar alınamadı: HTTP ${response.status}`);
  const list = await response.json();
  for (const d of list) if (d.sub) subs.push({ sub: d.sub, follow: d.follow || [], tv: d.tv || [] });
  console.log(`Sunucudaki cihaz: ${list.length}`);
}
// Aynı abonelik iki kez gelirse birleştir
const uniq = new Map();
for (const s of subs) {
  const k = s.sub?.endpoint; if (!k) continue;
  const prev = uniq.get(k);
  uniq.set(k, prev ? { ...prev, follow: [...new Set([...prev.follow, ...s.follow])], tv: [...new Set([...prev.tv, ...s.tv])] } : s);
}
if (!uniq.size) { console.log('Abonelik yok; bildirim gönderilmedi.'); process.exit(0); }

/* ---------- ne bildirilecek ---------- */
const by = Object.fromEntries(data.catalog.map((t) => [t.id, t]));
let linesFor;
if (!DAILY) {
  const ch = (data.changes || []).find((c) => c.date === today);
  if (!ch || !(ch.added.length + ch.seasons.length)) { console.log('Bugün evrenlerde yeni bir şey yok.'); process.exit(0); }
  linesFor = (s) => {
    const mine = (id) => by[id] && (!s.follow.length || s.follow.includes(by[id].u));
    return [
      ...ch.seasons.filter((x) => mine(x.id)).map((x) => `${by[x.id].title}: ${x.season}. sezon, ${x.episodes} yeni bölüm`),
      ...ch.added.filter(mine).map((id) => `${by[id].title} eklendi`),
    ];
  };
} else {
  if (!TMDB_TOKEN) { console.log('TMDB_TOKEN yok.'); process.exit(0); }
  const ids = [...new Set([...uniq.values()].flatMap((s) => s.tv))];
  const aired = {};
  for (const id of ids) {
    const r = await fetch(`https://api.themoviedb.org/3/tv/${id}?language=tr-TR`, { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
    const e = r?.last_episode_to_air;
    if (e && (e.air_date === today || e.air_date === yesterday)) aired[id] = `${r.name}: ${e.season_number}. sezon ${e.episode_number}. bölüm yayında`;
  }
  console.log(`Kontrol edilen dizi: ${ids.length}, yeni bölüm: ${Object.keys(aired).length}`);
  linesFor = (s) => s.tv.map((id) => aired[id]).filter(Boolean);
}

/* ---------- gönder ---------- */
webpush.setVapidDetails('https://github.com/watchverse', PUBLIC, PRIVATE);
let sent = 0;
for (const s of uniq.values()) {
  const lines = linesFor(s);
  if (!lines.length) continue;
  const payload = {
    title: lines.length === 1 ? (DAILY ? 'Yeni bölüm' : 'WatchVerse · Yeni') : `WatchVerse · ${lines.length} yenilik`,
    body: lines.slice(0, 3).join('\n') + (lines.length > 3 ? `\n+${lines.length - 3} daha` : ''),
    url: SITE, tag: `wv-${DAILY ? 'd' : 'w'}-${today}`,
  };
  try { await webpush.sendNotification(s.sub, JSON.stringify(payload), { TTL: 2 * 86400 }); sent++; }
  catch (e) { console.log('Gönderilemedi:', e.statusCode || e.message, e.statusCode === 410 ? '(abonelik süresi dolmuş)' : ''); }
}
console.log(`Bildirim gönderildi: ${sent}`);
