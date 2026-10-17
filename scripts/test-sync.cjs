const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, file);
const { mergeStates } = require('../src/lib/sync-merge.ts');
const state = (patch = {}) => ({v:2, episodes:{},watched:{},list:[],follow:[],lists:{},lib:{},log:{},notes:{},ratings:{}, ...patch});
const merge = (b,a,c) => mergeStates(state(a),state(c),state(b));
test('offline deletion and unrelated addition survive either arrival order', () => {
 const b={watched:{a:1},list:['a']}, a={watched:{},list:[]}, c={watched:{a:1,b:2},list:['a','b']};
 for(const [x,y] of [[a,c],[c,a]]){const r=merge(b,x,y); assert.deepEqual(r.watched,{b:2});assert.deepEqual(r.list,['b']);}
});
test('unmarking last old episode preserves independent new episode',()=>{
 for(const [a,c] of [[{}, {show:[1,2]}],[{show:[1,2]},{}]]) assert.deepEqual(merge({episodes:{show:[1]}},{episodes:a},{episodes:c}).episodes,{show:[2]});
});
test('all episode memberships: commutative and expected three-way result',()=>{
 const arr=n=>[1,2,3,4].filter((_,i)=>n&(1<<i));
 for(let b=0;b<16;b++)for(let a=0;a<16;a++)for(let c=0;c<16;c++){
  const x=merge({episodes:{s:arr(b)}},{episodes:{s:arr(a)}},{episodes:{s:arr(c)}});
  const y=merge({episodes:{s:arr(b)}},{episodes:{s:arr(c)}},{episodes:{s:arr(a)}});
  const expected=(a&~b)|(c&~b)|(a&c&b);
  assert.deepEqual(x.episodes.s||[],arr(expected));assert.deepEqual(x.episodes,y.episodes);
 }
});
test('lost acknowledgement replay is idempotent',()=>{
 const b=state({list:['a'],log:{m:{f:2,e:0,m:10}}}), a=state({list:[],log:{m:{f:3,e:0,m:20}}});
 const first=mergeStates(a,b,b);assert.deepEqual(mergeStates(a,first,b),first);
});
test('merging never mutates input snapshots',()=>{
 const a=state({device:'A',log:{m:{f:1,e:0,m:30}}}),b=state({device:'B'});const before=JSON.stringify([a,b]);
 mergeStates(a,b,b);assert.equal(JSON.stringify([a,b]),before);
});
test('custom list item identity preserves unrelated additions, applies removal',()=>{
 const item=k=>({k,t:k}), list=items=>({lists:{l:{id:'l',items:items.map(item)}}});
 const r=merge(list(['a']),list([]),list(['a','b']));assert.deepEqual(r.lists.l.items,[item('b')]);
});
test('concurrent deletion wins over edit of the same record',()=>{
 assert.deepEqual(merge({notes:{a:'old'}},{notes:{}},{notes:{a:'edited',b:'new'}}).notes,{b:'new'});
});
test('after acknowledged sync, explicit re-add works',()=>{
 assert.deepEqual(merge({list:[]},{list:['a']},{list:[]}).list,['a']);
});

const {episodeLayoutCompatible,seasonsCompatible}=require('../src/lib/catalog-compat.ts');
test('catalog edits cannot silently shift legacy episode marks',()=>{
 assert(episodeLayoutCompatible([[1,1],[1,2]],[[1,1],[1,2],[2,1]]));
 assert(!episodeLayoutCompatible([[1,1],[2,1]],[[1,1],[1,2],[2,1]]));
 assert(!episodeLayoutCompatible([[1,1],[1,2]],[[1,2],[1,1]]));
 assert(!episodeLayoutCompatible([[1,1],[1,2]],[[1,1]]));
 assert(!seasonsCompatible([{n:1,count:2},{n:2,count:2}],[{n:1,count:3},{n:2,count:2}]));
 assert(seasonsCompatible([{n:1,count:2},{n:2,count:2}],[{n:1,count:2},{n:2,count:3}]));
});

