import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { TBY, UBY, branchesOf } from './catalog';
import { loadCachedCatalog } from './remote';
import type { ListView, Mode, Order, State } from './types';

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
  branches: {},
  spoiler: true,
  dv: 3,
});

/** Kayıttan gelen veriyi doğrular; katalogda olmayan kimlikleri ayıklar. */
export function sanitize(input: unknown): State {
  const base = initialState();
  if (!input || typeof input !== 'object') return base;
  const s = input as Partial<State>;
  const out: State = { ...base };
  out.onboarded = !!s.onboarded;
  out.name = typeof s.name === 'string' ? s.name.slice(0, 40) : '';
  out.follow = Array.isArray(s.follow) ? [...new Set(s.follow.filter((u) => !!UBY[u]))] : [];
  out.list = Array.isArray(s.list) ? [...new Set(s.list.filter((id) => !!TBY[id]))] : [];
  out.mode = (['essential', 'recommended', 'complete'] as Mode[]).includes(s.mode as Mode) ? (s.mode as Mode) : 'recommended';
  out.order = (['recommended', 'release', 'chrono'] as Order[]).includes(s.order as Order) ? (s.order as Order) : 'recommended';
  out.view = (['main', 'release', 'chrono', 'all'] as ListView[]).includes(s.view as ListView) ? (s.view as ListView) : 'main';
  out.spoiler = s.spoiler !== false;
  out.watched = {};
  for (const [id, v] of Object.entries(s.watched || {})) if (TBY[id] && !TBY[id].episodes && v) out.watched[id] = typeof v === 'number' ? v : Date.now();
  out.episodes = {};
  for (const [id, arr] of Object.entries(s.episodes || {})) {
    const t = TBY[id];
    if (!t || !t.episodes || !Array.isArray(arr)) continue;
    const clean = [...new Set(arr.filter((n) => Number.isInteger(n) && n >= 1 && n <= t.episodes))].sort((a, b) => a - b);
    if (clean.length) out.episodes[id] = clean;
  }
  out.touched = {};
  for (const [id, v] of Object.entries(s.touched || {})) if (TBY[id] && typeof v === 'number') out.touched[id] = v;
  out.branches = {};
  // Eski kayıtlar: ana hikâye + yayın sırası + tüm rotalar varsayılanına bir kez geçir
  // Eski kayıtlar: yeni sade liste görünümüne ve tüm rotalara bir kez geçir
  if ((s.dv || 0) < 3) { out.view = 'main'; return out; }
  for (const [u, b] of Object.entries(s.branches || {})) if (UBY[u] && typeof b === 'string' && (b === 'all' || branchesOf(u).some((x) => x.id === b))) out.branches[u] = b;
  return out;
}

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
          return { ...s, episodes, touched };
        }
        const watched = { ...s.watched };
        if (target) watched[id] = now; else delete watched[id];
        return { ...s, watched, touched };
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
        return { ...s, episodes, touched: { ...s.touched, [id]: Date.now() } };
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
        return { ...s, episodes, touched: { ...s.touched, [id]: Date.now() } };
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
      setRaw((s) => ({ ...initialState(), onboarded: true, follow: s.follow, name: s.name, mode: s.mode, order: s.order, view: s.view, branches: s.branches, spoiler: s.spoiler }));
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
