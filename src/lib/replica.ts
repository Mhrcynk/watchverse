import type { State } from './types';
type Clock = Record<string,number>;
type Op = { id: string; clock: Clock; value?: unknown };
export type Replica = { version: 1; clock: Clock; entries: Record<string,Op[]>; counters: Record<string,{ path: string; delta: number }>; baseline: Record<string,number> };
const bad = new Set(['__proto__','constructor','prototype']);
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const path=(...parts:string[])=>JSON.stringify(parts);
const dominates=(a:Clock,b:Clock)=>Object.entries(b).every(([k,n])=>(a[k]||0)>=n);
const join=(a:Clock,b:Clock):Clock=>Object.fromEntries([...new Set([...Object.keys(a),...Object.keys(b)])].map(k=>[k,Math.max(a[k]||0,b[k]||0)]));
const mapFields=['watched','ratings','notes','touched','lib','dropped','branches'] as const;
const scalars=['onboarded','starter','name','mode','order','view','spoiler','dv'] as const;
function flatten(s:State):Record<string,unknown> {
 const out:Record<string,unknown>={};
 for(const k of scalars) if(s[k]!==undefined)out[path(k)]=s[k];
 for(const f of mapFields) for(const [k,v] of Object.entries(s[f]||{}))out[path(f,k)]=v;
 for(const f of ['list','follow'] as const) for(const k of s[f])out[path(f,k)]=true;
 for(const [series,ids] of Object.entries(s.episodeMarks||{}))for(const id of ids)out[path('episodeMarks',series,id)]=true;
 for(const [id,l] of Object.entries(s.lists||{})){
  const {items,...header}=l;out[path('lists',id)]=header;
  for(const item of items)out[path('listItems',id,item.k)]=item;
 }
 return out;
}
function counters(s:State) {
 const out:Record<string,number>={};
 for(const [mon,log]of Object.entries(s.log||{}))for(const f of ['f','e','m'] as const)out[path('log',mon,f)]=log[f];
 for(const [k,n]of Object.entries(s.rewatch||{}))out[path('rewatch',k)]=n;
 return out;
}
export function seedReplica(s:State):Replica {
 return {version:1,clock:{},entries:Object.fromEntries(Object.entries(flatten(s)).map(([p,value])=>[p,[{id:'seed:'+JSON.stringify(value),clock:{},value}]])),counters:{},baseline:counters(s)};
}
/** Keep all causally concurrent values. A deletion wins until a later observed edit.
 * Keeping the frontier (rather than just its winner) makes multi-device merges associative.
 */
function frontier(ops:Op[]):Op[]{
 const unique=[...new Map(ops.map(op=>[op.id,op])).values()];
 return unique.filter(a=>!unique.some(b=>a!==b&&dominates(b.clock,a.clock)&&!dominates(a.clock,b.clock))).sort((a,b)=>a.id.localeCompare(b.id));
}
export function mergeReplicas(a:Replica,b:Replica):Replica {
 const entries:Replica['entries']={};
 for(const p of new Set([...Object.keys(a.entries),...Object.keys(b.entries)]))entries[p]=frontier([...(a.entries[p]||[]),...(b.entries[p]||[])]);
 const baseline:Record<string,number>={};
 for(const p of new Set([...Object.keys(a.baseline),...Object.keys(b.baseline)]))baseline[p]=Math.max(a.baseline[p]||0,b.baseline[p]||0);
 return {version:1,clock:join(a.clock,b.clock),entries,counters:{...a.counters,...b.counters},baseline};
}
export function mergeAliases(a: State['episodeAliases'] = {}, b: State['episodeAliases'] = {}) {
 const out = { ...a };
 for (const [series, entries] of Object.entries(b)) {
  out[series] = { ...out[series] };
  for (const [from, to] of Object.entries(entries)) {
   if (out[series][from] && out[series][from] !== to) throw new Error('Bölüm kimliği çakışması: otomatik taşıma durduruldu.');
   out[series][from] = to;
  }
 }
 return out;
}
export function canonicalizeEpisodes(s: State, aliases: State['episodeAliases']): State {
 const resolve = (series: string, id: string) => {
  const seen = new Set<string>();
  while (aliases?.[series]?.[id]) { if (seen.has(id)) throw new Error('Geçersiz bölüm eşlemesi.'); seen.add(id); id = aliases[series][id]; }
  return id;
 };
 const marks = Object.fromEntries(Object.entries(s.episodeMarks || {}).map(([key,ids])=>[key,[...new Set(ids.map(id=>resolve(key,id)))].sort()]));
 let replica = s.replica;
 if (replica) {
  const entries: Replica['entries'] = {};
  for (const [p,ops] of Object.entries(replica.entries)) {
   const parts = JSON.parse(p) as string[];
   const target = parts[0] === 'episodeMarks' ? path(parts[0],parts[1],resolve(parts[1],parts[2])) : p;
   entries[target] = frontier([...(entries[target] || []),...ops]);
  }
  replica = { ...replica, entries };
 }
 return { ...s, episodeMarks: marks, episodeAliases: aliases, replica };
}

