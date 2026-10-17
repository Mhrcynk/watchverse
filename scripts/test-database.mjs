import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.role() returns text language sql as $$select current_user::text$$;
grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
`);
const schema=fs.readFileSync(new URL('../supabase/schema.sql',import.meta.url),'utf8');
await db.exec(schema);await db.exec(schema);
const A='11111111-1111-1111-1111-111111111111', B='22222222-2222-2222-2222-222222222222';
await db.query('insert into auth.users values($1),($2)',[A,B]);
async function as(uid,fn){await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);try{return await fn();}finally{await db.exec('reset role');}}
const save=(name,data,rev)=>db.query(`select public.${name}($1::jsonb,$2::bigint) as rev`,[JSON.stringify(data),rev]);
await as(A,async()=>{
 assert.equal((await save('save_state',{v:2},0)).rows[0].rev,1);
 assert.equal((await save('save_state_v3',{v:2,list:['a']},1)).rows[0].rev,2);
 assert.equal((await save('save_state_v3',{v:2,list:[]},1)).rows[0].rev,-2);
 await assert.rejects(save('save_state',{v:2},2),/guncellemesi/);
 await assert.rejects(save('save_state_v3',{v:2},null),/surum/);
 await assert.rejects(db.exec("update public.user_state set data='{}'"),/permission/);
 await db.query("select register_native_device($1,$2,'[]','[]')",['aaaaaaaa-aaaaaaaa','ExpoPushToken[testtoken]']);
});
await as(B,async()=>{
 assert.equal((await db.exec('select * from user_state'))[0].rows.length,0);
 await assert.rejects(db.query("select register_native_device($1,$2,'[]','[]')",['aaaaaaaa-aaaaaaaa','ExpoPushToken[attacker]']),/izin/);
 assert.equal((await db.exec('delete from native_devices returning id'))[0].rows.length,0);
 assert.equal((await db.exec('select * from native_devices'))[0].rows.length,0);
});
const saveV4=(owner,data,rev)=>db.query('select public.save_state_v4($1::jsonb,$2::bigint,$3::uuid) as rev',[JSON.stringify(data),rev,owner]);
await as(B,async()=>{
 await assert.rejects(saveV4(A,{v:2,list:['stolen']},0),/oturum degisti/);
 await assert.rejects(db.query('select delete_my_account_v2($1)',[A]),/oturum degisti/);
 assert.equal((await db.exec('select * from user_state'))[0].rows.length,0);
});
await as(A,async()=>{
 await assert.rejects(saveV4(null,{v:2},2),/oturum degisti/);
 await assert.rejects(db.query('select delete_my_account_v2(null)'),/oturum degisti/);
 assert.equal((await saveV4(A,{v:2,list:['a']},2)).rows[0].rev,3);
 assert.equal((await saveV4(A,{v:2,list:[]},2)).rows[0].rev,-3);
 await assert.rejects(save('save_state_v3',{v:2},3),/guncellemesi/);
});
// New causal writer cannot be overwritten by a client that drops tombstones.
const saveV5=(owner,data,rev)=>db.query('select save_state_v5($1::jsonb,$2::bigint,$3::uuid) as rev',[JSON.stringify(data),rev,owner]);
const causal={v:2,list:['a'],replica:{version:1,clock:{},entries:{},counters:{},baseline:{}}};
await as(A,async()=>{
 await assert.rejects(saveV5(A,{v:2},3),/protokolu/);
 assert.equal((await saveV5(A,causal,3)).rows[0].rev,4);
 await assert.rejects(saveV4(A,{v:2},4),/guncellemesi/);
 await db.query("select share_list_v2('testslug1','Owner A','[]','A',$1)",[A]);
 await assert.rejects(db.query("select share_list_v2(null,'x','[]','A',$1)",[A]),/baglanti/);
 await assert.rejects(db.query("select share_list_v2('testslug2','x',null,'A',$1)",[A]),/liste/);
 await db.query("select register_native_device_v2('bbbbbbbb-bbbbbbbb','ExpoPushToken[second]','[]','[]',$1)",[A]);
 await db.query("select unregister_native_device('bbbbbbbb-bbbbbbbb',$1)",[A]);
 await assert.rejects(db.query("select register_native_device_v2('bbbbbbbb-bbbbbbbb','ExpoPushToken[second]','[]','[]',$1)",[A]),/iptal/);
 await assert.rejects(db.exec("select register_native_device('bbbbbbbb-bbbbbbbb','ExpoPushToken[second]','[]','[]')"),/iptal/);
});
await as(B,async()=>{
 await assert.rejects(saveV5(A,causal,0),/oturum/);
 await assert.rejects(db.query("select share_list_v2('testslug1','Stolen','[]','B',$1)",[B]),/izin/);
 await assert.rejects(db.query("select unshare_list_v2('testslug1',$1)",[A]),/oturum/);
 await assert.rejects(db.query("select my_profile_v2('wrong',$1)",[A]),/oturum/);
 await assert.rejects(db.query("select friend_feed_v2($1)",[A]),/oturum/);
 await assert.rejects(db.query("select unregister_native_device('aaaaaaaa-aaaaaaaa',$1)",[B]),/izin/);
 await assert.rejects(db.query("select register_native_device_v2('cccccccc-cccccccc','ExpoPushToken[third]','[]','[]',$1)",[A]),/oturum/);
 await db.query("select unshare_list_v2('testslug1',$1)",[B]); // no ownership: no change
});
assert.equal((await db.exec("select name from shared_lists where slug='testslug1'"))[0].rows[0].name,'Owner A');
// Receiver quota also applies; parallel acceptance is serialized by ordered account locks.
await db.exec("insert into auth.users select md5(i::text)::uuid from generate_series(1,200) i");
await db.query("insert into friendships(a,b) select $1,md5(i::text)::uuid from generate_series(1,200) i",[B]);
const invite=(await as(B,()=>db.query("select my_profile_v2('B',$1) as p",[B]))).rows[0].p.code;
await as(A,()=>assert.rejects(db.query('select accept_invite_v2($1,$2,$3)',[invite,'A',A]),/siniri/));
await db.exec('set role anon');
await assert.rejects(save('save_state_v3',{},0),/permission/);
await assert.rejects(saveV4(A,{},0),/permission/);
await assert.rejects(saveV5(A,causal,0),/permission/);
await assert.rejects(db.query('select unregister_native_device($1,$2)',['aaaaaaaa-aaaaaaaa',A]),/permission/);
await assert.rejects(db.query('select delete_my_account_v2($1)',[A]),/permission/);
await assert.rejects(db.exec("select register_native_device('aaaaaaaa-aaaaaaaa','ExpoPushToken[x]','[]','[]')"),/permission/);
await db.exec('reset role');
assert.equal((await db.exec('select token from native_devices'))[0].rows[0].token,'ExpoPushToken[testtoken]');
const backup = await db.dumpDataDir();
const restored = new PGlite({loadDataDir:backup});
assert.equal((await restored.exec('select token from native_devices'))[0].rows[0].token,'ExpoPushToken[testtoken]');
assert.deepEqual((await restored.exec('select data from user_state'))[0].rows[0].data,causal);
await restored.close();
await as(A,async()=>{await db.query('select delete_my_account_v2($1)',[A]);});
assert.equal((await db.exec('select * from native_devices'))[0].rows.length,0);
await db.close();
console.log('PASS: repeatable schema, CAS, initiating-account checks, old writer guard, direct write denial, cross-account state/device isolation, anonymous RPC denial, deletion cascade, local snapshot restore. PGlite only; not a production/concurrency test.');
