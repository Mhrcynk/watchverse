import { sb } from './supabase';
export const AUTH_REDIRECT = 'watchverse://auth/callback';
/** Only the exact app callback is accepted; credentials are never logged. */
async function exchange(url: string): Promise<void> {
  const parsed = new URL(url);
  if (`${parsed.protocol}//${parsed.host}${parsed.pathname}` !== AUTH_REDIRECT) throw new Error('Geçersiz giriş dönüşü');
  const code = parsed.searchParams.get('code');
  if (!code) throw new Error('Giriş kodu alınamadı');
  const client = sb();
  if (!client) throw new Error('Giriş hizmeti hazır değil');
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) throw error;
}

let last: {url:string; task:Promise<void>} | undefined;
export function finishAuth(url:string): Promise<void> {
  if (last?.url === url) return last.task;
  const task = exchange(url);
  last = {url,task};
  return task;
}
