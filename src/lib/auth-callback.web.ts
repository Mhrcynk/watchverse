import { sb } from './supabase';

/** Web: giriş dönüşü sitenin kendi /auth/callback sayfasına gelir (GitHub Pages alt klasörü dahil). */
const base = (process.env.EXPO_BASE_URL || '').replace(/\/$/, '');
const origin = typeof window !== 'undefined' ? window.location.origin : '';
export const AUTH_REDIRECT = `${origin}${base}/auth/callback`;

/** Yalnızca bu sitenin dönüş adresi kabul edilir; giriş bilgileri günlüğe yazılmaz. */
async function exchange(url: string): Promise<void> {
  const parsed = new URL(url);
  if (`${parsed.origin}${parsed.pathname.replace(/\/$/, '')}` !== AUTH_REDIRECT) throw new Error('Geçersiz giriş dönüşü');
  const code = parsed.searchParams.get('code');
  if (!code) throw new Error('Giriş kodu alınamadı');
  const client = sb();
  if (!client) throw new Error('Giriş hizmeti hazır değil');
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) throw error;
  // Kodu adres çubuğundan temizle (geri tuşuyla tekrar kullanılmasın)
  try { window.history.replaceState(null, '', `${base}/auth/callback`); } catch {}
}

let last: {url:string; task:Promise<void>} | undefined;
export function finishAuth(url:string): Promise<void> {
  if (last?.url === url) return last.task;
  const task = exchange(url);
  last = {url,task};
  return task;
}
