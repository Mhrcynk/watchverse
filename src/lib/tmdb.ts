import { isEn } from './i18n';
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
  /** başroller ve yönetmen / yaratıcı */
  cast: Person[]; makers: Person[];
};
export type Person = { id: number; name: string; role: string; p: string | null };
export type PersonDetail = { id: number; name: string; p: string | null; bio: string; born: string | null; died: string | null; place: string | null; dept: string; acting: (TItem & { role: string })[]; directing: TItem[] };
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
  if (isEn && !('language' in params)) params = { ...params, language: 'en-US' };
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
  return (await searchAll(q)).items;
}
/** Film, dizi ve kişiler (oyuncu, yönetmen) birlikte */
export async function searchAll(q: string): Promise<{ items: TItem[]; people: (Person & { known: string })[] }> {
  const j = await get<any>('/search/multi', { query: q.trim(), include_adult: 'false', region: 'TR' }, 30);
  // Önce afişi olan ve oy almış olanlar
  const list = items(j.results).sort((a, b) => Number(!!b.p) - Number(!!a.p) || b.votes - a.votes).slice(0, 40);
  const people = (j.results || []).filter((r: any) => r.media_type === 'person' && r.id && r.name)
    .sort((a: any, b: any) => Number(!!b.profile_path) - Number(!!a.profile_path) || (b.popularity || 0) - (a.popularity || 0)).slice(0, 12)
    .map((r: any) => ({ id: r.id, name: r.name, role: deptTr(r.known_for_department), p: r.profile_path || null, known: (r.known_for || []).map((k: any) => k.title || k.name).filter(Boolean).slice(0, 2).join(', ') }));
  return { items: list, people };
}
const DEPT: Record<string, string> = { Acting: 'Oyuncu', Directing: 'Yönetmen', Writing: 'Senarist', Production: 'Yapımcı', Sound: 'Müzik', Camera: 'Görüntü', Editing: 'Kurgu', Creator: 'Yaratıcı' };
export const deptTr = (d?: string) => (d ? DEPT[d] || d : '');

/** Kişi sayfası: biyografi ve yapımları (oyunculuk ve yönetmenlik ayrı) */
export async function person(id: number): Promise<PersonDetail> {
  const j = await get<any>(`/person/${id}`, { append_to_response: 'combined_credits' }, 720, true);
  let bio: string = (j.biography || '').trim();
  if (!bio && !isEn) { try { bio = ((await get<any>(`/person/${id}`, { language: 'en-US' }, 720, true)).biography || '').trim(); } catch {} }
  const seen = new Set<string>();
  const acting = (j.combined_credits?.cast || [])
    .filter((c: any) => !(c.media_type === 'tv' && [10767, 10763, 10764].some((g) => (c.genre_ids || []).includes(g))) && !/^(Self|Himself|Herself|Kendisi)/i.test(c.character || ''))
    .map((c: any) => { const x = item(c); return x ? { ...x, role: c.character || '' } : null; })
    .filter((x: any) => x && !seen.has(x.key) && seen.add(x.key))
    .sort((a: any, b: any) => b.votes - a.votes);
  const seenD = new Set<string>();
  const directing = (j.combined_credits?.crew || []).filter((c: any) => c.job === 'Director' || c.job === 'Creator' || c.department === 'Directing')
    .map((c: any) => item(c)).filter((x: TItem | null): x is TItem => !!x && !seenD.has(x.key) && !!seenD.add(x.key))
    .sort((a: TItem, b: TItem) => b.votes - a.votes);
  return { id: j.id, name: j.name || '', p: j.profile_path || null, bio, born: j.birthday || null, died: j.deathday || null, place: j.place_of_birth || null, dept: deptTr(j.known_for_department), acting, directing };
}
/** Yalnızca film ya da yalnızca dizi arar (içe aktarma için); yıl verilirse ona göre daraltır */
export async function searchKind(m: Media, q: string, year?: number): Promise<TItem[]> {
  const yk = m === 'movie' ? 'primary_release_year' : 'first_air_date_year';
  const j = await get<any>(`/search/${m}`, { query: q.trim(), include_adult: 'false', [yk]: year }, 60 * 24);
  return items(j.results, m);
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
  const j = await get<any>(`/${m}/${id}`, { append_to_response: 'watch/providers,videos,recommendations,credits' }, fresh ? 0 : 360, true);
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
    cast: (j.credits?.cast || []).slice(0, 14).map((c: any) => ({ id: c.id, name: c.name, role: c.character || '', p: c.profile_path || null })),
    makers: [
      ...(j.created_by || []).map((c: any) => ({ id: c.id, name: c.name, role: 'Yaratıcı', p: c.profile_path || null })),
      ...(j.credits?.crew || []).filter((c: any) => c.job === 'Director').map((c: any) => ({ id: c.id, name: c.name, role: 'Yönetmen', p: c.profile_path || null })),
    ].filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i).slice(0, 4),
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

