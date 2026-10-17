import { initialState } from './state-defaults';
import { applyReplica, canonicalizeEpisodes, validateReplica } from './replica';
import { projectEpisodes } from './episode-state';
import { MERGED, MOVED, TBY, UBY, branchesOf } from './catalog';
import type { LibItem, ListView, Mode, Order, State } from './types';

/** Kayıttan gelen veriyi doğrular; katalogda olmayan kimlikleri ayıklar. */
const isKey = (k: string) => /^(movie|tv):\d+$/.test(k);
export const known = (k: string) => !!TBY[k] || isKey(k);

/** Evrenden çıkarılan yapımların kayıtlarını kütüphane anahtarlarına taşır; birleşen evrenleri yeni adına çevirir */
function migrateMoved(s: Partial<State>): Partial<State> {
  const ids = Object.keys(MOVED);
  const touchesMoved = ids.some((id) => s.watched?.[id] || s.episodes?.[id] || s.ratings?.[id] || s.notes?.[id] || s.list?.includes(id));
  const touchesMerged = (s.follow || []).some((u) => u in MERGED);
  if (!touchesMoved && !touchesMerged) return s;
  const o: Partial<State> = { ...s, watched: { ...s.watched }, episodes: { ...s.episodes }, ratings: { ...s.ratings }, notes: { ...s.notes }, touched: { ...s.touched }, lib: { ...s.lib } };
  for (const id of ids) {
    const mv = MOVED[id];
    const used = s.watched?.[id] || s.episodes?.[id] || s.ratings?.[id] || s.notes?.[id] || s.list?.includes(id);
    if (!used) continue;
    const [m, tid] = mv.k.split(':');
    if (!o.lib![mv.k]) o.lib![mv.k] = { m: m as 'movie' | 'tv', id: Number(tid), title: mv.title, year: mv.year, p: mv.p, b: mv.b, added: Date.now(), runtime: mv.minutes };
    if (s.watched?.[id]) { o.watched![mv.k] = s.watched[id]; delete o.watched![id]; }
    if (s.episodes?.[id]) { o.episodes![mv.k] = s.episodes[id]; delete o.episodes![id]; }
    if (s.ratings?.[id]) { o.ratings![mv.k] = s.ratings[id]; delete o.ratings![id]; }
    if (s.notes?.[id]) { o.notes![mv.k] = s.notes[id]; delete o.notes![id]; }
    if (s.touched?.[id]) { o.touched![mv.k] = s.touched[id]; delete o.touched![id]; }
  }
  o.follow = [...new Set((s.follow || []).map((u) => (u in MERGED ? MERGED[u] : u)).filter((u): u is string => !!u))];
  return o;
}