/** One user transaction gets a monotonically increasing device sequence, never wall time. */
export function recordReplica(before:State,after:State,actor:string):State {
 const aliases = mergeAliases(before.episodeAliases, after.episodeAliases);
 before = canonicalizeEpisodes(before, aliases);
 after = canonicalizeEpisodes(after, aliases);
 const old=before.replica||seedReplica(before), a=flatten(before),b=flatten(after);
 const ca=counters(before),cb=counters(after);
 const changed=[...new Set([...Object.keys(a),...Object.keys(b)])].filter(p=>!equal(a[p],b[p]));
 const deltas=[...new Set([...Object.keys(ca),...Object.keys(cb)])].filter(p=>(ca[p]||0)!==(cb[p]||0));
 if(!changed.length&&!deltas.length)return {...after,replica:old};
 const seq=(old.clock[actor]||0)+1,clock={...old.clock,[actor]:seq};
 const entries={...old.entries},events={...old.counters};
 for(const p of changed)entries[p]=[{id:`${actor}:${seq}:${p}`,clock,value:b[p]}];
 for(const p of deltas)events[`${actor}:${seq}:${p}`]={path:p,delta:(cb[p]||0)-(ca[p]||0)};
 return {...after,replica:{...old,clock,entries,counters:events}};
}
export function applyReplica(s:State,replica:Replica):State {
 const out={...s,replica,watched:{},ratings:{},notes:{},touched:{},lib:{},dropped:{},branches:{},list:[],follow:[],episodes:{},episodeMarks:{},lists:{},log:{},rewatch:{}} as State;
 const items:Record<string,State['lists'][string]['items']>={};
 for(const [p,ops]of Object.entries(replica.entries)){
  if(!ops.length||ops.some(op=>op.value===undefined))continue;
  const value=[...ops].sort((a,b)=>a.id.localeCompare(b.id)).at(-1)!.value;
  const [f,k,id]=JSON.parse(p) as string[];
  if([f,k,id].some(x=>bad.has(x)))continue;
  if((scalars as readonly string[]).includes(f)){(out as unknown as Record<string,unknown>)[f]=value;}
  else if((mapFields as readonly string[]).includes(f)){(out[f as typeof mapFields[number]] as Record<string,unknown>)[k]=value;}
  else if(f==='list'||f==='follow')out[f].push(k);
  else if(f==='episodeMarks')(out.episodeMarks![k]||=[]).push(id);
  else if(f==='lists')out.lists[k]={...(value as State['lists'][string]),items:[]};
  else if(f==='listItems')(items[k]||=[]).push(value as State['lists'][string]['items'][number]);
 }
 for(const [id,list]of Object.entries(out.lists))list.items=(items[id]||[]).sort((a,b)=>b.at-a.at||a.k.localeCompare(b.k));
 const totals={...replica.baseline};
 for(const e of Object.values(replica.counters))totals[e.path]=(totals[e.path]||0)+e.delta;
 for(const [p,n]of Object.entries(totals)){
  const [f,k,metric]=JSON.parse(p) as string[];
  if(bad.has(k))continue;
  if(f==='log'&&['f','e','m'].includes(metric))(out.log[k]||={f:0,e:0,m:0})[metric as 'f'|'e'|'m']=Math.max(0,n);
  if(f==='rewatch'&&n>0)out.rewatch[k]=Math.max(0,n);
 }
 // Deterministic projection; timestamps never determine causal ordering.
 out.list.sort();out.follow.sort();for(const ids of Object.values(out.episodeMarks!))ids.sort();
 return out;
}
export function validateReplica(value:unknown): asserts value is Replica {
 if(!value||typeof value!=='object')throw new Error('Geçersiz eşitleme kaydı.');
 const r=value as Replica;
 if(r.version!==1||!r.clock||!r.entries||!r.counters||!r.baseline)throw new Error('Eşitleme için uygulama güncellemesi gerekli.');
 const checkClock=(c:Clock)=>{if(!c||Object.entries(c).some(([k,n])=>bad.has(k)||!Number.isSafeInteger(n)||n<0))throw new Error('Geçersiz eşitleme saati.');};
 checkClock(r.clock);
 const checkPath=(p:string)=>{const a=JSON.parse(p);if(!Array.isArray(a)||a.length>3||a.some(x=>typeof x!=='string'||bad.has(x)))throw new Error('Geçersiz eşitleme alanı.');};
 for(const [p,ops]of Object.entries(r.entries)){checkPath(p);if(!Array.isArray(ops))throw new Error('Geçersiz eşitleme işlemi.');for(const op of ops){if(!op||typeof op.id!=='string')throw new Error('Geçersiz işlem kimliği.');checkClock(op.clock);}}
 for(const e of Object.values(r.counters)){checkPath(e.path);if(!Number.isFinite(e.delta))throw new Error('Geçersiz sayaç.');}
 for(const [p,n]of Object.entries(r.baseline)){checkPath(p);if(!Number.isFinite(n))throw new Error('Geçersiz sayaç.');}
}
