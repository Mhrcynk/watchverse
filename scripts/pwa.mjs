#!/usr/bin/env node
/**
 * Web çıktısını telefona "Ana Ekrana Ekle" ile kurulabilir uygulamaya çevirir.
 * Kullanım:  node scripts/pwa.mjs <çıktı klasörü> [alt klasör, ör. /watchverse]
 * - manifest, simgeler ve iPhone ayarları
 * - çevrimdışı çalışma (service worker)
 * - catalog.json: uygulama açılınca güncel kataloğu buradan çeker
 * - 404.html: GitHub Pages'te sayfa yenilenince uygulama açılsın diye
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || 'dist');
const base = (process.argv[3] || process.env.EXPO_BASE_URL || '').replace(/\/$/, '');
const at = (p) => `${base}/${p}`;

const catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/data/catalog.json'), 'utf8'));
const version = catalog.rev || catalog.updated;

for (const f of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) fs.copyFileSync(path.join(root, 'assets/pwa', f), path.join(out, f));
fs.writeFileSync(path.join(out, 'catalog.json'), JSON.stringify(catalog));
fs.writeFileSync(path.join(out, '.nojekyll'), '');

fs.writeFileSync(path.join(out, 'manifest.webmanifest'), JSON.stringify({
  name: 'WatchVerse',
  short_name: 'WatchVerse',
  description: 'Film ve dizi evrenlerinde nerede kaldığını hatırla.',
  lang: 'tr',
  start_url: `${base}/`,
  scope: `${base}/`,
  display: 'standalone',
  background_color: '#0B0D12',
  theme_color: '#0B0D12',
  icons: [
    { src: at('icon-192.png'), sizes: '192x192', type: 'image/png' },
    { src: at('icon-512.png'), sizes: '512x512', type: 'image/png' },
    { src: at('icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2));

fs.writeFileSync(path.join(out, 'sw.js'), `// WatchVerse çevrimdışı önbellek · ${version}
const APP = 'wv-app-${version}';
const IMG = 'wv-img-v1';
const SHELL = [${JSON.stringify(at(''))}, ${JSON.stringify(at('manifest.webmanifest'))}, ${JSON.stringify(at('icon-192.png'))}];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(APP).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('wv-app-') && k !== APP).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
async function networkFirst(req, key) {
  const c = await caches.open(APP);
  try { const r = await fetch(req); if (r.ok) c.put(key || req, r.clone()); return r; }
  catch { return (await c.match(key || req)) || (await c.match(${JSON.stringify(at(''))})) || Response.error(); }
}
async function cacheFirst(req, name) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  if (hit) return hit;
  const r = await fetch(req);
  if (r.ok || r.type === 'opaque') c.put(req, r.clone());
  return r;
}
// Bildirimler: haftalık görev yeni bölüm ve yapımları gönderir
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'WatchVerse', {
    body: d.body || 'Takip ettiğin evrenlerde yenilikler var.',
    icon: ${JSON.stringify(at('icon-192.png'))}, badge: ${JSON.stringify(at('icon-192.png'))},
    data: { url: d.url || ${JSON.stringify(at(''))} }, tag: d.tag || 'watchverse',
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || ${JSON.stringify(at(''))};
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => {
    for (const w of ws) if ('focus' in w) { w.navigate ? w.navigate(url) : null; return w.focus(); }
    return self.clients.openWindow(url);
  }));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.hostname === 'image.tmdb.org') { e.respondWith(cacheFirst(req, IMG)); return; }
  if (u.origin !== location.origin) return;
  if (req.mode === 'navigate') { e.respondWith(networkFirst(req, ${JSON.stringify(at(''))})); return; }
  if (u.pathname.endsWith('/catalog.json')) { e.respondWith(networkFirst(new Request(u.pathname), u.pathname)); return; }
  e.respondWith(cacheFirst(req, APP));
});
`);

const head = `
    <meta name="color-scheme" content="dark">
    <style id="wv-pwa">
      html, body { background-color: #0B0D12 !important; color-scheme: dark; margin: 0; }
      html { height: 100vh; height: -webkit-fill-available; }
      body { min-height: 100vh; overscroll-behavior: none; }
      * { -webkit-tap-highlight-color: transparent; }
      body { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
      input, textarea, [data-selectable] { -webkit-user-select: text; user-select: text; }
      input:focus, textarea:focus { outline: none; }
      textarea:focus { box-shadow: 0 0 0 1.5px #7C5CFC; }
      @media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; } }
      /* iPhone'da ana ekrandan açılınca alt ve üst kenarda boşluk kalmasın */
      #root { position: fixed; top: 0; right: 0; bottom: 0; left: 0; height: auto !important; background-color: #0B0D12; }
    </style>
    <link rel="manifest" href="${at('manifest.webmanifest')}">
    <link rel="apple-touch-icon" href="${at('apple-touch-icon.png')}">
    <meta name="theme-color" content="#0B0D12">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="WatchVerse">
    <script>if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register(${JSON.stringify(at('sw.js'))},{scope:${JSON.stringify(at(''))}}));</script>
  `;
const idx = path.join(out, 'index.html');
let html = fs.readFileSync(idx, 'utf8');
if (!html.includes('manifest.webmanifest')) html = html.replace('</head>', head + '</head>');
html = html.replace('<html lang="en">', '<html lang="tr">').replace(/content="width=device-width[^"]*"/, 'content="width=device-width, initial-scale=1, viewport-fit=cover"');
fs.writeFileSync(idx, html);
fs.copyFileSync(idx, path.join(out, '404.html'));
console.log(`Kurulabilir web uygulaması hazır: ${out} (adres kökü: ${base || '/'})`);