const {createCheckpointStore,CHECKPOINT_KEY}=require('../src/lib/checkpoint-store.ts');
function disk(seed={}) {
 const data=new Map(Object.entries(seed));let fail=false;
 return {data,set fail(v){fail=v;},async getItem(k){return data.get(k)??null;},async setItem(k,v){if(fail)throw Error('disk full');data.set(k,v);}};
}
test('checkpoint restart keeps state and merge baseline in the same snapshot',async()=>{
 const d=disk(), c=createCheckpointStore(d);await c.load();
 const old=state({list:['a']}), next=state({list:[]});
 await c.commit(old,{uid:'u',rev:1,base:old});
 await c.commit(next,{uid:'u',rev:2,base:next});
 const recovered=await createCheckpointStore(d).load();
 assert.deepEqual(recovered.state,next);assert.deepEqual(recovered.meta.base,next);
});
test('storage failure preserves old checkpoint and retries latest edits visibly',async()=>{
 const d=disk(),c=createCheckpointStore(d);await c.load();
 await c.commit(state({list:['a']}),{rev:1});const events=[];c.subscribe(x=>events.push(x));
 d.fail=true;await assert.rejects(c.commit(state({list:['b']}),{rev:2}));
 assert.equal((await createCheckpointStore(d).load()).meta.rev,1);
 await assert.rejects(c.flush());d.fail=false;await c.flush();
 assert.deepEqual((await createCheckpointStore(d).load()).state.list,['b']);
 assert.deepEqual(events,[true,true,false]);
});
test('acknowledgement includes edits made while request was in flight',async()=>{
 const d=disk(),c=createCheckpointStore(d);await c.load();
 const sent=state({list:['a']});await c.commit(sent,{rev:1});
 await c.commit(state({list:['a','b']}));await c.saveMeta({rev:2,base:sent});
 const recovered=await createCheckpointStore(d).load();
 assert.deepEqual(recovered.state.list,['a','b']);assert.deepEqual(recovered.meta.base.list,['a']);
});
test('queued writes serialize and snapshot mutable caller input',async()=>{
 const d=disk();let release;let calls=0;const writes=[];
 const c=createCheckpointStore({...d,async setItem(k,v){writes.push(JSON.parse(v));if(++calls===1)await new Promise(r=>release=r);await d.setItem(k,v);}});
 await c.load();const first=state({list:['a']});const a=c.commit(first,{rev:1});first.list.push('mutated');
 const b=c.commit(state({list:['b']}),{rev:2});await new Promise(r=>setImmediate(r));assert.equal(calls,1);
 release();await Promise.all([a,b]);assert.deepEqual(writes[0].state.list,['a']);assert.equal(writes[1].meta.rev,2);
});
test('legacy migration retains originals; corrupt checkpoint never falls back or overwrites',async()=>{
 const legacy=JSON.stringify(state({list:['a']})),d=disk({'watchverse:v2':legacy,'watchverse:sync':'{"rev":1}'});
 const c=createCheckpointStore(d),loaded=await c.load();await c.commit(loaded.state,loaded.meta);
 assert.equal(d.data.get('watchverse:v2'),legacy);
 d.data.set(CHECKPOINT_KEY,'{"format":99}');const broken=createCheckpointStore(d);
 await assert.rejects(broken.load());assert.throws(()=>broken.commit(state()));assert.equal(d.data.get(CHECKPOINT_KEY),'{"format":99}');
});

