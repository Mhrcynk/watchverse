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
