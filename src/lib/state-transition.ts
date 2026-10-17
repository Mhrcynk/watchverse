import { projectEpisodes, episodeLayouts } from './episode-state';
import { recordEpisodeChanges } from './episode-identity';
import { recordReplica } from './replica';
import type { State } from './types';
export function localTransition(before: State, update: State | ((s:State)=>State), actor: string): State {
    const prev = projectEpisodes(before);
    let next = typeof update === 'function' ? update(prev) : update;
    next = recordEpisodeChanges(prev, next, episodeLayouts(next));
    if (next.episodes !== prev.episodes && next.dropped) {
      let dropped = next.dropped;
      for (const [k, v] of Object.entries(next.dropped)) {
        if (v > 0 && (next.episodes[k]?.length || 0) > (prev.episodes[k]?.length || 0)) {
          if (dropped === next.dropped) dropped = { ...dropped };
          dropped[k] = -Date.now();
        }
      }
      if (dropped !== next.dropped) next = { ...next, dropped };
    }
    next = recordReplica(before, next, actor);
    return next;
}
