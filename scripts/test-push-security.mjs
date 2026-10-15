import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const code = fs.readFileSync(new URL('../worker/index.js', import.meta.url), 'utf8');
const { default: worker, adminKey } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const sub = { endpoint: 'https://web.push.apple.com/test', keys: { p256dh: 'a'.repeat(87), auth: 'b'.repeat(22) } };
const body = { id: 'aaaaaaaa-aaaa-aaaa', sub, follow: ['marvel'], tv: [123] };
const request = (payload = body) => new Request('https://worker.invalid/sync', { method: 'POST', body: JSON.stringify(payload) });
function env() { return { TMDB_TOKEN: 'test', SUPABASE_URL: 'https://db.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test', SYNC_LIMITER: { limit: async () => ({ success: true }) }, WV: { put: async () => {}, list: async () => ({ keys: [], list_complete: true }) } }; }
test('missing settings fail closed', async () => { const e = env(); delete e.SUPABASE_URL; assert.equal((await worker.fetch(request(), e)).status, 503); });
test('database HTTP failures are not reported as success', async () => { globalThis.fetch = async () => new Response('', { status: 409 }); assert.equal((await worker.fetch(request(), env())).status, 503); });
test('upsert keeps preferences and removes superseded device endpoint', async () => {
  const calls = []; globalThis.fetch = async (url, init) => { calls.push({ url, ...init }); return new Response(null, { status: 204 }); };
  assert.equal((await worker.fetch(request(), env())).status, 200);
  assert.match(calls[0].url, /on_conflict=endpoint/); const saved = JSON.parse(calls[0].body);
  assert.deepEqual(saved.follow, body.follow); assert.deepEqual(saved.tv, body.tv); assert.equal(saved.device_id, body.id);
  assert.equal(calls[1].method, 'DELETE'); assert.match(calls[1].url, /endpoint=neq/);
});
test('null subscription removes device record', async () => {
  const calls = []; globalThis.fetch = async (url, init) => { calls.push(init); return new Response(null, { status: 204 }); };
  assert.equal((await worker.fetch(request({ ...body, sub: null }), env())).status, 200); assert.equal(calls[0].method, 'DELETE');
});
test('invalid inputs and arbitrary push hosts are rejected', async () => {
  for (const value of [null, [], { ...body, sub: { ...sub, endpoint: 'https://example.com/' } }, { ...body, sub: { ...sub, keys: {} } }]) assert.equal((await worker.fetch(request(value), env())).status, 400);
  assert.equal((await worker.fetch(request({ ...body, padding: 'x'.repeat(60000) }), env())).status, 413);
});
test('rate limit stops writes', async () => { const e = env(); e.SYNC_LIMITER.limit = async () => ({ success: false }); assert.equal((await worker.fetch(request(), e)).status, 429); });
test('devices require admin, paginate and retain notifier contract and legacy records', async () => {
  const e = env(); e.WV.list = async () => ({ keys: [{ name: 'dev:legacy' }], list_complete: true }); e.WV.get = async () => JSON.stringify({ sub: { ...sub, endpoint: sub.endpoint + '/old' }, tv: [99], follow: ['dc'] });
  let calls = 0; globalThis.fetch = async () => Response.json(calls++ === 0 ? [{ endpoint: sub.endpoint, subscription: sub, device_id: body.id, follow: body.follow, tv: body.tv }] : []);
  assert.equal((await worker.fetch(new Request('https://worker.invalid/devices'), e)).status, 403);
  const r = await worker.fetch(new Request('https://worker.invalid/devices', { headers: { 'x-admin': await adminKey(e.TMDB_TOKEN) } }), e);
  const rows = await r.json(); assert.equal(rows.filter(d => d.sub).length, 2); assert.deepEqual(rows[1].tv, [123]); assert.equal(calls, 2);
});
