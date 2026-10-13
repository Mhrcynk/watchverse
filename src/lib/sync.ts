import { Platform } from 'react-native';
import { trackedTv } from './library';
import type { State } from './types';

const API = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
let lastSent = '';

async function currentSubscription(): Promise<PushSubscriptionJSON | null> {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub ? sub.toJSON() : null;
  } catch { return null; }
}

/** Bildirim aboneliğini ve takip ettiğin dizileri ara sunucuya kaydeder (değişince) */
export async function syncDevice(s: State, device: string, force = false): Promise<boolean> {
  if (!API) return false;
  const sub = await currentSubscription();
  const body = JSON.stringify({ id: device, sub, follow: s.follow, tv: trackedTv(s) });
  if (!force && body === lastSent) return true;
  try {
    const r = await fetch(`${API}/sync`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    if (r.ok) lastSent = body;
    return r.ok;
  } catch { return false; }
}
export const hasSyncApi = () => !!API;
