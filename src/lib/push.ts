import { Platform } from 'react-native';

/** Bildirim anahtarının herkese açık yarısı (gizli yarısı GitHub'da VAPID_PRIVATE_KEY olarak durur) */
export const VAPID_PUBLIC = 'BHBYKXbSeh1aOeMHcYzMkoalpGIfaJkT-H-qzGk17-KFlUrhCp6Gi5KQ_4AeNOA0e2w-2YiQTiquLJkY_AyxY90';

const web = Platform.OS === 'web' && typeof window !== 'undefined';

/** Ana ekrandan açılmış mı (iPhone'da bildirim yalnızca böyle çalışır) */
export function isStandalone() {
  if (!web) return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
export const isIOS = () => web && /iPhone|iPad|iPod/.test(navigator.userAgent);
export const pushSupported = () => web && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const pushPermission = (): NotificationPermission | 'unsupported' => (pushSupported() ? Notification.permission : 'unsupported');

function keyBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** İzin ister, aboneliği oluşturur ve GitHub'a eklenecek kodu döndürür */
export async function enablePush(follow: string[]): Promise<{ ok: true; code: string } | { ok: false; reason: string }> {
  if (!pushSupported()) return { ok: false, reason: isIOS() ? 'Bildirim için uygulamayı ana ekrandan açmalısın.' : 'Bu tarayıcı bildirimleri desteklemiyor.' };
  if (isIOS() && !isStandalone()) return { ok: false, reason: 'iPhone\'da bildirimler yalnızca ana ekrana eklenen uygulamada çalışır. Ana ekrandaki simgeden açıp tekrar dene.' };
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, reason: 'Bildirim izni verilmedi. Ayarlar → Bildirimler → WatchVerse altından açabilirsin.' };
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC) });
  const body = JSON.stringify({ s: sub.toJSON(), f: follow });
  return { ok: true, code: 'WVPUSH:' + btoa(unescape(encodeURIComponent(body))) };
}

export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
