/** Fill missing provider IDs only. Existing identities are never replaced by a lookup at a new position. */
export function attachEpisodeIds(episodes, providerEpisodes) {
 const byNumber=new Map(providerEpisodes.filter(e=>Number.isSafeInteger(e.id)&&e.id>0).map(e=>[`${e.season_number}:${e.episode_number}`,e.id]));
 const used=new Set(episodes.map(e=>e[3]).filter(Boolean));let added=0;
 const result=episodes.map(e=>{
  if(e[3])return [...e];
  const id=byNumber.get(`${e[0]}:${e[1]}`);
  if(!id||used.has(id))return [...e];
  used.add(id);added++;return [e[0],e[1],e[2],id];
 });
 return {episodes:result,added};
}
