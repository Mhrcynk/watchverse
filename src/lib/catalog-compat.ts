/** Legacy marks use 1-based array positions. Reject a catalog that would reinterpret them.
 * This is a safety gate until immutable provider episode IDs and migration are implemented.
 */
export function episodeLayoutCompatible(before: readonly (readonly number[])[], after: readonly (readonly number[])[]): boolean {
  return before.length <= after.length && before.every((ep,i)=>ep[0]===after[i][0]&&ep[1]===after[i][1]);
}
export function catalogCompatible(before: {id:string;ep: readonly (readonly (number|null)[])[]}[], after: {id:string;ep: readonly (readonly (number|null)[])[]}[]): boolean {
  const next=new Map(after.map(t=>[t.id,t]));
  return before.every(t=>{
    const n=next.get(t.id);
    return !!n && episodeLayoutCompatible(t.ep.map(e=>[e[0]!,e[1]!]),n.ep.map(e=>[e[0]!,e[1]!]));
  });
}
export function seasonsCompatible(before: {n:number;count:number}[], after: {n:number;count:number}[]): boolean {
  const expand=(seasons:{n:number;count:number}[])=>seasons.flatMap(s=>Array.from({length:s.count},(_,i)=>[s.n,i+1]));
  return episodeLayoutCompatible(expand(before),expand(after));
}
