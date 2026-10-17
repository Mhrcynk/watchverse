// Synthetic payload sizing, not a server load/latency or real-device benchmark.
const fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,file);
const {initialState}=require('../src/lib/state-defaults.ts');
const {seedReplica}=require('../src/lib/replica.ts');
const rows=[];
for(const [episodes,events] of [[1000,1000],[5000,5000],[10000,10000]]) {
 const state={...initialState(),episodeMarks:{},episodeLayouts:{}};
 for(let i=0;i<episodes;i++) {
  const key='tv:'+Math.floor(i/100),id='tmdb:'+i;
  (state.episodeMarks[key]||=[]).push(id);
  const layout=state.episodeLayouts[key]||={ids:[],coordinates:[]};layout.ids.push(id);layout.coordinates.push('s1e'+(i%100+1));
 }
 state.replica=seedReplica(state);
 for(let i=0;i<events;i++)state.replica.counters['device:'+i+':["log","2026-10","e"]']={path:'["log","2026-10","e"]',delta:1};
 const bytes=Buffer.byteLength(JSON.stringify(state));
 rows.push({episodes,counterEvents:events,jsonBytes:bytes,percentOf2MB:Math.round(bytes/2000000*100)});
}
console.log(JSON.stringify({note:'Synthetic UTF-8 JSON only; PostgreSQL jsonb overhead, real histories, devices and network must be measured separately.',rows},null,2));
