import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY || '';

/** Üyelik açık mı (sunucu kurulmuş mu) */
export const hasAuth = () => !!(URL && KEY);

let client: SupabaseClient | null = null;
export function sb(): SupabaseClient | null {
  if (!hasAuth()) return null;
  if (!client) {
    client = createClient(URL, KEY, {
      auth: {
        storage: AsyncStorage,
        storageKey: 'watchverse:auth',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    });
  }
  return client;
}

/** Mobil uygulama içi paylaşım bağlantılarının kökü. */
export const siteUrl = () => 'watchverse://';

/** Supabase hata mesajlarını sade Türkçeye çevirir */
export function authError(e: unknown): string {
  const m = String((e as { message?: string })?.message || e || '').toLowerCase();
  if (m.includes('invalid login')) return 'Mail ya da şifre yanlış.';
  if (m.includes('already registered') || m.includes('already been registered') || m.includes('user_already_exists')) return 'Bu mail ile zaten bir hesap var. Giriş yapmayı dene.';
  if (m.includes('password') && (m.includes('at least') || m.includes('short') || m.includes('weak'))) return 'Şifre en az 8 karakter olmalı.';
  if (m.includes('invalid') && m.includes('email')) return 'Mail adresi geçersiz görünüyor.';
  if (m.includes('rate limit') || m.includes('too many') || m.includes('429')) return 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.';
  if (m.includes('not authorized') || m.includes('email address not authorized')) return 'Şifre sıfırlama maili şu an yalnızca uygulama sahibine gönderilebiliyor.';
  if (m.includes('provider is not enabled') || m.includes('unsupported provider')) return 'Google ile giriş henüz açılmadı.';
  if (m.includes('network') || m.includes('fetch')) return 'İnternet bağlantısı yok gibi görünüyor.';
  return 'Bir sorun çıktı. Tekrar dener misin?';
}
