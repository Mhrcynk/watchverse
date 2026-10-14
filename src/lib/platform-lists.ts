import AsyncStorage from '@react-native-async-storage/async-storage';
import { keyOf, type TItem } from './tmdb';

/**
 * Ana sayfadaki platform listeleri: her gün GitHub görevinde hazırlanıp ara sunucuya yazılır.
 * Netflix için Netflix'in resmî Türkiye İlk 10 listesi; diğerleri için o platformda Türkiye'de
 * izlenebilen yapımların popülerlik sırası (TMDB / JustWatch).
 */
type Slim = { id: number; m: 'movie' | 'tv'; title: string; orig: string; date: string | null; p: string | null; b: string | null; vote: number; votes: number; overview: string; lang: string; rank?: number; label?: string | null };
export type PlatformList = { id: number; name: string; at: string; logo: string | null; source: 'netflix' | 'apple' | 'tmdb'; items: TItem[]; tv: TItem[]; movie: TItem[] };
export type Lists = { updated: string; days: number; netflix: { weeks: string[] } | null; platforms: PlatformList[] };

const API = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
const KEY = 'watchverse:lists2';
const toItem = (x: Slim): TItem => ({ key: keyOf(x.m, x.id), m: x.m, id: x.id, title: x.title, orig: x.orig, year: x.date ? Number(x.date.slice(0, 4)) : null, date: x.date, p: x.p, b: x.b, overview: x.overview, vote: x.vote, votes: x.votes, lang: x.lang });

function convert(raw: any): Lists {
  return {
    updated: raw.updated,
    days: raw.days || 1,
    netflix: raw.netflix && Array.isArray(raw.netflix.weeks) ? { weeks: raw.netflix.weeks } : null,
    platforms: (raw.platforms || []).map((p: any) => ({
      id: p.id, name: p.name, at: p.at, logo: p.logo || null, source: p.source === 'netflix' || p.source === 'apple' ? p.source : 'tmdb',
      items: (p.items || []).map(toItem), tv: (p.tv || []).map(toItem), movie: (p.movie || []).map(toItem),
    })),
  };
}
/** Seçili türe göre platformun popüler listesi */
export const popularOf = (p: PlatformList, kind: 'all' | 'tv' | 'movie') => (kind === 'all' ? p.items : p[kind]);
/** Tüm platformlardan sırayla birer yapım: "Şu an popüler" */
export function mergedPopular(ps: PlatformList[], kind: 'all' | 'tv' | 'movie', limit = 20) {
  const out: TItem[] = [];
  const seen = new Set<string>();
  const lists = ps.map((p) => popularOf(p, kind));
  for (let i = 0; out.length < limit && i < 30; i++) for (const l of lists) { const x = l[i]; if (x && !seen.has(x.key)) { seen.add(x.key); out.push(x); } }
  return out.slice(0, limit);
}

let mem: Lists | null = null;
/** Önce kayıtlı listeyi hemen verir (varsa), ardından sunucudan günceli alıp onUpdate ile bildirir */
export async function platformLists(onUpdate?: (v: Lists) => void): Promise<Lists | null> {
  if (!API) return null;
  let first: Lists | null = mem;
  if (!first) {
    try { const saved = JSON.parse((await AsyncStorage.getItem(KEY)) || 'null'); if (saved?.raw) first = convert(saved.raw); } catch {}
  }
  const fresh = fetch(`${API}/lists?t=${Math.floor(Date.now() / 6e4)}`, { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((raw) => {
      AsyncStorage.setItem(KEY, JSON.stringify({ at: Date.now(), raw })).catch(() => {});
      const v = convert(raw);
      const changed = !mem || mem.updated !== v.updated || mem.platforms.length !== v.platforms.length;
      mem = v;
      if (changed) onUpdate?.(v);
      return v;
    })
    .catch(() => null);
  if (first) { mem = mem || first; return first; }
  return (await fresh) || null;
}
