import * as WebBrowser from 'expo-web-browser';
import { AUTH_REDIRECT, finishAuth } from './auth-callback';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { sanitize, useStore } from './store';
import { authError, hasAuth, sb } from './supabase';
import type { State } from './types';
import { mergeStates } from './sync-merge';
export { mergeStates } from './sync-merge';

// Giriş dönüşündeki bilgiler adres çubuğundan kaybolmadan istemci hemen kurulur
sb();

const META = 'watchverse:sync';
const GUEST = 'watchverse:guest';
type Meta = { uid?: string; rev?: number; hash?: string; at?: number; base?: Partial<State> };
export type SyncStatus = 'off' | 'syncing' | 'ok' | 'offline' | 'error';
export type AccountUser = { id: string; email: string | null; google: boolean; name?: string | null };

type Ctx = {
  enabled: boolean;
  /** oturum bilgisi okundu mu (açılışta kısa bir an) */
  ready: boolean;
  /** hesap açmadan devam etmeyi seçti */
  guest: boolean;
  setGuest: (v: boolean) => void;
  /** girişten sonraki ilk eşitleme bitti mi */
  firstSync: boolean;
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
  // Exact comparison: a short non-cryptographic hash can silently miss a changed record.
  return JSON.stringify(v);
}
const hasData = (s: State) => Object.keys(s.watched).length + Object.keys(s.episodes).length + Object.keys(s.lib).length + s.list.length + Object.keys(s.ratings).length > 0;

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
  const [ready, setReady] = useState(!enabled);
  const [guest, setGuestRaw] = useState(false);
  const [guestLoaded, setGuestLoaded] = useState(false);
  const [firstSync, setFirstSync] = useState(false);
  // Ad boşsa, ilk eşitlemeden sonra Google hesabındaki ilk ad kullanılır (kişi başına bir kez)
  const named = useRef<string | null>(null);
  useEffect(() => {
    if (!firstSync || !user?.name || named.current === user.id) return;
    named.current = user.id;
    if (!store.state.name.trim()) store.setName(user.name);
  }, [firstSync, user, store]);
  useEffect(() => {
    AsyncStorage.getItem(GUEST).then((v) => setGuestRaw(v === '1')).catch(() => {}).finally(() => setGuestLoaded(true));
  }, []);
  const setGuest = useCallback((v: boolean) => {
    setGuestRaw(v);
    (v ? AsyncStorage.setItem(GUEST, '1') : AsyncStorage.removeItem(GUEST)).catch(() => {});
  }, []);
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
    if (uidRef.current !== uid || meta.current.uid !== uid) return;
    if ((meta.current.rev || 0) > 0 && !meta.current.base) throw new Error('Eşitleme referansı eksik.');
    const payload = cloudPayload(stateRef.current);
    const h = hashOf(payload);
    if (h === meta.current.hash && meta.current.uid === uid) return;
    const { data, error } = await c.rpc('save_state_v3', { p_data: payload, p_base: meta.current.rev ?? 0 });
    if (error) throw error;
    if (uidRef.current !== uid) return;
    const rev = Number(data);
    if (rev > 0) {
      meta.current = { uid, rev, hash: h, base: payload, at: Date.now() };
      await saveMeta(meta.current);
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
    if (uidRef.current !== uid) return;
    const m = meta.current;
    const sameUser = m.uid === uid;
    if (!head) {
      // Hesap yeni: bu cihazdaki kayıt hesaba taşınır.
      // Ama cihazda önceki başka bir hesabın kaydı varsa yeni hesaba aktarılmaz.
      if (m.uid && !sameUser) {
        const cur = stateRef.current;
        apply(sanitize({ onboarded: true, starter: true, name: '', view: cur.view, dv: 3 }));
      }
      meta.current = { uid, rev: 0 };
      return;
    }
    if (!force && sameUser && head.rev === m.rev && m.base) return;
    const { data: row, error: e2 } = await c.from('user_state').select('rev,data').eq('user_id', uid).maybeSingle();
    if (e2) throw e2;
    if (uidRef.current !== uid) return;
    if (!row) return;
    const remote = sanitize(row.data);
    const local = stateRef.current;
    const localDirty = hashOf(cloudPayload(local)) !== m.hash;
    // Old clients did not persist a baseline. Never guess which missing records were deleted.
    if (sameUser && !m.base && hashOf(cloudPayload(local)) !== hashOf(cloudPayload(remote))) {
      throw new Error('Eski eşitleme kaydı: yerel ve bulut yedekleri karşılaştırılmadan otomatik birleştirme yapılamaz.');
    }
    let next: State;
    if (sameUser) next = localDirty ? mergeStates(local, remote, m.base || {}) : remote;
    else if (!m.uid && hasData(local)) next = mergeStates(local, remote); // bu cihaz ilk kez bağlanıyor
    else next = remote; // başka bir hesap bu cihazdan çıkmış
    apply(next);
    meta.current = { uid, rev: row.rev, hash: hashOf(cloudPayload(remote)), base: cloudPayload(remote), at: Date.now() };
    await saveMeta(meta.current);
  }, [apply]);

  const run = useCallback((fn: (uid: string) => Promise<void>) => {
    const uid = uidRef.current;
    if (!uid) return Promise.resolve();
    const job = (busy.current || Promise.resolve()).then(async () => {
      if (uidRef.current !== uid) return;
      setStatus('syncing');
      try {
        await fn(uid);
        if (uidRef.current !== uid) return;
        setStatus('ok');
        setLastSync(Date.now());
      } catch (e) {
        if (uidRef.current !== uid) return;
        const offline = /fetch|network|failed/i.test(String((e as Error)?.message || e));
        setStatus(offline ? 'offline' : 'error');
      }
      // A failed initial pull must never be followed by an automatic blind push.
      if (meta.current.uid === uid && (meta.current.base || meta.current.rev === 0)) setFirstSync(true);
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
    const toUser = (u: { id: string; email?: string | null; app_metadata?: { provider?: string; providers?: string[] }; user_metadata?: { full_name?: string; name?: string; given_name?: string } } | null | undefined): AccountUser | null =>
      u ? { id: u.id, email: u.email || null, google: !!u.app_metadata?.providers?.includes('google') || u.app_metadata?.provider === 'google', name: (u.user_metadata?.given_name || u.user_metadata?.full_name || u.user_metadata?.name || '').trim().split(/\s+/)[0] || null } : null;
    const fallback = setTimeout(() => alive && setReady(true), 4000);
    const { data: sub } = c.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      setReady(true);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      const u = toUser(session?.user);
      const changed = (u?.id || null) !== uidRef.current;
      uidRef.current = u?.id || null;
      setUser(u);
      if (!u) { setStatus('off'); setFirstSync(false); return; }
      if (changed) setFirstSync(false);
      if (changed) setTimeout(() => { loadMeta().then((m) => { if (alive && uidRef.current === u.id) { meta.current = m; syncNow(); } }); }, 0);
    });
    return () => { alive = false; clearTimeout(fallback); sub.subscription.unsubscribe(); };
  }, [syncNow]);

  // Değişiklikleri birkaç saniye sonra sunucuya yaz
  const payloadHash = useMemo(() => (user ? hashOf(cloudPayload(store.state)) : ''), [store.state, user]);
  useEffect(() => {
    if (!firstSync || !user || !payloadHash || payloadHash === meta.current.hash) return;
    const h = setTimeout(() => run(push), 2000);
    return () => clearTimeout(h);
  }, [payloadHash, firstSync, user, run, push]);

  // Öne gelince ve 5 dakikada bir sunucuyu kontrol et; arka plana geçerken bekleyeni yaz
  useEffect(() => {
    if (!user) return;
    let last = Date.now();
    const check = () => { if (Date.now() - last > 60 * 1000) { last = Date.now(); syncNow(); } };
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') check(); else run(push); });
    const iv = setInterval(() => { last = 0; check(); }, 5 * 60 * 1000);
    return () => { sub.remove(); clearInterval(iv); };
  }, [user, syncNow, run, push]);

  const value = useMemo<Ctx>(() => ({
    enabled, ready: ready && guestLoaded, guest, setGuest, firstSync, user, status, lastSync, recovery, syncNow,
    async signIn(email, pw) {
      const { error } = await sb()!.auth.signInWithPassword({ email: email.trim(), password: pw });
      return error ? authError(error) : null;
    },
    async signUp(email, pw) {
      const { data, error } = await sb()!.auth.signUp({ email: email.trim(), password: pw, options: { emailRedirectTo: AUTH_REDIRECT } });
      if (error) return authError(error);
      // Mail onayı açıksa oturum hemen gelmez
      if (!data.session) return 'Mailine bir onay bağlantısı gönderdik. Bağlantıya dokunup sonra giriş yap.';
      return null;
    },
    async google() {
      try {
        const { data, error } = await sb()!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: AUTH_REDIRECT, skipBrowserRedirect: true } });
        if (error) return authError(error);
        if (!data.url) return 'Giriş bağlantısı alınamadı.';
        const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT);
        if (result.type !== 'success') return 'Giriş iptal edildi.';
        await finishAuth(result.url);
        return null;
      } catch (error) { return authError(error); }
    },
    async resetPassword(email) {
      const { error } = await sb()!.auth.resetPasswordForEmail(email.trim(), { redirectTo: AUTH_REDIRECT });
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
      setGuest(false);
    },
    async deleteAccount() {
      const { error } = await sb()!.rpc('delete_my_account');
      if (error) return authError(error);
      meta.current = {};
      await saveMeta({});
      await sb()!.auth.signOut({ scope: 'local' }).catch(() => {});
      setGuest(false);
      return null;
    },
  }), [enabled, ready, guestLoaded, guest, setGuest, firstSync, user, status, lastSync, recovery, syncNow, run, push]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount, AccountProvider içinde kullanılmalı');
  return ctx;
}
