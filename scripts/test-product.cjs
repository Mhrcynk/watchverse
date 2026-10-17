const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,file);
const {createJsonClient}=require('../src/lib/http.ts');
const {catchUpSelection}=require('../src/lib/catch-up.ts');
const {backupSummary,decodeBackup,toBase64}=require('../src/lib/backup-code.ts');
const {initialState}=require('../src/lib/state-defaults.ts');
const {createCheckpointStore}=require('../src/lib/checkpoint-store.ts');
test('concurrent GETs share work; transient failure retries once',async()=>{
 let calls=0;const get=createJsonClient(async()=>{calls++;await new Promise(r=>setTimeout(r,2));return calls===1?{ok:false,status:503}:{ok:true,json:async()=>({ok:true})};},50,0);
 const results=await Promise.all([get('a'),get('a')]);assert.equal(calls,2);assert.deepEqual(results,[{ok:true},{ok:true}]);
});
test('404 is not retried and rejection does not poison later work',async()=>{
 let calls=0;const get=createJsonClient(async()=>{calls++;return {ok:false,status:404};},50,0);
 await assert.rejects(get('a'),/404/);await assert.rejects(get('a'),/404/);assert.equal(calls,2);
});
test('hung body times out and aborts both attempts',async()=>{
 let aborts=0;const get=createJsonClient(async(_url,{signal})=>{signal.addEventListener('abort',()=>aborts++);return {ok:true,json:()=>new Promise(()=>{})};},5,0);
 await assert.rejects(get('a'),/zaman aşımı/);assert.equal(aborts,2);
});
test('catch-up includes earlier seasons, excludes future and rejects unknown endpoint',()=>{
 const eps=[{n:1,season:1,episode:1,aired:true},{n:2,season:1,episode:2,aired:true},{n:3,season:2,episode:1,aired:true},{n:4,season:2,episode:2,aired:false}];
 assert.deepEqual(catchUpSelection(eps,2,1),[1,2,3]);assert.throws(()=>catchUpSelection(eps,2,2));assert.throws(()=>catchUpSelection(eps,3,1));
});
test('backup preview supports legacy data, Turkish text and unknown date; rejects unrelated JSON',()=>{
 const s={...initialState(),name:'Çağrı',episodeMarks:{series:['tmdb:1','tmdb:2']},unresolvedEpisodes:{series:[99]}};
 const code='WATCHVERSE:'+toBase64(JSON.stringify(s));const summary=backupSummary(code);
 assert.equal(summary.episodes,2);assert.equal(summary.unresolved,1);assert.equal(summary.createdAt,null);assert.equal(decodeBackup(code).state.name,'Çağrı');
 assert.throws(()=>decodeBackup(toBase64('{}')));assert.throws(()=>decodeBackup('invalid'));
 assert.equal(backupSummary(toBase64(JSON.stringify({...s,backupCreatedAt:100}))).createdAt,100);
});
test('saved status appears only when the whole checkpoint queue has completed',async()=>{
 const releases=[];const cp=createCheckpointStore({getItem:async()=>null,setItem:()=>new Promise(r=>releases.push(r))});await cp.load();
 const one=cp.commit(initialState());const two=cp.commit(initialState());assert.equal(cp.getStatus(),'saving');
 await new Promise(r=>setImmediate(r));releases.shift()();await one;assert.equal(cp.getStatus(),'saving');
 await new Promise(r=>setImmediate(r));releases.shift()();await two;assert.equal(cp.getStatus(),'saved');
});
const {updateEpisodeBatch}=require('../src/lib/episode-actions.ts');
test('historical catch-up and undo preserve dated stats, existing marks and reject invalid positions',()=>{
 const base={...initialState(),episodes:{'tv:1':[1]},log:{'2026-10':{f:2,e:3,m:120}}};
 const caught=updateEpisodeBatch(base,'tv:1',[1,2,3,0,2.5,20001],true,false);
 assert.deepEqual(caught.episodes['tv:1'],[1,2,3]);assert.deepEqual(caught.log,base.log);
 const undo=updateEpisodeBatch(caught,'tv:1',[2,3],false,false);assert.deepEqual(undo.episodes,base.episodes);assert.deepEqual(undo.log,base.log);
});
