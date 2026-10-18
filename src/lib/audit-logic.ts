import type { Title } from './types';
import type { TItem } from './tmdb';

/** Fit posters to the measured content area, including sidebar and safe-area padding. */
export function posterGrid(width: number, maxCols: number, gap = 14) {
  // Telefonda (en çok 3 sütun) 3 sütunu koru; tablette afiş en az ~140 px olsun
  const min = maxCols <= 3 ? 84 : 140;
  const cols = Math.max(1, Math.min(maxCols, Math.floor((width + gap) / (min + gap))));
  return { cols, cardWidth: width > 0 ? Math.floor((width - gap * (cols - 1)) / cols) : 0 };
}

/** TMDB media + id identifies a title independently of its translated name. */
export function remoteSearchResults(items: TItem[], local: Title[], type: 'all' | 'movie' | 'tv') {
  const keys = new Set(local.filter((t) => t.tmdb?.id).map((t) => `${t.tmdb?.m || t.media}:${t.tmdb!.id}`));
  return items.filter((x) => (type === 'all' || x.m === type) && !keys.has(x.key));
}

/** Undo only episodes changed by the batch; preserve previously watched episodes. */
export function changedEpisodes(nums: number[], seen: number[], wasComplete: boolean) {
  return nums.filter((n) => seen.includes(n) === wasComplete);
}
