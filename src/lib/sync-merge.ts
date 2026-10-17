import { initialState } from './state-defaults';
import { applyReplica, canonicalizeEpisodes, mergeAliases, mergeReplicas, recordReplica, seedReplica } from './replica';
import type { State } from './types';

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);

/** Three-way merge against the last acknowledged server snapshot.
 * Unchanged data never resurrects a remote deletion. Concurrent delete/edit resolves to delete.
 * Independent object fields and set members survive in either merge order.
 */
export function mergeValue(base: unknown, local: unknown, remote: unknown): unknown {
  if (same(local, remote)) return local;
  if (same(local, base)) return remote;
  if (same(remote, base)) return local;
  if (local === undefined || remote === undefined) return undefined;
  if (Array.isArray(local) && Array.isArray(remote)) {
    const before = Array.isArray(base) ? base : [];
    // Custom list items are records keyed by media identity, not array positions.
    const keyed = [...before, ...local, ...remote].every(x => object(x) && typeof x.k === 'string');
    if (keyed) {
      const index = (items: { k: string }[]) => Object.fromEntries(items.map(x => [x.k, x]));
      const merged = mergeValue(index(before), index(local), index(remote)) as Record<string, unknown>;
      return Object.keys(merged).sort().map(k => merged[k]);
    }
    const values = [...new Set([...before, ...local, ...remote])];
    return values.filter(x => {
      const was = before.includes(x), a = local.includes(x), b = remote.includes(x);
      return a === was ? b : b === was ? a : a;
    }).sort((a, b) => typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b)));
  }
  if (object(local) && object(remote)) {
    const prior = object(base) ? base : {};
    const out: Record<string, unknown> = {};
    for (const k of [...new Set([...Object.keys(prior), ...Object.keys(local), ...Object.keys(remote)])].sort()) {
      if (forbidden.has(k)) continue;
      const value = mergeValue(prior[k], local[k], remote[k]);
      if (value !== undefined) out[k] = value;
    }
    return out;
  }
  // Concurrent edits to the same scalar have a deterministic winner.
  // Both versions cannot be represented in a single rating/name field.
  return JSON.stringify(local) > JSON.stringify(remote) ? local : remote;
}

export function mergeStates(local: State, remote: State, base: Partial<State> = {}): State {
  if (local.replica || remote.replica) {
    const aliases = mergeAliases(local.episodeAliases,remote.episodeAliases);
    local = canonicalizeEpisodes(local,aliases);
    remote = canonicalizeEpisodes(remote,aliases);
    const baseline = { ...initialState(), ...base } as State;
    const seed = seedReplica(baseline);
    const migrate = (s: State, actor: string) => s.replica || recordReplica({ ...baseline, replica: seed }, s, actor).replica!;
    return applyReplica({ ...remote, device: local.device, lastBackup: local.lastBackup,
      episodeLayouts: { ...remote.episodeLayouts, ...local.episodeLayouts },
      unresolvedEpisodes: Object.fromEntries([...new Set([...Object.keys(remote.unresolvedEpisodes || {}), ...Object.keys(local.unresolvedEpisodes || {})])].map(key => [key, [...new Set([...(remote.unresolvedEpisodes?.[key] || []), ...(local.unresolvedEpisodes?.[key] || [])])].sort((a,b)=>a-b)])) },
      mergeReplicas(migrate(local,'migration-local'),migrate(remote,'migration-remote')));
  }
  // Clone before applying device-local fields; merging must never mutate the baseline.
  const merged = JSON.parse(JSON.stringify(mergeValue(base, local, remote))) as State;
  // An absent series is an empty set of marks, not deletion of the series record.
  // This preserves a concurrent new episode when the other device unmarks the last old one.
  merged.episodes = {};
  for (const key of new Set([...Object.keys(base.episodes || {}), ...Object.keys(local.episodes), ...Object.keys(remote.episodes)])) {
    const marks = mergeValue(base.episodes?.[key] || [], local.episodes[key] || [], remote.episodes[key] || []) as number[];
    if (marks.length) merged.episodes[key] = marks;
  }
  // Legacy aggregate counters lack event IDs. A maximum is retry-safe; summing snapshots
  // double-counts when an acknowledgement is lost. Exact concurrent totals need an event log.
  merged.log = {};
  for (const month of new Set([...Object.keys(local.log || {}), ...Object.keys(remote.log || {})])) {
    const a = local.log?.[month], b = remote.log?.[month];
    merged.log[month] = {
      f: Math.max(a?.f || 0, b?.f || 0),
      e: Math.max(a?.e || 0, b?.e || 0),
      m: Math.max(a?.m || 0, b?.m || 0),
    };
  }
  merged.device = local.device;
  merged.lastBackup = local.lastBackup;
  return merged;
}
