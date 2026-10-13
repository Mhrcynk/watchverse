import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { sanitize, useStore } from './store';
import { authError, hasAuth, sb, siteUrl } from './supabase';
import type { State } from './types';

// Giriş dönüşündeki bilgiler adres çubuğundan kaybolmadan istemci hemen kurulur
sb();

const META = 'watchverse:sync';
type Meta = { uid?: string; rev?: number; hash?: string; at?: number };
export type SyncStatus = 'off' | 'syncing' | 'ok' | 'offline' | 'error';
export type AccountUser = { id: string; email: string | null; google: boolean };

type Ctx = {
  enabled: boolean;
  user: AccountUser | null;
  status: SyncStatus;
  lastSync: number | null;
  /** maildeki bağlantıyla gelindi, yeni şifre bekleniyor */
  recovery: boolean;
  signIn: (email: string, pw: string) => Promise<string | null>;
  signUp: (email: string, pw: string) => Promise<string | null>;
  google: () => Promise<string | null>;
  resetPassword: (email: string) => Promise<string | null>;
  updatePassword: (pw: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<string | null>;
  syncNow: () => Promise<void>;
};
const AccountContext = createContext<Ctx | null>(null);

/* ---------- eşitlenecek veri ---------- */
/** Cihaza özel alanlar (bildirim kimliği, yedek zamanı) eşitlenmez */
export function cloudPayload(s: State) {
  const { device: _d, lastBackup: _b, ...rest } = s;
  return rest;
}
function hashOf(v: unknown) {
  const str = JSON.stringify(v);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return `${str.length}:${h >>> 0}`;
}
const hasData = (s: State) => Object.keys(s.watched).length + Object.keys(s.episodes).length + Object.keys(s.lib).length + s.list.length + Object.keys(s.ratings).length > 0;

/** İki kaydı birleştirir: hiçbir izleme kaybolmaz; çakışan ayar ve notlarda bu cihaz kazanır */
export function mergeStates(local: State, remote: State): State {
  const out: State = { ...remote, ...local };
  out.onboarded = local.onboarded || remote.onboarded;
  out.follow = [...new Set([...remote.follow, ...local.follow])];
  out.list = [...new Set([...remote.list, ...local.list])];
  out.watched = { ...remote.watched };
  for (const [k, v] of Object.entries(local.watched)) out.watched[k] = Math.max(v, out.watched[k] || 0);
  out.touched = { ...remote.touched };
  for (const [k, v] of Object.entries(local.touched)) out.touched[k] = Math.max(v, out.touched[k] || 0);
  out.episodes = { ...remote.episodes };
  for (const [k, v] of Object.entries(local.episodes)) out.episodes[k] = [...new Set([...(out.episodes[k] || []), ...v])].sort((a, b) => a - b);
  out.ratings = { ...remote.ratings, ...local.ratings };
  out.notes = { ...remote.notes, ...local.notes };
  out.lib = { ...remote.lib };
  for (const [k, v] of Object.entries(local.lib)) { const r = out.lib[k]; out.lib[k] = !r || (v.at || 0) >= (r.at || 0) ? { ...v, added: Math.min(v.added, r?.added || v.added) } : r; }
  out.branches = { ...remote.branches, ...local.branches };
  out.device = local.device;
  out.lastBackup = local.lastBackup;
  return out;
}

async function loadMeta(): Promise<Meta> {
  try { return JSON.parse((await AsyncStorage.getItem(META)) || '{}') || {}; } catch { return {}; }
}
const saveMeta = (m: Meta) => AsyncStorage.setItem(META, JSON.stringify(m)).catch(() => {});

/* ---------- sağlayıcı ---------- */
export function AccountProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const enabled = hasAuth();
  const [user, setUser] = useState<AccountUser | null>(null);
  const [status, setStatus] = useState<SyncStatus>('off');
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [recovery, setRecovery] = useState(false);
  const stateRef = useRef(store.state);
  stateRef.current = store.state;
  const meta = useRef<Meta>({});
  const busy = useRef<Promise<void> | null>(null);
  const uidRef = useRef<string | null>(null);

  const apply = useCallback((s: State) => {
    // Sunucudan gelen kayıt: cihaza özel alanlar korunur
    const cur = stateRef.current;
    const next = { ...s, device: cur.device, lastBackup: cur.lastBackup, onboarded: s.onboarded || cur.onboarded };
    stateRef.current = next;
    store.setState(() => next);
  }, [store.setState]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Sunucuya yazar; başka cihaz araya girdiyse önce birleştirir */
  const push = useCallback(async (uid: string, attempt = 0): Promise<void> => {
    const c = sb()!;
    const payload = cloudPayload(stateRef.current);
    const h = hashOf(payload);
    if (h === meta.current.hash && meta.current.uid === uid) return;
    const { data, error } = await c.rpc('save_state', { p_data: payload, p_base: meta.current.rev ?? 0 });
    if (error) throw error;
    const rev = Number(data);
    if (rev > 0) {
      meta.current = { uid, rev, hash: h, at: Date.now() };
      saveMeta(meta.current);
      return;
    }
    if (attempt > 1) throw new Error('çakışma');
    await pull(uid, true);
    return push(uid, attempt + 1);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Sunucudaki sürüm daha yeniyse alır; bu cihazda kaydedilmemiş değişiklik varsa birleştirir */
  const pull = useCallback(async (uid: string, force = false): Promise<void> => {
    const c = sb()!;
    const { data: head, error: e1 } = await c.from('user_state').select('rev').eq('user_id', uid).maybeSingle();
    if (e1) throw e1;
    const m = meta.current;
    const sameUser = m.uid === uid;
    if (!head) {
      // Hesap yeni: bu cihazdaki kayıt hesaba taşınır.
      // Ama cihazda önceki başka bir hesabın kaydı varsa yeni hesaba aktarılmaz.
      if (m.uid && !sameUser) {
        const cur = stateRef.current;
        apply(sanitize({ onboarded: true, name: '', view: cur.view, dv: 3 }));
      }
      meta.current = { uid, rev: 0 };
      return;
    }
    if (!force && sameUser && head.rev === m.rev) return;
    const { data: row, error: e2 } = await c.from('user_state').select('rev,data').eq('user_id', uid).maybeSingle();
    if (e2) throw e2;
    if (!row) return;
    const remote = sanitize(row.data);
    const local = stateRef.current;
    const localDirty = hashOf(cloudPayload(local)) !== m.hash;
    let next: State;
    if (sameUser) next = localDirty ? mergeStates(local, remote) : remote;
    else if (!m.uid && hasData(local)) next = mergeStates(local, remote); // bu cihaz ilk kez bağlanıyor
    else next = remote; // başka bir hesap bu cihazdan çıkmış
    apply(next);
    meta.current = { uid, rev: row.rev, hash: hashOf(cloudPayload(remote)), at: Date.now() };
    saveMeta(meta.current);
  }, [apply]);

  const run = useCallback((fn: (uid: string) => Promise<void>) => {
    const uid = uidRef.current;
    if (!uid) return Promise.resolve();
    const job = (busy.current || Promise.resolve()).then(async () => {
      setStatus('syncing');
      try {
        await fn(uid);
        setStatus('ok');
        setLastSync(Date.now());
      } catch (e) {
        const offline = /fetch|network|failed/i.test(String((e as Error)?.message || e));
        setStatus(offline ? 'offline' : 'error');
      }
    });
    busy.current = job;
    return job;
  }, []);

  const syncNow = useCallback(() => run(async (uid) => { await pull(uid); await push(uid); }), [run, pull, push]);

  // Oturumu izle
  useEffect(() => {
    const c = sb();
    if (!c) return;
    let alive = true;
    loadMeta().then((m) => { meta.current = m; });
    const toUser = (u: { id: string; email?: string | null; app_metadata?: { provider?: string; providers?: string[] } } | null | undefined): AccountUser | null =>
      u ? { id: u.id, email: u.email || null, google: !!u.app_metadata?.providers?.includes('google') || u.app_metadata?.provider === 'google' } : null;
    const { data: sub } = c.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      const u = toUser(session?.user);
      const changed = (u?.id || null) !== uidRef.current;
      uidRef.current = u?.id || null;
      setUser(u);
      if (!u) { setStatus('off'); return; }
      if (changed) setTimeout(() => { loadMeta().then((m) => { meta.current = m; syncNow(); }); }, 0);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [syncNow]);

  // Değişiklikleri birkaç saniye sonra sunucuya yaz
  const payloadHash = useMemo(() => (user ? hashOf(cloudPayload(store.state)) : ''), [store.state, user]);
  useEffect(() => {
    if (!user || !payloadHash || payloadHash === meta.current.hash) return;
    const h = setTimeout(() => run(push), 2000);
    return () => clearTimeout(h);
  }, [payloadHash, user, run, push]);

  // Öne gelince ve 5 dakikada bir sunucuyu kontrol et; arka plana geçerken bekleyeni yaz
  useEffect(() => {
    if (!user) return;
    let last = Date.now();
    const check = () => { if (Date.now() - last > 60 * 1000) { last = Date.now(); syncNow(); } };
    const onVis = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'visible') check(); else run(push);
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') check(); });
    const iv = setInterval(() => { last = 0; check(); }, 5 * 60 * 1000);
    return () => { if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis); sub.remove(); clearInterval(iv); };
  }, [user, syncNow, run, push]);

  const value = useMemo<Ctx>(() => ({
    enabled, user, status, lastSync, recovery, syncNow,
    async signIn(email, pw) {
      const { error } = await sb()!.auth.signInWithPassword({ email: email.trim(), password: pw });
      return error ? authError(error) : null;
    },
    async signUp(email, pw) {
      const { data, error } = await sb()!.auth.signUp({ email: email.trim(), password: pw, options: { emailRedirectTo: siteUrl() } });
      if (error) return authError(error);
      // Mail onayı açıksa oturum hemen gelmez
      if (!data.session) return 'Mailine bir onay bağlantısı gönderdik. Bağlantıya dokunup sonra giriş yap.';
      return null;
    },
    async google() {
      const { error } = await sb()!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: siteUrl() } });
      return error ? authError(error) : null;
    },
    async resetPassword(email) {
      const { error } = await sb()!.auth.resetPasswordForEmail(email.trim(), { redirectTo: siteUrl() });
      return error ? authError(error) : null;
    },
    async updatePassword(pw) {
      const { error } = await sb()!.auth.updateUser({ password: pw });
      if (error) return authError(error);
      setRecovery(false);
      return null;
    },
    async signOut() {
      await run(push).catch(() => {});
      await sb()!.auth.signOut({ scope: 'local' }).catch(() => {});
    },
    async deleteAccount() {
      const { error } = await sb()!.rpc('delete_my_account');
      if (error) return authError(error);
      meta.current = {};
      await saveMeta({});
      await sb()!.auth.signOut({ scope: 'local' }).catch(() => {});
      return null;
    },
  }), [enabled, user, status, lastSync, recovery, syncNow, run, push]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount, AccountProvider içinde kullanılmalı');
  return ctx;
}
