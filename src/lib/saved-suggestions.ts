import type { State, Title } from './types';
import type { Media, TItem } from './tmdb';

/** Build a deduplicated pool from saved titles and custom lists, excluding started titles. */
export function savedSuggestions(state: State, catalog: Title[], kind: 'all' | Media, shown: Set<string>): TItem[] {
  const findCatalog = (key: string) => catalog.find((t) => t.tmdb?.id && `${t.tmdb.m || t.media}:${t.tmdb.id}` === key);
  const keys = new Set([...state.list, ...Object.keys(state.lib), ...Object.values(state.lists).flatMap((l) => l.items.map((x) => x.k))]);
  const canonical = new Set<string>();
  for (const k of keys) {
    const t = catalog.find((t) => t.id === k) || findCatalog(k);
    const key = t?.tmdb?.id ? `${t.tmdb.m || t.media}:${t.tmdb.id}` : k;
    if (!/^(movie|tv):\d+$/.test(key) || state.watched[key] || (t && state.watched[t.id]) || (t && state.episodes[t.id]?.length) || state.episodes[key]?.length || shown.has(key)) continue;
    if (kind === 'all' || key.startsWith(kind + ':')) canonical.add(key);
  }
  return [...canonical].map((key): TItem => {
    const t = findCatalog(key); const li = state.lib[key];
    const [m, id] = key.split(':');
    const saved = Object.values(state.lists).flatMap((l) => l.items).find((x) => x.k === key);
    return { key, m: m as Media, id: Number(id), title: t?.trTitle || t?.title || li?.title || saved?.t || key, orig: t?.title || li?.title || '', year: t?.year || li?.year || saved?.y || null, date: '', p: t?.tmdb?.p || li?.p || saved?.p || null, b: t?.tmdb?.b || li?.b || null, overview: t?.summary || '', vote: 0, votes: 0, lang: '' };
  });
}