/* ---------- türler ---------- */
export type Genre = { name: string; movie?: number; tv?: number };
/** Ana sayfa ve Kategoriler için türler (TMDB tür kimlikleri) */
export const GENRES: Genre[] = [
  { name: 'Aksiyon', movie: 28, tv: 10759 },
  { name: 'Komedi', movie: 35, tv: 35 },
  { name: 'Dram', movie: 18, tv: 18 },
  { name: 'Suç', movie: 80, tv: 80 },
  { name: 'Bilim kurgu', movie: 878, tv: 10765 },
  { name: 'Gerilim', movie: 53 },
  { name: 'Gizem', movie: 9648, tv: 9648 },
  { name: 'Korku', movie: 27 },
  { name: 'Romantik', movie: 10749 },
  { name: 'Fantastik', movie: 14, tv: 10765 },
  { name: 'Macera', movie: 12, tv: 10759 },
  { name: 'Animasyon', movie: 16, tv: 16 },
  { name: 'Aile', movie: 10751, tv: 10751 },
  { name: 'Belgesel', movie: 99, tv: 99 },
  { name: 'Savaş', movie: 10752, tv: 10768 },
  { name: 'Tarih', movie: 36 },
];
export type Kind = 'all' | Media;
/** Bir türde popüler yapımlar; "hepsi" seçiliyse film ve dizi karışık */
export async function byGenre(g: Genre, kind: Kind, page = 1): Promise<TItem[]> {
  const q = (m: Media, id: number) => discover(m, { with_genres: id, sort_by: 'popularity.desc', 'vote_count.gte': m === 'movie' ? 150 : 60, page });
  if (kind !== 'all') { const id = g[kind]; return id ? q(kind, id) : []; }
  const [a, b] = await Promise.all([g.movie ? q('movie', g.movie) : Promise.resolve([]), g.tv ? q('tv', g.tv) : Promise.resolve([])]);
  const out: TItem[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) { if (a[i]) out.push(a[i]); if (b[i]) out.push(b[i]); }
  return out;
}
export async function trendingKind(kind: Kind): Promise<TItem[]> {
  return items((await get<any>(`/trending/${kind}/week`, {}, 120, true)).results, kind === 'all' ? undefined : kind);
}

/* ---------- platformlar ---------- */
const PLAT_ORDER = ['Netflix', 'Disney+', 'Prime Video', 'HBO Max', 'TOD', 'Exxen', 'tabii', 'Gain', 'BluTV', 'Apple TV+'];
const PLAT_AT: Record<string, string> = { Netflix: "Netflix'te", 'Disney+': "Disney+'ta", 'Prime Video': "Prime Video'da", 'HBO Max': "HBO Max'te", TOD: "TOD'da", Exxen: "Exxen'de", tabii: "tabii'de", Gain: "Gain'de", BluTV: "BluTV'de", 'Apple TV+': "Apple TV+'ta" };
/** Türkiye'de bulunan abonelik platformları, sık kullanılandan başlayarak; "at" Türkçe ekli adı */
export async function platforms(): Promise<{ id: number; name: string; at: string }[]> {
  const list = await providers();
  const out: { id: number; name: string; at: string }[] = [];
  for (const name of PLAT_ORDER) {
    const p = list.find((x) => niceProvider(x.name) === name && !/kids|channel|with ads|standard|basic/i.test(x.name));
    if (p && !out.some((x) => x.id === p.id)) out.push({ id: p.id, name, at: PLAT_AT[name] || name });
  }
  return out;
}
