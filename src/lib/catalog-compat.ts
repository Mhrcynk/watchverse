import { compatibleLayout, titleLayout } from './episode-identity';
import type { Title } from './types';
/** Legacy marks use 1-based array positions. Reject a catalog that would reinterpret them.
 * Keep this conservative fallback for records without immutable provider episode IDs.
 */
export function episodeLayoutCompatible(before: readonly (readonly number[])[], after: readonly (readonly number[])[]): boolean {
  return before.length <= after.length && before.every((ep,i)=>ep[0]===after[i][0]&&ep[1]===after[i][1]);
}
export function catalogCompatible(before: {id:string;ep: readonly (readonly (number|null|undefined)[])[]}[], after: {id:string;ep: readonly (readonly (number|null|undefined)[])[]}[]): boolean {
  const next=new Map(after.map(t=>[t.id,t]));
  return before.every(t=>{
    const n=next.get(t.id);
    return !!n && compatibleLayout(titleLayout(t as Pick<Title,'id'|'ep'>),titleLayout(n as Pick<Title,'id'|'ep'>));
  });
}
export function seasonsCompatible(before: {n:number;count:number}[], after: {n:number;count:number}[]): boolean {
  const expand=(seasons:{n:number;count:number}[])=>seasons.flatMap(s=>Array.from({length:s.count},(_,i)=>[s.n,i+1]));
  return episodeLayoutCompatible(expand(before),expand(after));
}
