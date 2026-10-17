import bundled from '../data/catalog.json';
import { CATALOG } from './catalog';
import { libraryLayout, normalizeEpisodes, titleLayout, type EpisodeLayout } from './episode-identity';
import type { State, Title } from './types';
const baseline = Object.fromEntries((bundled.catalog as Title[]).filter(t=>t.ep.length).map(t=>[t.id,titleLayout(t)]));
export function episodeLayouts(s: State): Record<string,EpisodeLayout> {
  return {...Object.fromEntries(CATALOG.filter(t=>t.ep.length).map(t=>[t.id,titleLayout(t)])), ...Object.fromEntries(Object.entries(s.lib).filter(([,v])=>v.m==='tv' && v.seasons?.length).map(([k,v])=>[k,libraryLayout(k,v)]))};
}
export function projectEpisodes(s: State): State {
  const current=episodeLayouts(s);
  const source={...current};
  for(const [key,layout]of Object.entries(baseline))if(!s.episodeLayouts?.[key])source[key]=layout;
  const migrated=normalizeEpisodes(s,source);
  return normalizeEpisodes(migrated,current);
}
