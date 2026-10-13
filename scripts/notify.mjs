#!/usr/bin/env node
/**
 * Haftalık güncellemede eklenen yeni bölüm ve yapımları telefona bildirim olarak gönderir.
 * Gerekenler: VAPID_PRIVATE_KEY (GitHub secret) ve en az bir abonelik kodu:
 *   - PUSH_SUBSCRIPTION secret'ı (birden fazla kod satır satır yazılabilir), ya da
 *   - scripts/push-subscriptions.txt (her satırda bir WVPUSH: kodu)
 * Abonelik kodu uygulamada Profil → Bildirimler'den alınır.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';

const here = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(here, '..', 'src', 'data', 'catalog.json'), 'utf8'));
const PUBLIC = 'BHBYKXbSeh1aOeMHcYzMkoalpGIfaJkT-H-qzGk17-KFlUrhCp6Gi5KQ_4AeNOA0e2w-2YiQTiquLJkY_AyxY90';
const PRIVATE = process.env.VAPID_PRIVATE_KEY;
const SITE = process.env.SITE_URL || '/';
if (!PRIVATE) { console.log('VAPID_PRIVATE_KEY yok; bildirim gönderilmedi.'); process.exit(0); }

const file = path.join(here, 'push-subscriptions.txt');
const codes = [...(process.env.PUSH_SUBSCRIPTION || '').split(/\s+/), ...(fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\s+/) : [])]
  .map((c) => c.trim()).filter((c) => c.startsWith('WVPUSH:'));
if (!codes.length) { console.log('Abonelik kodu yok; bildirim gönderilmedi.'); process.exit(0); }

// Bugünkü değişiklik (görev her çalıştığında yalnızca yeni olanı bildirir)
const today = (process.env.TODAY || new Date().toISOString()).slice(0, 10);
const ch = (data.changes || []).find((c) => c.date === today);
if (!ch || !(ch.added.length + ch.seasons.length)) { console.log('Bugün yeni bir şey yok.'); process.exit(0); }
const by = Object.fromEntries(data.catalog.map((t) => [t.id, t]));

webpush.setVapidDetails('https://github.com/watchverse', PUBLIC, PRIVATE);
let sent = 0;
for (const code of codes) {
  let sub, follow;
  try { const j = JSON.parse(Buffer.from(code.slice(7), 'base64').toString('utf8')); sub = j.s; follow = j.f || []; } catch { console.log('Okunamayan kod atlandı.'); continue; }
  const mine = (id) => by[id] && (!follow.length || follow.includes(by[id].u));
  const seasons = ch.seasons.filter((x) => mine(x.id)).map((x) => `${by[x.id].title}: ${x.season}. sezon, ${x.episodes} yeni bölüm`);
  const added = ch.added.filter(mine).map((id) => `${by[id].title} eklendi`);
  const lines = [...seasons, ...added];
  if (!lines.length) continue;
  const payload = {
    title: lines.length === 1 ? 'WatchVerse · Yeni' : `WatchVerse · ${lines.length} yenilik`,
    body: lines.slice(0, 3).join('\n') + (lines.length > 3 ? `\n+${lines.length - 3} daha` : ''),
    url: SITE, tag: `wv-${today}`,
  };
  try { await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 3 * 86400 }); sent++; }
  catch (e) { console.log('Gönderilemedi:', e.statusCode || e.message, e.statusCode === 410 ? '(abonelik süresi dolmuş; uygulamadan yeni kod al)' : ''); }
}
console.log(`Bildirim gönderildi: ${sent}`);
