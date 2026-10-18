import { bump, bumpEps, minutesOf } from './watch-stats';
import { updateEpisodeBatch } from './episode-actions';
import { known, sanitize } from './state-validation';
import { localTransition } from './state-transition';
import { initialState } from './state-defaults';
import { recordReplica, seedReplica } from './replica';
import { compatibleLayout, libraryLayout } from './episode-identity';
import { projectEpisodes } from './episode-state';
import { checkpoint } from './checkpoint';
import type { SyncMeta } from './checkpoint-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { TBY, UBY } from './catalog';
import { loadCachedCatalog } from './remote';
import type { LibItem, ListItem, ListView, Mode, Order, State } from './types';

import { BACKUP_PREFIX, toBase64, decodeBackup } from './backup-code';
export { minutesOf } from './watch-stats';
export { BACKUP_PREFIX, __b64 } from './backup-code';

export { initialState } from './state-defaults';

export { sanitize } from './state-validation';

const newId = (len = 10) => Array.from({ length: len }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]).join('');

type Actions = {
  setState: (fn: (s: State) => State) => void;
  toggleWatched: (id: string, value?: boolean) => boolean;
  toggleEpisode: (id: string, n: number) => void;
  setEpisodes: (id: string, nums: number[], value: boolean, trackToday?: boolean) => void;
  toggleList: (id: string) => boolean;
  toggleFollow: (u: string) => void;
  setMode: (m: Mode) => void;
  setOrder: (o: Order) => void;
  setView: (v: ListView) => void;
  setBranch: (u: string, b: string) => void;
  setSpoiler: (v: boolean) => void;
  setName: (n: string) => void;
  setRating: (id: string, v: number) => void;
  setNote: (id: string, v: string) => void;
  /** Verilen yapımların hepsini izlendi işaretler */
  markMany: (ids: string[]) => number;
  markBackup: () => void;
  /** Kütüphane (TMDB) */
  libSave: (key: string, item: LibItem) => void;
  libRemove: (key: string) => void;
  watchKey: (key: string, value: boolean) => void;
  setEpsKey: (key: string, nums: number[], value: boolean, trackToday?: boolean) => void;
  /** diziyi yarıda bıraktım / yeniden başladım */
  setDropped: (key: string, on: boolean) => void;
  /** filmi bir kez daha izledim (+1) ya da geri al (−1) */
  rewatch: (key: string, delta: 1 | -1) => void;
  ensureDevice: () => string;
  /** Kendi listeler */
  listCreate: (name: string, first?: ListItem | ListItem[]) => string;
  listRename: (id: string, name: string) => void;
  listDelete: (id: string) => void;
  /** yapımı listeye ekler ya da çıkarır; yeni durumu döndürür */
  listToggle: (id: string, item: ListItem) => boolean;
  listSetShare: (id: string, share: string | undefined) => void;
  /** dışarıdan toplu kayıt (içe aktarma) */
  importMany: (items: { key: string; lib?: LibItem; watchedAt?: number; dated?: boolean; rating?: number; eps?: number[]; plan?: boolean }[]) => number;
  finishOnboarding: (follow: string[], watchedIds: string[]) => void;
  exportBackup: () => string;
  importBackup: (code: string) => boolean;
  reset: () => void;
};

