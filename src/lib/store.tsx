import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { TBY, UBY, branchesOf } from './catalog';
import { loadCachedCatalog } from './remote';
import type { LibItem, ListItem, ListView, Mode, Order, State, UList } from './types';

const KEY = 'watchverse:v2';
export const BACKUP_PREFIX = 'WATCHVERSE:';

export const initialState = (): State => ({
  v: 2,
  onboarded: false,
  name: '',
  follow: [],
  watched: {},
  episodes: {},
  touched: {},
  list: [],
  mode: 'essential',
  order: 'release',
  view: 'main',
  ratings: {},
  notes: {},
  lib: {},
  lists: {},
  log: {},
  branches: {},
  spoiler: true,
  dv: 3,
});

/** Kayıttan gelen veriyi doğrular; katalogda olmayan kimlikleri ayıklar. */
const isKey = (k: string) => /^(movie|tv):\d+$/.test(k);
const known = (k: string) => !!TBY[k] || isKey(k);

export function sanitize(input: unknown): State {
  const base = initialState();
  if (!input || typeof input !== 'object') return base;
  const s = input as Partial<State>;
  const out: State = { ...base };
  out.onboarded = !!s.onboarded;
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
    const max = t ? t.episodes : id.startsWith('tv:') ? 20000 : 0;
    if (!max || !Array.isArray(arr)) continue;
    const clean = [...new Set(arr.filter((n) => Number.isInteger(n) && n >= 1 && n <= max))].sort((a, b) => a - b);
    if (clean.length) out.episodes[id] = clean;
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
  out.log = {};
  for (const [mon, v] of Object.entries(s.log || {})) if (/^\d{4}-\d{2}$/.test(mon) && v && typeof v === 'object') out.log[mon] = { f: Math.max(0, Number(v.f) || 0), e: Math.max(0, Number(v.e) || 0), m: Math.max(0, Number(v.m) || 0) };
  out.branches = {};
  // Eski kayıtlar: ana hikâye + yayın sırası + tüm rotalar varsayılanına bir kez geçir
  // Eski kayıtlar: yeni sade liste görünümüne ve tüm rotalara bir kez geçir
  if ((s.dv || 0) < 3) { out.view = 'main'; return out; }
  for (const [u, b] of Object.entries(s.branches || {})) if (UBY[u] && typeof b === 'string' && (b === 'all' || branchesOf(u).some((x) => x.id === b))) out.branches[u] = b;
  return out;
}


/* ---------- aylık izleme özeti ---------- */
const monthKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
/** Bir film ya da bölümün dakikası (bilinmiyorsa 0) */
export function minutesOf(s: State, key: string, n?: number) {
  const t = TBY[key];
  if (t) return t.episodes ? t.ep[(n || 1) - 1]?.[2] || 0 : t.minutes || 0;
  return s.lib[key]?.runtime || 0;
}
function bump(s: State, d: { f?: number; e?: number; m?: number }, at = Date.now()): State['log'] {
  const k = monthKey(at);
  const cur = s.log[k] || { f: 0, e: 0, m: 0 };
  return { ...s.log, [k]: { f: Math.max(0, cur.f + (d.f || 0)), e: Math.max(0, cur.e + (d.e || 0)), m: Math.max(0, cur.m + (d.m || 0)) } };
}
/** Bölüm listesindeki değişimi özete yansıtır */
function bumpEps(s: State, key: string, before: number[], after: number[]) {
  const a = new Set(before), b = new Set(after);
  let e = 0, m = 0;
  for (const n of b) if (!a.has(n)) { e++; m += minutesOf(s, key, n); }
  for (const n of a) if (!b.has(n)) { e--; m -= minutesOf(s, key, n); }
  return e || m ? bump(s, { e, m }) : s.log;
}
const newId = (len = 10) => Array.from({ length: len }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]).join('');

type Actions = {
  setState: (fn: (s: State) => State) => void;
  toggleWatched: (id: string, value?: boolean) => boolean;
  toggleEpisode: (id: string, n: number) => void;
  setEpisodes: (id: string, nums: number[], value: boolean) => void;
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
  setEpsKey: (key: string, nums: number[], value: boolean) => void;
  ensureDevice: () => string;
  /** Kendi listeler */
  listCreate: (name: string, first?: ListItem | ListItem[]) => string;
  listRename: (id: string, name: string) => void;
  listDelete: (id: string) => void;
  /** yapımı listeye ekler ya da çıkarır; yeni durumu döndürür */
  listToggle: (id: string, item: ListItem) => boolean;
  listSetShare: (id: string, share: string | undefined) => void;
  /** dışarıdan toplu kayıt (içe aktarma) */
  importMany: (items: { key: string; lib?: LibItem; watchedAt?: number; rating?: number; eps?: number[]; plan?: boolean }[]) => number;
  finishOnboarding: (follow: string[], watchedIds: string[]) => void;
  exportBackup: () => string;
  importBackup: (code: string) => boolean;
  reset: () => void;
};

