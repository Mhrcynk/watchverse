import { TBY, UBY } from './catalog';
import { isEn } from './i18n';
import { minutesOf } from './store';
import type { State } from './types';

const AY = isEn ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] : ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

export type FullStats = {
  films: number; eps: number; minutes: number; seriesDone: number; rated: number; avgRating: number | null;
  year: { films: number; eps: number; minutes: number };
  months: { key: string; label: string; minutes: number; films: number; eps: number }[];
  genres: { name: string; n: number }[];
  universes: { id: string; name: string; color: string; n: number }[];
  topSeries: { key: string; title: string; eps: number }[];
};

/** Tüm izleme istatistikleri: evren kataloğu ve sonradan eklenen yapımlar birlikte */
export function fullStats(s: State, now = new Date()): FullStats {
  let films = 0, eps = 0, minutes = 0, seriesDone = 0;
  const genres = new Map<string, number>();
  const unis = new Map<string, number>();
  const series: { key: string; title: string; eps: number }[] = [];
  const addG = (key: string, w: number) => { for (const g of s.lib[key]?.g || []) genres.set(g, (genres.get(g) || 0) + w); };

  for (const key of Object.keys(s.watched)) {
    const t = TBY[key];
    if (t && t.episodes) continue;
    if (!t && !s.lib[key]) continue;
    films++;
    minutes += minutesOf(s, key);
    addG(key, 1);
    if (t) unis.set(t.u, (unis.get(t.u) || 0) + 1);
  }
  for (const [key, arr] of Object.entries(s.episodes)) {
    const t = TBY[key];
    const li = s.lib[key];
    if (!t && !li) continue;
    eps += arr.length;
    for (const n of arr) minutes += minutesOf(s, key, n);
    if (t ? arr.length >= t.episodes : li?.aired ? arr.length >= li.aired : false) seriesDone++;
    addG(key, Math.min(arr.length, 10));
    if (t) unis.set(t.u, (unis.get(t.u) || 0) + 1);
    series.push({ key, title: t ? t.trTitle || t.title : li!.title, eps: arr.length });
  }

  const y = String(now.getFullYear());
  const year = { films: 0, eps: 0, minutes: 0 };
  for (const [k, v] of Object.entries(s.log)) if (k.startsWith(y)) { year.films += v.f; year.eps += v.e; year.minutes += v.m; }

  const months: FullStats['months'] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const v = s.log[key] || { f: 0, e: 0, m: 0 };
    months.push({ key, label: AY[d.getMonth()], minutes: v.m, films: v.f, eps: v.e });
  }

  const ratings = Object.values(s.ratings);
  return {
    films, eps, minutes, seriesDone,
    rated: ratings.length,
    avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    year, months,
    genres: [...genres.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n).slice(0, 6),
    universes: [...unis.entries()].filter(([id]) => UBY[id]).map(([id, n]) => ({ id, name: UBY[id].name, color: UBY[id].color, n })).sort((a, b) => b.n - a.n).slice(0, 5),
    topSeries: series.sort((a, b) => b.eps - a.eps).slice(0, 5),
  };
}

/** "123 sa" ya da "45 dk" */
export const hoursText = (m: number) => (m >= 60 ? `${Math.round(m / 60).toLocaleString('tr-TR')} sa` : `${m} dk`);