type Ctx = { state: State; ready: boolean; storageError: boolean; getState: () => State; applySync: (s: State, meta: SyncMeta) => Promise<void> } & Actions;
const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setRawInner] = useState<State>(initialState);
  const ref = useRef(state);
  const actor = useRef('');
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const getState = useCallback(() => ref.current, []);
  const setRaw = useCallback((fn: State | ((s: State) => State)) => {
    const next = localTransition(ref.current, fn, actor.current);
    ref.current = next;
    void checkpoint.commit(next).catch(() => {}); // subscription exposes failures
    setRawInner(next);
  }, []);
  const applySync = useCallback((input: State, meta: SyncMeta) => {
    const projected = projectEpisodes(input);
    const next = recordReplica(input, projected, actor.current);
    const saved = checkpoint.commit(next, meta);
    ref.current = next;
    setRawInner(next);
    return saved;
  }, []);
  useEffect(() => checkpoint.subscribe(setStorageError), []);
  useEffect(() => {
    let alive = true;
    loadCachedCatalog().then(() => checkpoint.load()).then(async snapshot => {
      if (!alive) return;
      const clean = sanitize(snapshot.state);
      actor.current = snapshot.meta.actor || newId(24);
      const base = snapshot.meta.base ? sanitize(snapshot.meta.base) : clean;
      const next = clean.replica ? clean : recordReplica({ ...base, replica: seedReplica(base) }, clean, actor.current);
      await checkpoint.saveMeta({ ...snapshot.meta, actor: actor.current });
      await checkpoint.commit(next);
      if (!alive) return;
      ref.current = next;
      setRawInner(next);
      setReady(true);
    }).catch((error) => { console.error('[watchverse] yerel kayıt açılamadı', error); if (alive) setStorageError(true); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => {
      if (st !== 'active') void checkpoint.flush().catch(() => {});
    });
    return () => sub.remove();
  }, []);

  const setState = useCallback((fn: (s: State) => State) => setRaw((s) => fn(s)), [setRaw]);

  const actions = useMemo<Actions>(() => ({
    setState,
    toggleWatched(id, value) {
      const t = TBY[id];
      if (!t) return false;
      const cur = ref.current;
      const isDone = t.episodes ? (cur.episodes[id]?.length || 0) === t.episodes : !!cur.watched[id];
      const target = value ?? !isDone;
      setRaw((s) => {
        const now = Date.now();
        const touched = { ...s.touched, [id]: now };
        if (t.episodes) {
          const episodes = { ...s.episodes };
          if (target) episodes[id] = Array.from({ length: t.episodes }, (_, i) => i + 1);
          else delete episodes[id];
          return { ...s, episodes, touched, log: bumpEps(s, id, s.episodes[id] || [], episodes[id] || []) };
        }
        const watched = { ...s.watched };
        let log = s.log;
        if (target && !s.watched[id]) log = bump(s, { f: 1, m: minutesOf(s, id) });
        if (!target && s.watched[id]) log = bump(s, { f: -1, m: -minutesOf(s, id) }, s.watched[id]);
        if (target) watched[id] = now; else delete watched[id];
        return { ...s, watched, touched, log };
      });
      return target;
    },
    toggleEpisode(id, n) {
      const t = TBY[id];
      if (!t || n < 1 || n > t.episodes) return;
      setRaw((s) => {
        const set = new Set(s.episodes[id] || []);
        if (set.has(n)) set.delete(n); else set.add(n);
        const episodes = { ...s.episodes };
        if (set.size) episodes[id] = [...set].sort((a, b) => a - b); else delete episodes[id];
        return { ...s, episodes, touched: { ...s.touched, [id]: Date.now() }, log: bumpEps(s, id, s.episodes[id] || [], episodes[id] || []) };
      });
    },
    setEpisodes(id, nums, value, trackToday = true) {
      if (!TBY[id]) return;
      setRaw(s=>updateEpisodeBatch(s,id,nums,value,trackToday));
    },
    toggleList(id) {
      const has = ref.current.list.includes(id);
      setRaw((s) => ({ ...s, list: has ? s.list.filter((x) => x !== id) : [...s.list, id] }));
      return !has;
    },
    toggleFollow(u) {
      setRaw((s) => ({ ...s, follow: s.follow.includes(u) ? s.follow.filter((x) => x !== u) : [...s.follow, u] }));
    },
    setMode: (mode) => setRaw((s) => ({ ...s, mode })),
    setOrder: (order) => setRaw((s) => ({ ...s, order })),
    setView: (view) => setRaw((s) => ({ ...s, view })),
    setBranch: (u, b) => setRaw((s) => ({ ...s, branches: { ...s.branches, [u]: b } })),
    setSpoiler: (spoiler) => setRaw((s) => ({ ...s, spoiler })),
    setName: (name) => setRaw((s) => ({ ...s, name: name.slice(0, 40) })),
    setRating: (id, v) => setRaw((s) => { const ratings = { ...s.ratings }; if (v >= 1 && v <= 5 && ratings[id] !== v) ratings[id] = v; else delete ratings[id]; return { ...s, ratings }; }),
    setNote: (id, v) => setRaw((s) => { const notes = { ...s.notes }; if (v.length) notes[id] = v.slice(0, 500); else delete notes[id]; return { ...s, notes }; }),
    markMany(ids) {
      const todo = ids.map((id) => TBY[id]).filter((t) => t && !(t.episodes ? (ref.current.episodes[t.id]?.length || 0) === t.episodes : ref.current.watched[t.id]));
      if (!todo.length) return 0;
      setRaw((s) => {
        const now = Date.now();
        const watched = { ...s.watched }, episodes = { ...s.episodes }, touched = { ...s.touched };
        let cur: State = s;
        for (const t of todo) {
          if (t.episodes) { episodes[t.id] = Array.from({ length: t.episodes }, (_, i) => i + 1); cur = { ...cur, log: bumpEps(cur, t.id, s.episodes[t.id] || [], episodes[t.id]) }; }
          else { watched[t.id] = now; cur = { ...cur, log: bump(cur, { f: 1, m: minutesOf(s, t.id) }) }; }
          touched[t.id] = now;
        }
        return { ...s, watched, episodes, touched, log: cur.log };
      });
      return todo.length;
    },
    markBackup: () => setRaw((s) => ({ ...s, lastBackup: Date.now() })),
    libSave: (key, item) => setRaw((s) => (s.lib[key]?.seasons && item.seasons && !compatibleLayout(libraryLayout(key,s.lib[key]), libraryLayout(key,{...s.lib[key],...item})) ? s : { ...s, lib: { ...s.lib, [key]: { ...s.lib[key], ...item, added: s.lib[key]?.added || item.added || Date.now() } } })),
    libRemove: (key) => setRaw((s) => {
      const lib = { ...s.lib }; delete lib[key];
      const watched = { ...s.watched }; delete watched[key];
      const episodes = { ...s.episodes }; delete episodes[key];
      return { ...s, lib, watched, episodes };
    }),
    watchKey: (key, value) => setRaw((s) => {
      const watched = { ...s.watched };
      let log = s.log;
      if (value && !s.watched[key]) log = bump(s, { f: 1, m: minutesOf(s, key) });
      if (!value && s.watched[key]) log = bump(s, { f: -1, m: -minutesOf(s, key) }, s.watched[key]);
      if (value) watched[key] = Date.now(); else delete watched[key];
      return { ...s, watched, log, touched: { ...s.touched, [key]: Date.now() } };
    }),
    setEpsKey: (key, nums, value, trackToday = true) => setRaw(s=>updateEpisodeBatch(s,key,nums,value,trackToday)),
    setDropped: (key, on) => setRaw((s) => ({ ...s, dropped: { ...s.dropped, [key]: on ? Date.now() : -Date.now() }, touched: { ...s.touched, [key]: Date.now() } })),
    rewatch: (key, delta) => setRaw((s) => {
      const n = Math.max(0, (s.rewatch[key] || 0) + delta);
      const rewatch = { ...s.rewatch }; if (n) rewatch[key] = n; else delete rewatch[key];
      const m = minutesOf(s, key);
      // yeniden izleme de o ayın izleme süresine eklenir; izleme zamanı en son izlemeye taşınır
      return { ...s, rewatch, log: bump(s, { f: delta, m: m * delta }), watched: delta > 0 ? { ...s.watched, [key]: Date.now() } : s.watched, touched: { ...s.touched, [key]: Date.now() } };
    }),
    listCreate(name, first) {
      const id = newId();
      const now = Date.now();
      const items = (Array.isArray(first) ? first : first ? [first] : []).map((x) => ({ ...x, at: now }));
      setRaw((s) => ({ ...s, lists: { ...s.lists, [id]: { id, name: name.trim().slice(0, 60) || 'Yeni liste', items, created: now, updated: now } } }));
      return id;
    },
    listRename: (id, name) => setRaw((s) => (s.lists[id] ? { ...s, lists: { ...s.lists, [id]: { ...s.lists[id], name: name.trim().slice(0, 60) || s.lists[id].name, updated: Date.now() } } } : s)),
    listDelete: (id) => setRaw((s) => { const lists = { ...s.lists }; delete lists[id]; return { ...s, lists }; }),
    listToggle(id, item) {
      const l = ref.current.lists[id];
      if (!l) return false;
      const has = l.items.some((x) => x.k === item.k);
      setRaw((s) => {
        const cur = s.lists[id];
        if (!cur) return s;
        const items = has ? cur.items.filter((x) => x.k !== item.k) : [{ ...item, at: Date.now() }, ...cur.items.filter((x) => x.k !== item.k)];
        return { ...s, lists: { ...s.lists, [id]: { ...cur, items, updated: Date.now() } } };
      });
      return !has;
    },
    listSetShare: (id, share) => setRaw((s) => (s.lists[id] ? { ...s, lists: { ...s.lists, [id]: { ...s.lists[id], share } } } : s)),
    importMany(items) {
      const n = items.filter((it) => known(it.key)).length;
      setRaw((s) => {
        const lib = { ...s.lib }, watched = { ...s.watched }, ratings = { ...s.ratings }, episodes = { ...s.episodes }, touched = { ...s.touched }, list = [...s.list];
        let cur: State = s;
        for (const it of items) {
          if (!known(it.key)) continue;
          if (it.lib && !TBY[it.key] && !lib[it.key]) lib[it.key] = it.lib;
          if (it.plan && TBY[it.key] && !list.includes(it.key)) list.push(it.key);
          if (it.watchedAt && !watched[it.key] && !(TBY[it.key]?.episodes)) {
            watched[it.key] = it.watchedAt;
            // aylık özete yalnızca tarihi bilinenler yazılır
            if (it.dated) cur = { ...cur, lib, log: bump({ ...cur, lib }, { f: 1, m: minutesOf({ ...cur, lib }, it.key) }, it.watchedAt) };
          }
          if (it.eps?.length) {
            const before = episodes[it.key] || [];
            const next = [...new Set([...before, ...it.eps])].sort((a, b) => a - b);
            episodes[it.key] = next;
          }
          if (it.rating && it.rating >= 1 && it.rating <= 5) ratings[it.key] = Math.round(it.rating);
          touched[it.key] = Math.max(touched[it.key] || 0, it.watchedAt || Date.now());
        }
        return { ...s, lib, watched, ratings, episodes, touched, list, log: cur.log };
      });
      return n;
    },
    ensureDevice() {
      if (ref.current.device) return ref.current.device;
      const id = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      setRaw((s) => ({ ...s, device: s.device || id }));
      return id;
    },
    finishOnboarding(follow, watchedIds) {
      setRaw((s) => {
        const now = Date.now();
        const watched = { ...s.watched };
        const episodes = { ...s.episodes };
        for (const id of watchedIds) {
          const t = TBY[id];
          if (!t) continue;
          if (t.episodes) episodes[id] = Array.from({ length: t.episodes }, (_, i) => i + 1);
          else watched[id] = now;
        }
        return { ...s, onboarded: true, follow: follow.filter((u) => !!UBY[u]), watched, episodes };
      });
    },
    exportBackup() {
      const json = JSON.stringify({ ...ref.current, backupCreatedAt: Date.now(), device: undefined });
      return BACKUP_PREFIX + toBase64(json);
    },
    importBackup(code) {
      try {
        const { state: clean } = decodeBackup(code);
        setRaw({ ...clean, device: ref.current.device, onboarded: true });
        return true;
      } catch {
        return false;
      }
    },
    reset() {
      setRaw((s) => ({ ...initialState(), episodeMarks: {}, episodeLayouts: s.episodeLayouts, unresolvedEpisodes: {}, onboarded: true, follow: s.follow, name: s.name, mode: s.mode, order: s.order, view: s.view, branches: s.branches, spoiler: s.spoiler, lastBackup: s.lastBackup, lib: s.lib, lists: s.lists, device: s.device }));
    },
  }), [setState, setRaw]);

  const value = useMemo<Ctx>(() => ({ state, ready, storageError, getState, applySync, ...actions }), [state, ready, storageError, getState, applySync, actions]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore, StoreProvider içinde kullanılmalı');
  return ctx;
}