const {createSessionGuard}=require('../src/lib/session-guard.ts');
test('late response from a previous login cannot apply after same user logs in again',async()=>{
 const guard=createSessionGuard();guard.switchUser('A');const ticket=guard.capture('A');
 let resolve;const response=new Promise(r=>resolve=r);let applied=false;
 const job=response.then(()=>{if(guard.active(ticket))applied=true;});
 guard.switchUser(null);guard.switchUser('A');resolve();await job;
 assert.equal(applied,false);assert.equal(guard.active(guard.capture('A')),true);
});
test('queued account A work cannot apply to B or a later A session',()=>{
 const guard=createSessionGuard();guard.switchUser('A');const a=guard.capture('A');
 guard.switchUser('B');assert.equal(guard.active(a),false);assert.equal(guard.capture('A'),null);
 guard.switchUser('A');assert.equal(guard.active(a),false);
});
test('deletion pauses sync; failed deletion resumes only fresh work',()=>{
 const guard=createSessionGuard();guard.switchUser('A');const old=guard.capture('A');
 const deletion=guard.pause('A');assert.ok(deletion);assert.equal(guard.active(old),false);
 assert.equal(guard.capture('A'),null);assert.equal(guard.pause('A'),null);assert.equal(guard.matches(deletion),true);
 guard.resume(deletion);assert.equal(guard.active(old),false);assert.equal(guard.active(guard.capture('A')),true);
});
test('old deletion completion cannot resume or authorize work in another account',()=>{
 const guard=createSessionGuard();guard.switchUser('A');const a=guard.pause('A');
 guard.switchUser('B');const b=guard.pause('B');guard.resume(a);
 assert.equal(guard.matches(a),false);assert.equal(guard.isPaused(),true);assert.equal(guard.matches(b),true);
});
test('token refresh keeps active work; unmount invalidation rejects outstanding work',()=>{
 const guard=createSessionGuard();guard.switchUser('A');const ticket=guard.capture('A');
 guard.switchUser('A');assert.equal(guard.active(ticket),true);guard.invalidate();assert.equal(guard.active(ticket),false);
});
test('retained account records keep ownership after restart and storage failure',async()=>{
 const d=disk(),c=createCheckpointStore(d);await c.load();await c.commit(state({list:['private']}),{uid:'deleted-account',rev:4});
 // Account deletion must not clear metadata while retaining the local data.
 const localMeta=(await c.load()).meta;await c.saveMeta(localMeta);
 const recovered=await createCheckpointStore(d).load();assert.equal(recovered.meta.uid,'deleted-account');assert.deepEqual(recovered.state.list,['private']);
 d.fail=true;await assert.rejects(c.saveMeta(localMeta));
 assert.equal((await createCheckpointStore(d).load()).meta.uid,'deleted-account');
});

