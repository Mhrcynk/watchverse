import AsyncStorage from '@react-native-async-storage/async-storage';
import { keyOf, type TItem } from './tmdb';

/**
 * Koleksiyonlar (Oscar'lı filmler, Emmy'li diziler, Klasikler…): her gün GitHub görevinde hazırlanır,
 * ara sunucudan okunur. Ödül listeleri Wikidata'daki resmî kayıtlardan gelir.
 */
export type CItem = TItem & { note?: string };
export type Collection = { id: string; title: string; sub: string; kind: 'award' | 'tmdb'; source: string; items: CItem[] };

const API = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
const KEY = 'watchverse:collections';
const toItem = (x: any): CItem => ({ key: keyOf(x.m, x.id), m: x.m, id: x.id, title: x.title, orig: x.orig, year: x.date ? Number(String(x.date).slice(0, 4)) : null, date: x.date, p: x.p, b: x.b, overview: x.overview || '', vote: x.vote || 0, votes: x.votes || 0, lang: x.lang || '', ...(x.note ? { note: String(x.note) } : {}) });
const convert = (raw: any): Collection[] => (raw?.collections || []).map((c: any) => ({ id: c.id, title: c.title, sub: c.sub || '', kind: c.kind === 'award' ? 'award' : 'tmdb', source: c.source || '', items: (c.items || []).map(toItem) }));

let mem: Collection[] | null = null;
/** Önce kayıtlıyı hemen verir, sonra sunucudan günceli alıp onUpdate ile bildirir */
export async function loadCollections(onUpdate?: (v: Collection[]) => void): Promise<Collection[]> {
  if (!API) return [];
  let first = mem;
  if (!first) { try { const s = JSON.parse((await AsyncStorage.getItem(KEY)) || 'null'); if (s?.raw) first = convert(s.raw); } catch {} }
  const fresh = fetch(`${API}/collections?t=${Math.floor(Date.now() / 36e5)}`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((raw) => {
      AsyncStorage.setItem(KEY, JSON.stringify({ at: Date.now(), raw })).catch(() => {});
      const v = convert(raw);
      const changed = !mem || mem.length !== v.length || mem.some((c, i) => c.items.length !== v[i]?.items.length);
      mem = v;
      if (changed) onUpdate?.(v);
      return v;
    })
    .catch(() => null);
  if (first) { mem = mem || first; return first; }
  return (await fresh) || [];
}

/** Ana sayfada bugün gösterilecek koleksiyonlar: her gün sırayla dönüşür */
export function todays(all: Collection[], n = 4) {
  if (!all.length) return [];
  const day = Math.floor(Date.now() / 864e5);
  const start = day % all.length;
  return Array.from({ length: Math.min(n, all.length) }, (_, i) => all[(start + i) % all.length]);
}
export const ofKind = (c: Collection, kind: 'all' | 'tv' | 'movie') => (kind === 'all' ? c.items : c.items.filter((x) => x.m === kind));
