import type { State, Title, LibItem } from './types';
export type EpisodeLayout = { ids: string[]; coordinates: string[] };
const coord = (s: number, e: number) => `s${s}e${e}`;
export function titleLayout(t: Pick<Title, 'id' | 'ep'>): EpisodeLayout {
  return { ids: t.ep.map(e => e[3] ? `tmdb:${e[3]}` : `legacy:${t.id}:${coord(e[0], e[1])}`), coordinates: t.ep.map(e => coord(e[0], e[1])) };
}
export function libraryLayout(key: string, item: LibItem): EpisodeLayout {
  const coordinates = [...(item.seasons || [])].sort((a,b)=>a.n-b.n).flatMap(s=>Array.from({length:s.count},(_,i)=>coord(s.n,i+1)));
  return { coordinates, ids: coordinates.map(c=>item.episodeIds?.[c] ? `tmdb:${item.episodeIds[c]}` : `legacy:${key}:${c}`) };
}
export function validLayout(layout: EpisodeLayout) {
  return layout.ids.length === layout.coordinates.length && new Set(layout.ids).size === layout.ids.length && new Set(layout.coordinates).size === layout.coordinates.length;
}
/** Missing identity evidence must block reinterpretation, never guess a new episode. */
export function compatibleLayout(before: EpisodeLayout, after: EpisodeLayout) {
  if (!validLayout(before) || !validLayout(after)) return false;
  return before.ids.every((id,i)=>id.startsWith('tmdb:') || after.ids.includes(id) ||
    (before.coordinates[i] === after.coordinates[i] && after.ids[i]?.startsWith('tmdb:')));
}
export function normalizeEpisodes(s: State, layouts: Record<string, EpisodeLayout>): State {
  const marks: Record<string,string[]> = { ...s.episodeMarks };
  const saved = { ...s.episodeLayouts };
  const identities = { ...s.episodeAliases };
  const unresolved = { ...s.unresolvedEpisodes };
  for (const key of new Set([...Object.keys(s.episodes), ...Object.keys(marks)])) {
    const next = layouts[key];
    const previous = saved[key];
    if (!marks[key]) {
      // Legacy positions are only resolved against the exact saved layout, or the bundled
      // baseline supplied by the caller. Out-of-range marks remain recoverable.
      const source = previous || next;
      marks[key] = [];
      for (const n of s.episodes[key] || []) {
        const id = source?.ids[n-1];
        if (id) marks[key].push(id);
        else unresolved[key] = [...new Set([...(unresolved[key] || []), n])];
      }
    }
    if (!next || (previous && !compatibleLayout(previous,next))) continue;
    if (previous) {
      const aliases = new Map(previous.ids.flatMap((id,i)=>id.startsWith('legacy:') && previous.coordinates[i] === next.coordinates[i] && next.ids[i]?.startsWith('tmdb:') ? [[id,next.ids[i]] as const] : []));
      identities[key] = { ...identities[key], ...Object.fromEntries(aliases) };
      marks[key] = [...new Set(marks[key].map(id=>aliases.get(id)||id))];
    }
    saved[key] = next;
  }
  const episodes: Record<string,number[]> = {};
  for (const [key,ids] of Object.entries(marks)) {
    const layout = saved[key] || layouts[key];
    if (!layout) continue;
    const seen = new Set(ids);
    const nums = layout.ids.flatMap((id,i)=>seen.has(id)?[i+1]:[]);
    if (nums.length) episodes[key]=nums;
  }
  return {...s, episodes, episodeMarks:marks, episodeLayouts:saved, episodeAliases:identities, unresolvedEpisodes:unresolved};
}
/** UI positions are a projection; only changed positions edit the durable identity set. */
export function recordEpisodeChanges(before: State, after: State, layouts: Record<string, EpisodeLayout>): State {
  if (after.episodeMarks && after.episodeMarks !== before.episodeMarks) return normalizeEpisodes(after,layouts);
  const marks = { ...before.episodeMarks };
  for (const key of new Set([...Object.keys(before.episodes),...Object.keys(after.episodes)])) {
    const a=before.episodes[key]||[], b=after.episodes[key]||[];
    const layout=before.episodeLayouts?.[key] || layouts[key];
    if (!layout) continue;
    const ids=new Set(before.lib[key] && !after.lib[key] ? [] : marks[key]||[]);
    for(const n of a) if(!b.includes(n) && layout.ids[n-1]) ids.delete(layout.ids[n-1]);
    for(const n of b) if(!a.includes(n) && layout.ids[n-1]) ids.add(layout.ids[n-1]);
    marks[key]=[...ids].sort();
  }
  return normalizeEpisodes({...after, episodeMarks:marks, episodeLayouts:before.episodeLayouts},layouts);
}