const {seedReplica,recordReplica,mergeReplicas,applyReplica,validateReplica}=require('../src/lib/replica.ts');
const {titleLayout,libraryLayout,normalizeEpisodes,recordEpisodeChanges,compatibleLayout}=require('../src/lib/episode-identity.ts');
const replicated=(patch={})=>{const s=state(patch);return {...s,replica:seedReplica(s)};};
const edit=(s,patch,actor)=>recordReplica(s,{...s,...patch},actor);
const combine=(a,b)=>applyReplica(a,mergeReplicas(a.replica,b.replica));
test('three offline devices converge in every delivery order and deletion stays deleted',()=>{
 const base=replicated({notes:{x:'old'},list:['x']});
 const a=edit(base,{notes:{},list:[]},'A'),b=edit(base,{notes:{x:'edited'}},'B'),c=edit(base,{notes:{x:'old',y:'new'},list:['x','y']},'C');
 for(const [x,y,z]of [[a,b,c],[a,c,b],[b,a,c],[b,c,a],[c,a,b],[c,b,a]]){
  const r=combine(combine(x,y),z);assert.deepEqual(r.notes,{y:'new'});assert.deepEqual(r.list,['y']);
  assert.deepEqual(combine(r,base).notes,{y:'new'});
 }
 assert.deepEqual(combine(combine(a,b),c).replica,combine(a,combine(b,c)).replica);
});
test('causally later re-add survives while an unobserved stale edit cannot resurrect',()=>{
 const base=replicated({list:['x']}),deleted=edit(base,{list:[]},'A');
 const observed=combine(base,deleted),again=edit(observed,{list:['x']},'B');
 assert.deepEqual(combine(again,deleted).list,['x']);assert.deepEqual(combine(deleted,base).list,[]);
});
test('independent watch counters add once, duplicate replies and stale snapshots do not inflate them',()=>{
 const base=replicated({log:{m:{f:1,e:0,m:20}}});
 const a=edit(base,{log:{m:{f:2,e:0,m:50}}},'A'),b=edit(base,{log:{m:{f:2,e:0,m:60}}},'B');
 const r=combine(a,b);assert.deepEqual(r.log.m,{f:3,e:0,m:90});assert.deepEqual(combine(combine(r,a),b).log,r.log);
});
test('list deletion wins against concurrent item addition, independent items survive',()=>{
 const l={id:'abcdef',name:'list',created:1,updated:1,items:[]};const base=replicated({lists:{abcdef:l}});
 const a=edit(base,{lists:{}},'A'),b=edit(base,{lists:{abcdef:{...l,items:[{k:'x',at:2,t:'X'}]}}},'B');
 assert.deepEqual(combine(a,b).lists,{});
 const c=edit(base,{lists:{abcdef:{...l,items:[{k:'y',at:3,t:'Y'}]}}},'C');
 assert.deepEqual(combine(b,c).lists.abcdef.items.map(x=>x.k),['y','x']);
});
test('checkpoint crash/restart retains causal tombstones and local actor identity',async()=>{
 const d=disk(),c=createCheckpointStore(d);await c.load();await c.saveMeta({actor:'device-A'});
 const base=replicated({list:['x']}),deleted=edit(base,{list:[]},'device-A');await c.commit(deleted,{uid:'u',rev:1});
 const loaded=await createCheckpointStore(d).load();assert.equal(loaded.meta.actor,'device-A');assert.deepEqual(combine(loaded.state,base).list,[]);
});
test('episode IDs preserve marks on reorder, insertion and season renumbering',()=>{
 const old=titleLayout({id:'show',ep:[[1,1,30,101],[1,2,30,102]]});
 const next=titleLayout({id:'show',ep:[[2,1,30,102],[1,0,30,103],[3,1,30,101]]});
 assert.equal(compatibleLayout(old,next),true);
 const s=normalizeEpisodes(state({episodes:{show:[2]}}),{show:old});
 const r=normalizeEpisodes(s,{show:next});assert.deepEqual(r.episodes.show,[1]);assert.deepEqual(r.episodeMarks.show,['tmdb:102']);
});
test('removed episodes remain recoverable; unmarking another episode does not erase hidden marks',()=>{
 const old=titleLayout({id:'show',ep:[[1,1,30,101],[1,2,30,102]]}), next=titleLayout({id:'show',ep:[[1,1,30,101]]});
 const s=normalizeEpisodes(state({episodes:{show:[1,2]}}),{show:old});const r=normalizeEpisodes(s,{show:next});
 const changed=recordEpisodeChanges(r,{...r,episodes:{}},{show:next});assert.deepEqual(changed.episodeMarks.show,['tmdb:102']);
 assert.deepEqual(normalizeEpisodes(changed,{show:old}).episodes.show,[2]);
});
test('ambiguous legacy remapping is blocked and unknown legacy positions are retained',()=>{
 const old=titleLayout({id:'show',ep:[[1,1,30],[1,2,30]]}),bad=titleLayout({id:'show',ep:[[2,1,30],[2,2,30]]});
 assert.equal(compatibleLayout(old,bad),false);
 const s=normalizeEpisodes(state({episodes:{show:[2,99]}}),{show:old});assert.deepEqual(s.unresolvedEpisodes.show,[99]);
 assert.deepEqual(normalizeEpisodes(s,{show:bad}).episodeLayouts.show,old);
});
test('library metadata upgrades provisional identities only at matching coordinates',()=>{
 const item={m:'tv',seasons:[{n:1,count:2}]};const old=libraryLayout('tv:1',item),next=libraryLayout('tv:1',{...item,episodeIds:{s1e1:101,s1e2:102}});
 const s=normalizeEpisodes(state({episodes:{'tv:1':[2]}}),{'tv:1':old});assert.deepEqual(normalizeEpisodes(s,{'tv:1':next}).episodeMarks['tv:1'],['tmdb:102']);
});
test('unsupported replication versions and prototype-bearing paths fail closed',()=>{
 assert.throws(()=>validateReplica({version:99}));const r=seedReplica(state());r.entries['["notes","__proto__"]']=[];assert.throws(()=>validateReplica(r));
});
test('provider-ID migration is not a new watch event and cannot undo an offline unmark',()=>{
 const old=titleLayout({id:'show',ep:[[1,1,30]]}),next=titleLayout({id:'show',ep:[[1,1,30,101]]});
 const base=normalizeEpisodes(state({episodes:{show:[1]}}),{show:old});base.replica=seedReplica(base);
 const upgraded=normalizeEpisodes(base,{show:next});const a=recordReplica(base,upgraded,'A');
 const removed=recordEpisodeChanges(base,{...base,episodes:{}},{show:old});const b=recordReplica(base,removed,'B');
 const merged=mergeStates(a,b,base);assert.deepEqual(merged.episodeMarks,{});
});
test('catalog enrichment fills missing IDs without changing existing identities or duplicating IDs',async()=>{
 const {attachEpisodeIds}=await import('./catalog-episode-ids.mjs');
 const r=attachEpisodeIds([[1,1,30,101],[1,2,30],[1,3,30]],[{season_number:1,episode_number:1,id:999},{season_number:1,episode_number:2,id:102},{season_number:1,episode_number:3,id:101}]);
 assert.deepEqual(r.episodes,[[1,1,30,101],[1,2,30,102],[1,3,30]]);assert.equal(r.added,1);
});
test('first login to an empty cloud account preserves guest records',()=>{
 const guest=replicated({notes:{guest:'keep'},list:['guest']});
 const cloud=state();const merged=mergeStates(guest,cloud);
 assert.deepEqual(merged.notes,{guest:'keep'});assert.deepEqual(merged.list,['guest']);
});

