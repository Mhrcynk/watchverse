import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const catalog=JSON.parse(fs.readFileSync(new URL('../src/data/catalog.json',import.meta.url),'utf8'));
const code=fs.readFileSync(new URL('../worker/index.js',import.meta.url),'utf8').replace("import catalog from '../src/data/catalog.json';",`const catalog=${JSON.stringify(catalog)};`);
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('retired anonymous web device routes cannot write or read',async()=>{
 for(const path of ['/sync','/devices']) for(const method of ['GET','POST']){
  const r=await worker.fetch(new Request('https://test.invalid'+path,{method}),{});
  assert.equal(r.status,410);
 }
});
test('mobile catalog does not require web hosting',async()=>{
 const r=await worker.fetch(new Request('https://test.invalid/catalog.json'),{});
 assert.equal(r.status,200);assert.deepEqual(await r.json(),catalog);
});
test('TMDB path allowlist still rejects arbitrary requests',async()=>{
 assert.equal((await worker.fetch(new Request('https://test.invalid/tmdb/account/1'),{})).status,404);
});
