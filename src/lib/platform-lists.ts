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

let mem: { at: number; v: Lists } | null = null;
/** Listeleri getirir; 3 saat önbellekte tutar, sunucuya ulaşılamazsa son kaydı kullanır */
export async function platformLists(): Promise<Lists | null> {
  if (!API) return null;
  if (mem && Date.now() - mem.at < 3 * 3600e3) return mem.v;
  let saved: { at: number; raw: unknown } | null = null;
  try { saved = JSON.parse((await AsyncStorage.getItem(KEY)) || 'null'); } catch {}
  if (saved && Date.now() - saved.at < 3 * 3600e3) { mem = { at: saved.at, v: convert(saved.raw) }; return mem.v; }
  try {
    const r = await fetch(`${API}/lists`);
    if (!r.ok) throw new Error(String(r.status));
    const raw = await r.json();
    AsyncStorage.setItem(KEY, JSON.stringify({ at: Date.now(), raw })).catch(() => {});
    mem = { at: Date.now(), v: convert(raw) };
    return mem.v;
  } catch {
    return saved ? convert(saved.raw) : null;
  }
}
