import { Platform } from 'react-native';
import { sb } from './supabase';

/**
 * Hata takibi: uygulamada beklenmeyen bir hata olunca kısa bir kaydı sunucuya gönderir.
 * Kim olduğun, mailin ya da izlediklerin gönderilmez; yalnızca hata metni, ekran ve sürüm.
 */
const BUILD = (process.env.EXPO_PUBLIC_BUILD || 'dev').slice(0, 7);
const sent = new Set<string>();
let count = 0;

/** Adres ve metinlerdeki olası gizli bilgileri temizler */
const scrub = (s: string) =>
  s
    .replace(/(access_token|refresh_token|token|code|key|apikey)=[^&\s#"']+/gi, '$1=…')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '…@…')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '…');

function screen() {
  if (typeof window === 'undefined') return Platform.OS;
  return scrub(window.location.pathname).slice(0, 200);
}

export function reportError(err: unknown, where?: string) {
  try {
    const e = err as { message?: string; stack?: string } | undefined;
    const message = scrub(String(e?.message || err || 'Bilinmeyen hata')).slice(0, 500);
    // Sık görülen ve zararsız tarayıcı uyarıları
    if (/ResizeObserver loop|Load failed|NetworkError|Failed to fetch|AbortError|The operation was aborted/i.test(message)) return;
    const key = message + (where || '');
    if (sent.has(key) || count >= 10) return;
    sent.add(key);
    count++;
    const c = sb();
    if (!c) { if (__DEV__) console.warn('[hata]', message); return; }
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : Platform.OS;
    c.from('app_errors')
      .insert({ message, stack: e?.stack ? scrub(e.stack).slice(0, 4000) : null, screen: (where ? `${where} @ ` : '') + screen(), version: BUILD, platform: ua.slice(0, 200) })
      .then(() => {}, () => {});
  } catch {}
}

let installed = false;
/** Yakalanmayan hataları dinler (bir kez) */
export function installErrorTracking() {
  if (installed || typeof window === 'undefined' || Platform.OS !== 'web') return;
  installed = true;
  window.addEventListener('error', (ev) => reportError(ev.error || ev.message, 'window'));
  window.addEventListener('unhandledrejection', (ev) => reportError((ev as PromiseRejectionEvent).reason, 'promise'));
}