const {sanitize}=require('../src/lib/state-validation.ts');
const {initialState}=require('../src/lib/state-defaults.ts');
const {localTransition}=require('../src/lib/state-transition.ts');
test('real store transition, backup serialization and reload preserve episode unmarks',()=>{
 const key='tv:123';let s=sanitize({...initialState(),lib:{[key]:{m:'tv',id:123,title:'Series',seasons:[{n:1,count:2}],episodeIds:{s1e1:101,s1e2:102}}},episodes:{[key]:[1,2]}});
 s={...s,replica:seedReplica(s)};
 const changed=localTransition(s,x=>({...x,episodes:{[key]:[2]}}),'device-A');
 const restored=sanitize(JSON.parse(JSON.stringify(changed)));
 assert.deepEqual(restored.episodes[key],[2]);assert.deepEqual(restored.episodeMarks[key],['tmdb:102']);
 const stale=sanitize(s);assert.deepEqual(sanitize(mergeStates(restored,stale,s)).episodes[key],[2]);
});
test('import and reset treat stable marks as authoritative, including hidden episodes',()=>{
 const key='tv:123';const original=sanitize({...initialState(),lib:{[key]:{m:'tv',id:123,title:'Series',seasons:[{n:1,count:1}],episodeIds:{s1e1:101}}},episodes:{[key]:[1]}});
 const s={...original,replica:seedReplica(original)};
 const reset=localTransition(s,{...initialState(),lib:s.lib,episodeMarks:{}},'device-A');
 assert.deepEqual(sanitize(JSON.parse(JSON.stringify(reset))).episodes,{});
 const imported=localTransition(reset,original,'device-A');assert.deepEqual(sanitize(imported).episodes[key],[1]);
});

test('unresolved legacy positions from both devices survive merge and backup reload',()=>{
 const base=initialState();const a={...base,replica:seedReplica(base),unresolvedEpisodes:{'tv:123':[8]}};
 const b={...base,replica:seedReplica(base),unresolvedEpisodes:{'tv:123':[9]}};
 for(const [x,y] of [[a,b],[b,a]])assert.deepEqual(sanitize(mergeStates(x,y)).unresolvedEpisodes['tv:123'],[8,9]);
 assert.throws(()=>sanitize({...base,unresolvedEpisodes:{'tv:123':[-1]}}),/Geçersiz/);
});
