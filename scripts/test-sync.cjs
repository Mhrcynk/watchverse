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
