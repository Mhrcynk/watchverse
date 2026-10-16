import type { State } from './types';
export type SyncMeta = { actor?: string; uid?: string; rev?: number; hash?: string; at?: number; base?: Partial<State> };
type Snapshot = { format: 1; state: State | null; meta: SyncMeta };
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown> };
export const CHECKPOINT_KEY = 'watchverse:checkpoint:1';
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function createCheckpointStore(storage: Storage) {
  let current: Snapshot | undefined;
  let loading: Promise<Snapshot> | undefined;
  let pending: Promise<void> = Promise.resolve();
  let failure: unknown;
  let queued = 0;
  const statusListeners = new Set<() => void>();
  const notifyStatus = () => statusListeners.forEach(fn=>fn());
  const getStatus = (): 'saving' | 'saved' | 'error' => failure ? 'error' : queued ? 'saving' : 'saved';
  const listeners = new Set<(failed: boolean) => void>();
  const report = (error: unknown) => { failure = error; listeners.forEach(fn => fn(!!error)); };
  const load = (): Promise<Snapshot> => {
    if (current) return Promise.resolve(current);
    if (loading) return loading;
    loading = (async () => {
      const raw = await storage.getItem(CHECKPOINT_KEY);
      let value: unknown;
      if (raw !== null) value = JSON.parse(raw);
      else {
        const [state, meta] = await Promise.all([storage.getItem('watchverse:v2'), storage.getItem('watchverse:sync')]);
        value = { format: 1, state: state === null ? null : JSON.parse(state), meta: meta === null ? {} : JSON.parse(meta) };
      }
      if (!object(value) || value.format !== 1 || !object(value.meta) ||
          (value.state !== null && (!object(value.state) || value.state.v !== 2))) {
        throw new Error('Yerel kayıt biçimi okunamadı.');
      }
      current = value as Snapshot;
      return current;
    })().catch(error => { loading = undefined; throw error; });
    return loading;
  };
  const write = (snapshot: Snapshot) => {
    // Capture immediately: later edits cannot change an already queued write.
    const raw = JSON.stringify(snapshot);
    current = JSON.parse(raw);
    queued++; notifyStatus();
    pending = pending.catch(() => {}).then(async () => {
      try { await storage.setItem(CHECKPOINT_KEY, raw); report(null); }
      catch (error) { report(error); throw error; }
      finally { queued--; notifyStatus(); }
    });
    return pending;
  };
  return {
    load,
    getStatus,
    subscribeStatus(fn: () => void) { statusListeners.add(fn); return () => { statusListeners.delete(fn); }; },
    commit(state: State, meta?: SyncMeta) {
      if (!current) throw new Error('Yerel kayıt henüz okunmadı.');
      return write({ format: 1, state, meta: meta ? { ...meta, actor: current.meta.actor } : current.meta });
    },
    saveMeta(meta: SyncMeta) {
      if (!current) throw new Error('Yerel kayıt henüz okunmadı.');
      return write({ ...current, meta: { ...meta, actor: meta.actor ?? current.meta.actor } });
    },
    async flush() {
      try { await pending; } catch { /* Retry the latest coherent snapshot below. */ }
      if (failure && current) await write(current);
    },
    subscribe(fn: (failed: boolean) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  };
}
