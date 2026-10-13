import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * TMDB'ye ara sunucu üzerinden erişim. Anahtar uygulamada yoktur; sunucu ekler.
 * Adres yayın sırasında EXPO_PUBLIC_API_URL ile verilir. Yoksa arama kapalıdır.
 */
const API = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
export const hasApi = () => !!API;

export type Media = 'movie' | 'tv';
export type TItem = { key: string; m: Media; id: number; title: string; orig: string; year: number | null; date: string | null; p: string | null; b: string | null; overview: string; vote: number; votes: number; lang: string };
export type TSeason = { n: number; name: string; count: number; air: string | null; p: string | null };
export type TDetail = TItem & {
  tagline: string; runtime: number | null; genres: string[]; status: string; countries: string[];
  seasons: TSeason[]; aired: number; last: { s: number; e: number; date: string } | null; next: { s: number; e: number; date: string } | null;
  pl: string[]; yt: string | null; recs: TItem[]; at: number;
};
export type TEpisode = { s: number; e: number; name: string; date: string | null; runtime: number | null; overview: string; still: string | null };

export const keyOf = (m: Media, id: number) => `${m}:${id}`;
export const parseKey = (k: string): { m: Media; id: number } | null => {
  const r = /^(movie|tv):(\d+)$/.exec(k);
  return r ? { m: r[1] as Media, id: Number(r[2]) } : null;
};
export const img = (p: string | null | undefined, size: 'w185' | 'w342' | 'w500' | 'w780' = 'w342') => (p ? `https://image.tmdb.org/t/p/${size}${p}` : null);
export const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

const mem = new Map<string, { t: number; v: unknown }>();
const PERSIST = 'wv:tmdb:';

async function get<T>(path: string, params: Record<string, string | number | undefined> = {}, maxAgeMin = 60, persist = false): Promise<T> {
  if (!API) throw new Error('no-api');
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString();
  const url = `${API}/tmdb${path}${qs ? '?' + qs : ''}`;
  const hit = mem.get(url);
  if (hit && Date.now() - hit.t < maxAgeMin * 6e4) return hit.v as T;
  if (persist && !hit) {
    try {
      const s = await AsyncStorage.getItem(PERSIST + url);
      if (s) { const o = JSON.parse(s); mem.set(url, o); if (Date.now() - o.t < maxAgeMin * 6e4) return o.v as T; }
    } catch {}
  }
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('http ' + r.status);
    const v = (await r.json()) as T;
    const o = { t: Date.now(), v };
    mem.set(url, o);
    if (persist) AsyncStorage.setItem(PERSIST + url, JSON.stringify(o)).catch(() => {});
    return v;
  } catch (e) {
    // Çevrimdışı: eski kayıt varsa onu kullan
    const old = mem.get(url);
    if (old) return old.v as T;
    throw e;
  }
}

function item(r: any, m?: Media): TItem | null {
  const media: Media | undefined = m || (r.media_type === 'movie' || r.media_type === 'tv' ? r.media_type : undefined);
  if (!media || !r.id) return null;
  const date: string | null = (media === 'movie' ? r.release_date : r.first_air_date) || null;
  return {
    key: keyOf(media, r.id), m: media, id: r.id,
    title: (media === 'movie' ? r.title : r.name) || '', orig: (media === 'movie' ? r.original_title : r.original_name) || '',
    year: date ? Number(date.slice(0, 4)) : null, date, p: r.poster_path || null, b: r.backdrop_path || null,
    overview: r.overview || '', vote: r.vote_average || 0, votes: r.vote_count || 0, lang: r.original_language || '',
  };
}
const items = (arr: any[] | undefined, m?: Media) => (arr || []).map((r) => item(r, m)).filter((x): x is TItem => !!x && !!x.title);

/* ---------- arama ve listeler ---------- */
export async function search(q: string): Promise<TItem[]> {
  const j = await get<any>('/search/multi', { query: q.trim(), include_adult: 'false', region: 'TR' }, 30);
  // Önce afişi olan ve oy almış olanlar
  return items(j.results).sort((a, b) => Number(!!b.p) - Number(!!a.p) || b.votes - a.votes).slice(0, 40);
}
export async function trending(): Promise<TItem[]> {
  return items((await get<any>('/trending/all/week', {}, 120, true)).results);
}
export async function discover(m: Media, params: Record<string, string | number>): Promise<TItem[]> {
  return items((await get<any>(`/discover/${m}`, { watch_region: 'TR', include_adult: 'false', ...params }, 180, true)).results, m);
}
let providerCache: { id: number; name: string }[] | null = null;
/** Türkiye'deki abonelik platformları: ad → TMDB kimliği */
export async function providers(): Promise<{ id: number; name: string }[]> {
  if (providerCache) return providerCache;
  const j = await get<any>('/watch/providers/tv', { watch_region: 'TR' }, 60 * 24 * 7, true);
  providerCache = (j.results || []).map((p: any) => ({ id: p.provider_id, name: p.provider_name as string }));
  return providerCache!;
}

