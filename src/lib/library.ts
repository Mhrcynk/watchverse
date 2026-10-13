import { CATALOG, TBY, posterUrl } from './catalog';
import { episodeLabel, isDone, nextEpisode, watchedEps } from './progress';
import { detail, hasApi, img, keyOf, parseKey, today, type TDetail, type TItem } from './tmdb';
import type { LibItem, State, Title } from './types';

/* ---------- katalogla eşleştirme ---------- */
let byTmdb: Map<string, Title> = new Map();
let built = -1;
function index() {
  if (built === CATALOG.length) return byTmdb;
  byTmdb = new Map();
  for (const t of CATALOG) if (t.tmdb?.id && t.tmdb.id > 0) {
    const k = keyOf((t.tmdb.m || t.media) as 'movie' | 'tv', t.tmdb.id);
    if (!byTmdb.has(k)) byTmdb.set(k, t);
  }
  built = CATALOG.length;
  return byTmdb;
}
/** Bu TMDB yapımı evren kataloğunda var mı */
export const catalogOf = (key: string) => index().get(key) || null;
/** Açılacak sayfa: katalogdaysa evren sayfası, değilse TMDB sayfası */
export const routeOf = (key: string) => { const t = catalogOf(key); return t ? (`/title/${t.id}` as const) : (`/show/${key}` as const); };

export function libFromDetail(d: TDetail): LibItem {
  return {
    m: d.m, id: d.id, title: d.title, year: d.year, p: d.p, b: d.b, added: Date.now(), runtime: d.runtime,
    seasons: d.seasons.map((s) => ({ n: s.n, count: s.count })), aired: d.m === 'tv' ? d.aired : undefined, last: d.last, next: d.next, at: d.at, g: d.genres.slice(0, 4),
  };
}
export const libFromItem = (i: TItem): LibItem => ({ m: i.m, id: i.id, title: i.title, year: i.year, p: i.p, b: i.b, added: Date.now() });

/* ---------- ilerleme ---------- */
export function libProgress(s: State, key: string, li: LibItem) {
  if (li.m === 'movie') { const d = !!s.watched[key]; return { done: d ? 1 : 0, total: 1, finished: d }; }
  const w = s.episodes[key]?.length || 0;
  const total = li.aired || 0;
  return { done: w, total, finished: total > 0 && w >= total };
}

export type Entry = { key: string; route: string; title: string; year: number | null; poster: string | null; sub: string; pct: number; touched: number; tag?: string };

/** Kütüphanem: izliyorum / izleyeceğim / bitirdim — evren kataloğu ve TMDB birlikte */
export function libraryEntries(s: State) {
  const watching: Entry[] = [], plan: Entry[] = [], done: Entry[] = [];
  const seen = new Set<string>();
  // TMDB kütüphanesi
  for (const [key, li] of Object.entries(s.lib)) {
    const pr = libProgress(s, key, li);
    const e: Entry = { key, route: routeOf(key), title: li.title, year: li.year, poster: img(li.p, 'w342'), sub: '', pct: pr.total ? pr.done / pr.total : 0, touched: s.touched[key] || li.added };
    if (li.m === 'movie') { (pr.finished ? done : plan).push({ ...e, sub: pr.finished ? 'İzlendi' : 'Film' }); continue; }
    const left = pr.total - pr.done;
    if (pr.done === 0) plan.push({ ...e, sub: li.aired ? `${li.aired} bölüm` : 'Dizi' });
    else if (left > 0) watching.push({ ...e, sub: `${left} bölüm kaldı`, tag: newTag(li) });
    else if (li.next) watching.push({ ...e, sub: `Yeni bölüm: ${shortDate(li.next.date)}` });
    else done.push({ ...e, sub: 'Tamamlandı' });
    const c = catalogOf(key); if (c) seen.add(c.id);
  }
  // Evren kataloğundaki ilerleme ve listen
  for (const id of new Set([...Object.keys(s.episodes), ...Object.keys(s.watched), ...s.list])) {
    const t = TBY[id];
    if (!t || seen.has(id)) continue;
    const e: Entry = { key: id, route: `/title/${id}`, title: t.title, year: t.year, poster: posterUrl(t), sub: '', pct: 0, touched: s.touched[id] || s.watched[id] || 0 };
    if (isDone(s, t)) done.push({ ...e, sub: 'İzlendi', pct: 1 });
    else if (t.episodes && watchedEps(s, t.id) > 0) { const n = nextEpisode(s, t); watching.push({ ...e, sub: n ? `Sıradaki ${episodeLabel(t, n)}` : `${t.episodes - watchedEps(s, t.id)} bölüm kaldı`, pct: watchedEps(s, t.id) / t.episodes }); }
    else if (s.list.includes(id)) plan.push({ ...e, sub: t.episodes ? `${t.episodes} bölüm` : 'Film' });
  }
  const byTouch = (a: Entry, b: Entry) => b.touched - a.touched;
  return { watching: watching.sort(byTouch), plan: plan.sort(byTouch), done: done.sort(byTouch) };
}

function newTag(li: LibItem) {
  if (!li.last) return undefined;
  const d = (Date.parse(today()) - Date.parse(li.last.date)) / 864e5;
  return d <= 7 ? 'Yeni bölüm' : undefined;
}
const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
export const shortDate = (d: string) => `${Number(d.slice(8, 10))} ${AY[Number(d.slice(5, 7)) - 1]}${d.slice(0, 4) !== today().slice(0, 4) ? ' ' + d.slice(0, 4) : ''}`;

/** Ana sayfa: izlediğin dizilerde çıkmış ama izlemediğin bölümler */
export function freshEpisodes(s: State): Entry[] {
  return libraryEntries(s).watching.filter((e) => e.tag === 'Yeni bölüm');
}

/** Kütüphanedeki dizilerin bilgisini tazeler (12 saatte bir) */
export async function refreshLibrary(s: State, save: (key: string, li: LibItem) => void) {
  if (!hasApi()) return;
  const stale = Object.entries(s.lib).filter(([, li]) => li.m === 'tv' && (!li.at || Date.now() - li.at > 12 * 3600e3)).slice(0, 25);
  for (const [key, li] of stale) {
    try { const d = await detail(li.m, li.id, true); save(key, { ...libFromDetail(d), added: li.added }); } catch {}
  }
}

/** Bildirim görevinin takip edeceği diziler (TMDB kimlikleri) */
export function trackedTv(s: State): number[] {
  const ids = new Set<number>();
  for (const li of Object.values(s.lib)) if (li.m === 'tv') ids.add(li.id);
  for (const id of Object.keys(s.episodes)) { const t = TBY[id]; if (t?.tmdb?.m === 'tv' && t.tmdb.id > 0 && !isDone(s, t)) ids.add(t.tmdb.id); }
  return [...ids];
}
export { parseKey };
