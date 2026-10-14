import { CATALOG } from './catalog';
import { isDropped } from './library';
import { detail, epIndex, season, type TDetail } from './tmdb';
import type { State, Title } from './types';
import { isDone } from './progress';

export type CalEp = { key: string; title: string; p: string | null; year: number | null; s: number; e: number; name: string; date: string; seen: boolean };

/** Takvimde gösterilecek diziler: kütüphanedeki diziler + izlemeye başladığın / kaydettiğin evren dizileri (bırakılanlar hariç) */
function trackedShows(s: State): { id: number; key: string; cat: Title[] }[] {
  const out = new Map<number, { id: number; key: string; cat: Title[] }>();
  for (const [key, li] of Object.entries(s.lib)) if (li.m === 'tv' && !isDropped(s, key)) out.set(li.id, { id: li.id, key, cat: [] });
  for (const t of CATALOG) {
    if (t.tmdb?.m !== 'tv' || !(t.tmdb.id > 0)) continue;
    const started = (s.episodes[t.id]?.length || 0) > 0 || s.list.includes(t.id);
    if (!started || isDropped(s, t.id) || (isDone(s, t) && !s.list.includes(t.id))) continue;
    const cur = out.get(t.tmdb.id) || { id: t.tmdb.id, key: t.id, cat: [] };
    cur.cat.push(t); if (!s.lib[cur.key]) cur.key = t.id;
    out.set(t.tmdb.id, cur);
  }
  return [...out.values()];
}

async function pool<T, R>(arr: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const res: R[] = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, arr.length) }, async () => { while (i < arr.length) { const k = i++; try { res[k] = await fn(arr[k]); } catch { /* bu dizi atlanır */ } } }));
  return res;
}

/** from–to (YYYY-MM-DD, ikisi dahil) arasında yayınlanan bölümler */
export async function episodesBetween(s: State, from: string, to: string): Promise<CalEp[]> {
  const shows = trackedShows(s);
  const all = await pool(shows, 4, async (sh) => {
    const d: TDetail = await detail('tv', sh.id);
    // yalnızca bu aralığa düşebilecek sezonlar: son yayınlanan ve sıradaki
    const ns = [...new Set([d.last?.s, d.next?.s].filter((x): x is number => !!x))];
    const eps = (await Promise.all(ns.map((n) => season(sh.id, n).catch(() => [])))).flat();
    return eps.filter((e) => e.date && e.date >= from && e.date <= to).map((e) => {
      let seen = false;
      if (sh.cat.length) { for (const t of sh.cat) { const i = t.ep.findIndex((x) => x[0] === e.s && x[1] === e.e); if (i >= 0) { seen = !!s.episodes[t.id]?.includes(i + 1); break; } } }
      else seen = !!s.episodes[sh.key]?.includes(epIndex(d.seasons, e.s, e.e));
      const cat = sh.cat.find((t) => t.ep.some((x) => x[0] === e.s));
      return { key: cat?.id || sh.key, title: d.title, p: d.p, year: d.year, s: e.s, e: e.e, name: e.name, date: e.date!, seen };
    });
  });
  return all.flat().filter(Boolean).sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'tr') || a.e - b.e);
}

/** Haftanın pazartesisi (yerel tarih, YYYY-MM-DD) */
export function weekStart(offsetWeeks = 0) {
  const d = new Date(); d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offsetWeeks * 7);
  return d;
}
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
