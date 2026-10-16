export type EpisodePosition = { n:number; season:number; episode:number; aired:boolean; id?:number };
export function catchUpSelection(items:EpisodePosition[], season:number, episode:number) {
  if (!Number.isInteger(season) || !Number.isInteger(episode) || episode<1 || !items.some(x=>x.season===season && x.episode===episode && x.aired)) throw new Error('Yayınlanmış bir bölüm seç.');
  return items.filter(x=>x.aired && (x.season<season || (x.season===season && x.episode<=episode))).map(x=>x.n);
}
