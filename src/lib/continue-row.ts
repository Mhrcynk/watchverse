import type { State } from './types';
import { libraryEntries } from './library';
import { UBY, posterUrl } from './catalog';
import { continueWatching, nextEpisode, fraction, episodeLabel, nextUp, isDone } from './progress';
export type ContItem = { key: string; m: 'movie' | 'tv'; title: string; poster: string | null; pct?: number; badge?: string; sub?: string; route: string; at: number };
export function continueRow(s: State): ContItem[] {
  const out: ContItem[] = [];
  for (const e of libraryEntries(s).watching) {
    const m = e.key.startsWith('movie:') ? 'movie' : 'tv';
    out.push({ key: e.key, m, title: e.title, poster: e.poster, pct: e.pct, badge: e.tag, sub: e.sub, route: e.route, at: (e.tag ? 1e15 : 0) + e.touched });
  }
  const have = new Set(out.map((x) => x.key));
  for (const t of continueWatching(s)) if (!have.has(t.id)) { const n = nextEpisode(s, t); out.push({ key: t.id, m: 'tv', title: t.title, poster: posterUrl(t), pct: fraction(s, t), sub: n ? `Sıradaki ${episodeLabel(t, n)}` : undefined, route: `/title/${t.id}`, at: s.touched[t.id] || 0 }); have.add(t.id); }
  for (const u of s.follow) {
    const t = nextUp(s, u);
    if (t && !have.has(t.id) && !isDone(s, t)) { out.push({ key: t.id, m: t.type === 'Dizi' ? 'tv' : 'movie', title: t.title, poster: posterUrl(t), badge: 'Sıradaki', sub: UBY[t.u]?.name, route: `/title/${t.id}`, at: 0 }); have.add(t.id); }
  }
  return out.sort((a, b) => b.at - a.at).slice(0, 20);
}

