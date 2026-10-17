import { TBY } from './catalog';
import type { State } from './types';
import { bumpEps } from './watch-stats';
/** Historical catch-up deliberately leaves date-based statistics unchanged, including undo. */
export function updateEpisodeBatch(s:State,key:string,nums:number[],value:boolean,trackToday=true):State {
  const max=TBY[key]?.episodes || 20000;
  const set=new Set(s.episodes[key] || []);
  for(const n of nums)if(Number.isInteger(n) && n>=1 && n<=max){if(value)set.add(n);else set.delete(n);}
  const episodes={...s.episodes};
  if(set.size)episodes[key]=[...set].sort((a,b)=>a-b);else delete episodes[key];
  return {...s,episodes,touched:{...s.touched,[key]:Date.now()},log:trackToday?bumpEps(s,key,s.episodes[key] || [],episodes[key] || []):s.log};
}