type Ctx = { state: State; ready: boolean } & Actions;
const StoreContext = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setRaw] = useState<State>(initialState);
  const [ready, setReady] = useState(false);
  const ref = useRef(state);
  ref.current = state;

  // Açılışta kaydı oku
  useEffect(() => {
    let alive = true;
    // Önce indirilmiş katalog yüklenir; yoksa kayıt temizlenirken yeni yapımların işaretleri silinirdi
    loadCachedCatalog()
      .then(() => AsyncStorage.getItem(KEY))
      .then((txt) => { if (alive && txt) setRaw(sanitize(JSON.parse(txt))); })
      .catch(() => {})
      .finally(() => alive && setReady(true));
    return () => { alive = false; };
  }, []);

  // Değişiklikleri kısa bir gecikmeyle kaydet
  useEffect(() => {
    if (!ready) return;
    const h = setTimeout(() => { AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {}); }, 250);
    return () => clearTimeout(h);
  }, [state, ready]);

  // Uygulama arka plana geçerken bekleyen kaydı hemen yaz
  useEffect(() => {
    if (!ready) return;
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') AsyncStorage.setItem(KEY, JSON.stringify(ref.current)).catch(() => {});
    });
    return () => sub.remove();
  }, [ready]);

  const setState = useCallback((fn: (s: State) => State) => setRaw((s) => fn(s)), []);

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
        set.has(n) ? set.delete(n) : set.add(n);
        const episodes = { ...s.episodes };
        if (set.size) episodes[id] = [...set].sort((a, b) => a - b); else delete episodes[id];
        return { ...s, episodes, touched: { ...s.touched, [id]: Date.now() }, log: bumpEps(s, id, s.episodes[id] || [], episodes[id] || []) };
      });
    },
    setEpisodes(id, nums, value) {
      const t = TBY[id];
      if (!t) return;
      setRaw((s) => {
        const set = new Set(s.episodes[id] || []);
        nums.forEach((n) => (value ? set.add(n) : set.delete(n)));
        const episodes = { ...s.episodes };
        if (set.size) episodes[id] = [...set].filter((n) => n >= 1 && n <= t.episodes).sort((a, b) => a - b); else delete episodes[id];
        return { ...s, episodes, touched: { ...s.touched, [id]: Date.now() }, log: bumpEps(s, id, s.episodes[id] || [], episodes[id] || []) };
      });
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
    libSave: (key, item) => setRaw((s) => ({ ...s, lib: { ...s.lib, [key]: { ...s.lib[key], ...item, added: s.lib[key]?.added || item.added || Date.now() } } })),
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
    setEpsKey: (key, nums, value) => setRaw((s) => {
      const set = new Set(s.episodes[key] || []);
      nums.forEach((n) => (value ? set.add(n) : set.delete(n)));
      const episodes = { ...s.episodes };
      if (set.size) episodes[key] = [...set].filter((n) => n >= 1).sort((a, b) => a - b); else delete episodes[key];
      return { ...s, episodes, touched: { ...s.touched, [key]: Date.now() }, log: bumpEps(s, key, s.episodes[key] || [], episodes[key] || []) };
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
            cur = { ...cur, lib, log: bump({ ...cur, lib }, { f: 1, m: minutesOf({ ...cur, lib }, it.key) }, it.watchedAt) };
          }
          if (it.eps?.length) {
            const before = episodes[it.key] || [];
            const next = [...new Set([...before, ...it.eps])].sort((a, b) => a - b);
            episodes[it.key] = next;
            cur = { ...cur, lib, log: bumpEps({ ...cur, lib }, it.key, before, next) };
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
      const json = JSON.stringify(ref.current);
      return BACKUP_PREFIX + toBase64(json);
    },
    importBackup(code) {
      try {
        const body = code.trim().replace(/^WATCHVERSE:/, '');
        const obj = JSON.parse(fromBase64(body));
        const clean = sanitize(obj);
        setRaw({ ...clean, onboarded: true });
        return true;
      } catch {
        return false;
      }
    },
    reset() {
      setRaw((s) => ({ ...initialState(), onboarded: true, follow: s.follow, name: s.name, mode: s.mode, order: s.order, view: s.view, branches: s.branches, spoiler: s.spoiler, lastBackup: s.lastBackup, lib: s.lib, lists: s.lists, device: s.device }));
    },
  }), [setState]);

  const value = useMemo<Ctx>(() => ({ state, ready, ...actions }), [state, ready, actions]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore, StoreProvider içinde kullanılmalı');
  return ctx;
}

// UTF-8 güvenli base64 (Türkçe karakterler için)
// TextEncoder/TextDecoder her JavaScript motorunda bulunmadığı için elle UTF-8
function utf8Encode(str: string): number[] {
  const out: number[] = [];
  for (const ch of str) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}
function utf8Decode(b: number[]): string {
  let s = '';
  for (let i = 0; i < b.length; ) {
    const x = b[i++];
    let c: number;
    if (x < 0x80) c = x;
    else if (x < 0xe0) c = ((x & 31) << 6) | (b[i++] & 63);
    else if (x < 0xf0) c = ((x & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else c = ((x & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    s += String.fromCodePoint(c);
  }
  return s;
}
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function toBase64(str: string) {
  const bytes = utf8Encode(str);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=');
  }
  return out;
}
function fromBase64(b64: string) {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12) | ((B64.indexOf(clean[i + 2]) & 63) << 6) | (B64.indexOf(clean[i + 3]) & 63);
    bytes.push((n >> 16) & 255);
    if (clean[i + 2] !== undefined && B64.indexOf(clean[i + 2]) >= 0) bytes.push((n >> 8) & 255);
    if (clean[i + 3] !== undefined && B64.indexOf(clean[i + 3]) >= 0) bytes.push(n & 255);
  }
  return utf8Decode(bytes);
}
export const __b64 = { toBase64, fromBase64 };
