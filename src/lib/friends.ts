import { accountRpc } from './account-rpc';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TBY, posterUrl } from './catalog';
import { routeOf } from './library';
import { sb, siteUrl } from './supabase';
import { img } from './tmdb';

export type FeedItem = { k: string; at: number; w: boolean; e: number; r: number | null; t: string | null; p: string | null; y: string | null };
export type Friend = { id: string; name: string; share: boolean; items: FeedItem[] };
export type MyProfile = { code: string; name: string; share: boolean };

const PENDING = 'watchverse:invite';
export const inviteUrl = (code: string) => `${siteUrl()}davet/${code}`;

async function rpc<T>(fn: string, args?: Record<string, unknown>, owner?: string): Promise<T> {
  if (fn !== 'invite_info') return accountRpc<T>(fn + '_v2', args, owner);
  const c = sb();
  if (!c) throw new Error('kapalı');
  const { data, error } = await c.rpc(fn, args);
  if (error) throw error;
  return data as T;
}
export const myProfile = (name: string, owner: string) => rpc<MyProfile>('my_profile', { p_name: name }, owner);
export const resetInvite = (owner: string) => rpc<string>('reset_invite', {}, owner);
export const setSharing = (on: boolean, owner: string) => rpc<void>('set_sharing', { p_on: on }, owner);
export const inviteInfo = (code: string) => rpc<string | null>('invite_info', { p_code: code });
export const acceptInvite = (code: string, name: string, owner: string) => rpc<string>('accept_invite', { p_code: code, p_name: name }, owner);
export const removeFriend = (id: string, owner: string) => rpc<void>('remove_friend', { p_id: id }, owner);
export const friendFeed = (owner: string) => rpc<Friend[]>('friend_feed', {}, owner);

export const savePending = (code: string) => AsyncStorage.setItem(PENDING, code).catch(() => {});
export const takePending = async () => { try { const v = await AsyncStorage.getItem(PENDING); if (v) await AsyncStorage.removeItem(PENDING); return v; } catch { return null; } };

/** Akıştaki bir kaydı ekranda gösterilecek hâle getirir */
export function feedView(x: FeedItem) {
  const t = TBY[x.k];
  const title = t ? t.trTitle || t.title : x.t || 'Bir yapım';
  const poster = t ? posterUrl(t, 'w342') : img(x.p, 'w342');
  const what = x.e > 0 ? `${x.e} bölüm` : x.w ? 'İzledi' : 'Listesine ekledi';
  const route = x.k.includes(':') ? routeOf(x.k) : `/title/${x.k}`;
  return { title, poster, what, route, rating: x.r };
}

export function ago(ms: number) {
  const d = Math.floor((Date.now() - ms) / 864e5);
  return d <= 0 ? 'bugün' : d === 1 ? 'dün' : d < 7 ? `${d} gün önce` : d < 30 ? `${Math.floor(d / 7)} hafta önce` : `${Math.floor(d / 30)} ay önce`;
}