/* ---------- ayrıntı ---------- */
const NAME: [RegExp, string][] = [
  [/disney/i, 'Disney+'], [/netflix/i, 'Netflix'], [/amazon|prime video/i, 'Prime Video'], [/hbo|^max\b/i, 'HBO Max'], [/apple tv/i, 'Apple TV+'],
  [/blutv/i, 'BluTV'], [/^tod\b|tod tv/i, 'TOD'], [/exxen/i, 'Exxen'], [/gain/i, 'Gain'], [/tabii/i, 'tabii'], [/mubi/i, 'MUBI'], [/puhu/i, 'puhutv'], [/tv\+|tvplus/i, 'TV+'],
];
export const niceProvider = (n: string) => (NAME.find(([re]) => re.test(n)) || [null, n])[1];

export async function detail(m: Media, id: number, fresh = false): Promise<TDetail> {
  const j = await get<any>(`/${m}/${id}`, { append_to_response: 'watch/providers,videos,recommendations' }, fresh ? 0 : 360, true);
  const base = item(j, m)!;
  const t = today();
  const seasons: TSeason[] = (j.seasons || []).filter((s: any) => s.season_number > 0)
    .map((s: any) => ({ n: s.season_number, name: s.name || `${s.season_number}. sezon`, count: s.episode_count || 0, air: s.air_date || null, p: s.poster_path || null }));
  const last = j.last_episode_to_air ? { s: j.last_episode_to_air.season_number, e: j.last_episode_to_air.episode_number, date: j.last_episode_to_air.air_date } : null;
  const next = j.next_episode_to_air && j.next_episode_to_air.air_date >= t ? { s: j.next_episode_to_air.season_number, e: j.next_episode_to_air.episode_number, date: j.next_episode_to_air.air_date } : null;
  // Yayınlanmış bölüm sayısı: son yayınlanan bölüme kadar
  let aired = 0;
  if (m === 'tv') for (const s of seasons) { if (!last || s.n < last.s) aired += s.count; else if (s.n === last.s) aired += last.e; }
  const prov = j['watch/providers']?.results?.TR?.flatrate || [];
  const vids = (j.videos?.results || []).filter((v: any) => v.site === 'YouTube' && /Trailer|Teaser/.test(v.type));
  vids.sort((a: any, b: any) => (b.official - a.official) || (a.type === 'Trailer' ? -1 : 1));
  return {
    ...base, tagline: j.tagline || '', runtime: m === 'movie' ? j.runtime || null : (j.episode_run_time?.[0] || j.last_episode_to_air?.runtime || null),
    genres: (j.genres || []).map((g: any) => g.name), status: j.status || '', countries: j.origin_country || (j.production_countries || []).map((c: any) => c.iso_3166_1),
    seasons, aired, last, next,
    pl: [...new Set<string>(prov.map((p: any) => niceProvider(p.provider_name)))],
    yt: vids[0]?.key || null, recs: items(j.recommendations?.results).slice(0, 16), at: Date.now(),
  };
}

export async function season(id: number, n: number): Promise<TEpisode[]> {
  const j = await get<any>(`/tv/${id}/season/${n}`, {}, 360, true);
  return (j.episodes || []).map((e: any) => ({ s: n, e: e.episode_number, name: e.name || `${e.episode_number}. bölüm`, date: e.air_date || null, runtime: e.runtime || null, overview: e.overview || '', still: e.still_path || null }));
}

/** Sezon/bölüm → sıra numarası (1'den başlar); sezonlar sırayla dizilir */
export function epIndex(seasons: { n: number; count: number }[], s: number, e: number) {
  let n = 0;
  for (const x of seasons) { if (x.n < s) n += x.count; }
  return n + e;
}
export function epFromIndex(seasons: { n: number; count: number }[], idx: number) {
  let left = idx;
  for (const x of [...seasons].sort((a, b) => a.n - b.n)) { if (left <= x.count) return { s: x.n, e: left }; left -= x.count; }
  return null;
}