export function sanitize(input: unknown): State {
  const base = initialState();
  if (!input || typeof input !== 'object') return base;
  if ('v' in input && (input as { v: unknown }).v !== 2) throw new Error('Kayıt için uygulama güncellemesi gerekli.');
  const raw = input as State;
  let prepared = raw;
  if (raw.replica) {
    validateReplica(raw.replica);
    const canonical = canonicalizeEpisodes(raw, raw.episodeAliases);
    prepared = applyReplica(canonical, canonical.replica!);
  }
  const s = migrateMoved(prepared);
  const out: State = { ...base };
  if (s.replica) { validateReplica(s.replica); out.replica = s.replica; }
  out.onboarded = !!s.onboarded;
  out.starter = s.starter === true;
  out.name = typeof s.name === 'string' ? s.name.slice(0, 40) : '';
  out.follow = Array.isArray(s.follow) ? [...new Set(s.follow.filter((u) => !!UBY[u]))] : [];
  out.list = Array.isArray(s.list) ? [...new Set(s.list.filter((id) => !!TBY[id]))] : [];
  out.lib = {};
  for (const [k, v] of Object.entries(s.lib || {})) if (isKey(k) && v && typeof v === 'object' && typeof (v as LibItem).title === 'string') out.lib[k] = v as LibItem;
  out.device = typeof s.device === 'string' && /^[a-f0-9-]{16,64}$/.test(s.device) ? s.device : undefined;
  out.mode = (['essential', 'recommended', 'complete'] as Mode[]).includes(s.mode as Mode) ? (s.mode as Mode) : 'recommended';
  out.order = (['recommended', 'release', 'chrono'] as Order[]).includes(s.order as Order) ? (s.order as Order) : 'recommended';
  out.view = (['main', 'release', 'chrono', 'all'] as ListView[]).includes(s.view as ListView) ? (s.view as ListView) : 'main';
  out.spoiler = s.spoiler !== false;
  out.watched = {};
  for (const [id, v] of Object.entries(s.watched || {})) if (((TBY[id] && !TBY[id].episodes) || id.startsWith('movie:')) && v) out.watched[id] = typeof v === 'number' ? v : Date.now();
  out.episodes = {};
  for (const [id, arr] of Object.entries(s.episodes || {})) {
    const t = TBY[id];
    const max = t || id.startsWith('tv:') ? 20000 : 0;
    if (!max || !Array.isArray(arr)) continue;
    const clean = [...new Set(arr.filter((n) => Number.isInteger(n) && n >= 1 && n <= max))].sort((a, b) => a - b);
    if (clean.length) out.episodes[id] = clean;
  }
  // Preserve identity evidence in backups and server snapshots. Never trim removed IDs.
  if (s.episodeMarks) {
    out.episodeMarks = {};
    for (const [key, ids] of Object.entries(s.episodeMarks)) {
      if (['__proto__','constructor','prototype'].includes(key)) throw new Error('Geçersiz bölüm anahtarı.');
      if (!Array.isArray(ids) || ids.some(id=>typeof id !== 'string' || id.length>200)) throw new Error('Geçersiz bölüm kimlikleri.');
      out.episodeMarks[key] = [...new Set(ids)];
    }
  }
  if (s.episodeLayouts) {
    out.episodeLayouts = {};
    for (const [key, layout] of Object.entries(s.episodeLayouts)) {
      if (['__proto__','constructor','prototype'].includes(key)) throw new Error('Geçersiz bölüm anahtarı.');
      if (!layout || !Array.isArray(layout.ids) || !Array.isArray(layout.coordinates) || layout.ids.length !== layout.coordinates.length ||
        [...layout.ids,...layout.coordinates].some(id=>typeof id !== 'string' || id.length>200)) throw new Error('Geçersiz bölüm eşlemesi.');
      out.episodeLayouts[key] = layout;
    }
  }
  out.unresolvedEpisodes = {};
  for (const [key, positions] of Object.entries(s.unresolvedEpisodes || {})) {
    if (['__proto__','constructor','prototype'].includes(key) || !Array.isArray(positions) ||
      positions.some(n=>!Number.isInteger(n) || n<1 || n>20000)) throw new Error('Geçersiz eski bölüm kaydı.');
    out.unresolvedEpisodes[key] = [...new Set(positions)];
  }
  out.episodeAliases = {};
  for (const [key, aliases] of Object.entries(s.episodeAliases || {})) {
    if (['__proto__','constructor','prototype'].includes(key) || !aliases || typeof aliases !== 'object' ||
      Object.entries(aliases).some(([from,to])=>['__proto__','constructor','prototype'].includes(from) || typeof to !== 'string')) throw new Error('Geçersiz bölüm eşlemesi.');
    out.episodeAliases[key] = aliases;
  }
  out.touched = {};
  for (const [id, v] of Object.entries(s.touched || {})) if (known(id) && typeof v === 'number') out.touched[id] = v;
  out.ratings = {};
  for (const [id, v] of Object.entries(s.ratings || {})) if (known(id) && Number.isInteger(v) && v >= 1 && v <= 5) out.ratings[id] = v;
  out.notes = {};
  for (const [id, v] of Object.entries(s.notes || {})) if (known(id) && typeof v === 'string' && v.trim()) out.notes[id] = v.slice(0, 500);
  out.lastBackup = typeof s.lastBackup === 'number' ? s.lastBackup : undefined;
  out.lists = {};
  for (const [id, l] of Object.entries(s.lists || {})) {
    if (!l || typeof l !== 'object' || typeof l.name !== 'string' || !/^[a-z0-9]{6,24}$/.test(id)) continue;
    const items = (Array.isArray(l.items) ? l.items : []).filter((x) => x && typeof x.k === 'string' && known(x.k) && typeof x.t === 'string')
      .map((x) => ({ k: x.k, t: x.t.slice(0, 200), p: typeof x.p === 'string' ? x.p : null, y: typeof x.y === 'number' ? x.y : null, at: typeof x.at === 'number' ? x.at : Date.now() }));
    out.lists[id] = { id, name: l.name.slice(0, 60) || 'Liste', items: items.slice(0, 1000), created: Number(l.created) || Date.now(), updated: Number(l.updated) || Date.now(), share: typeof l.share === 'string' && /^[a-z0-9]{8,24}$/.test(l.share) ? l.share : undefined };
  }
  // Listedeki her yapım kütüphanede de durur (listeler kütüphanenin içindeki klasörlerdir)
  for (const l of Object.values(out.lists)) for (const x of l.items) {
    if (TBY[x.k]) { if (!out.list.includes(x.k)) out.list.push(x.k); continue; }
    if (!out.lib[x.k]) { const [m, n] = x.k.split(':'); out.lib[x.k] = { m: m as LibItem['m'], id: Number(n), title: x.t, year: x.y, p: x.p, b: null, added: x.at }; }
  }
  out.dropped = {};
  for (const [k, v] of Object.entries(s.dropped || {})) if (known(k) && typeof v === 'number' && v) out.dropped[k] = v;
  out.rewatch = {};
  for (const [k, v] of Object.entries(s.rewatch || {})) if (known(k) && Number.isInteger(v) && v > 0) out.rewatch[k] = Math.min(v, 99);
  out.log = {};
  for (const [mon, v] of Object.entries(s.log || {})) if (/^\d{4}-\d{2}$/.test(mon) && v && typeof v === 'object') out.log[mon] = { f: Math.max(0, Number(v.f) || 0), e: Math.max(0, Number(v.e) || 0), m: Math.max(0, Number(v.m) || 0) };
  out.branches = {};
  // Eski kayıtlar: ana hikâye + yayın sırası + tüm rotalar varsayılanına bir kez geçir
  // Eski kayıtlar: yeni sade liste görünümüne ve tüm rotalara bir kez geçir
  if ((s.dv || 0) < 3) { out.view = 'main'; return projectEpisodes(out); }
  for (const [u, b] of Object.entries(s.branches || {})) if (UBY[u] && typeof b === 'string' && (b === 'all' || branchesOf(u).some((x) => x.id === b))) out.branches[u] = b;
  return projectEpisodes(out);
}

