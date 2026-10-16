// Run actual pure application modules without a device or extra test dependencies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const original = Module._resolveFilename;
Module._resolveFilename = function (id, ...args) {
  if (id.startsWith('@/')) id = path.join(root, 'src', id.slice(2));
  return original.call(this, id, ...args);
};
const load = Module._load;
Module._load = function (id, ...args) {
  if (id === 'react-native') return { Platform: { OS: 'web' } };
  return load.call(this, id, ...args);
};
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, file);
const { CATALOG, UNIVERSES } = require('../src/lib/catalog.ts');
const { universeProgress, route, remaining, isDone } = require('../src/lib/progress.ts');
const { posterGrid, remoteSearchResults, changedEpisodes } = require('../src/lib/audit-logic.ts');
const state = { watched: {}, episodes: {}, branches: {}, view: 'main' };
const iron = CATALOG.find(t => t.id === 'iron');
assert(iron);
state.watched[iron.id] = 1;
for (const u of UNIVERSES) {
  const expected = universeProgress(state, u.id);
  for (const view of ['main', 'release', 'chrono', 'all']) {
    const s = { ...state, view };
    assert.deepEqual(universeProgress(s, u.id), expected, `${u.id}: ${view} changed progress`);
    assert(route(s, u.id).every(t => t.tier === 0));
  }
}
const hawk = CATALOG.find(t => /hawkeye/i.test(t.title));
assert(hawk?.episodes);
const completed = { ...state, episodes: { [hawk.id]: Array.from({ length: hawk.episodes }, (_, i) => i + 1) } };
assert(isDone(completed, hawk)); assert.equal(remaining(completed, hawk), 0);
for (const viewport of [320, 375, 390, 430, 768, 834, 1024, 1366]) {
  const content = viewport >= 768 ? Math.min(viewport - 208, 1120) - 64 : viewport - 40;
  const { cols, cardWidth } = posterGrid(content, viewport >= 1200 ? 6 : viewport >= 768 ? 5 : 3);
  assert(cardWidth >= (content < 360 ? 120 : 140) || cols === 1);
  assert(cols * cardWidth + (cols - 1) * 14 <= content);
  console.log(`Grid ${viewport}px: ${cols} columns, ${cardWidth}px posters`);
}
const local = [{ ...iron, tmdb: { id: 1726, m: 'movie' }, media: 'movie' }];
const movie = { key: 'movie:1726', m: 'movie', title: 'Demir Adam' };
const tv = { key: 'tv:1726', m: 'tv', title: 'Different show' };
assert.deepEqual(remoteSearchResults([movie, tv], local, 'all'), [tv]);
assert.deepEqual(remoteSearchResults([movie, tv], [], 'tv'), [tv]);
assert.deepEqual(changedEpisodes([1, 2, 3], [1], false), [2, 3]);
assert.deepEqual(changedEpisodes([1, 2, 3], [1, 2, 3, 4], true), [1, 2, 3]);
console.log(`PASS: progress invariance across ${UNIVERSES.length} universes and 4 views; completion; 8 widths; canonical search; partial-season undo.`);
const { savedSuggestions } = require('../src/lib/saved-suggestions.ts');
const saved = { ...state, watched: {}, list: [iron.id], lib: { 'movie:1726': { title: 'Demir Adam', m: 'movie', id: 1726 } }, lists: { weekend: { items: [{ k: 'movie:1726', t: 'Demir Adam' }, { k: 'movie:999999', t: 'Only in custom list' }] } } };
assert.equal(savedSuggestions(saved, CATALOG, 'movie', new Set()).filter(x => x.key === 'movie:1726').length, 1);
assert(savedSuggestions(saved, CATALOG, 'movie', new Set()).some(x => x.title === 'Only in custom list'));
assert.equal(savedSuggestions({ ...saved, watched: { [iron.id]: 1 } }, CATALOG, 'all', new Set()).some(x => x.key === 'movie:1726'), false);
assert.equal(savedSuggestions(saved, CATALOG, 'tv', new Set()).length, 0);
assert.equal(savedSuggestions(saved, CATALOG, 'all', new Set(['movie:1726', 'movie:999999'])).length, 0);
console.log('PASS: own-list deduplication, custom-list membership, watched exclusion, media filter and already-shown exclusion.');
