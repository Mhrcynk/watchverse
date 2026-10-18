import { initialState } from './state-defaults';
import { recordReplica, seedReplica } from './replica';
import { accountRpc } from './account-rpc';
import { createSessionGuard } from './session-guard';
import { checkpoint } from './checkpoint';
import type { SyncMeta as Meta } from './checkpoint-store';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { AUTH_REDIRECT, finishAuth } from './auth-callback';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { sanitize, useStore } from './store';
import { authError, hasAuth, sb } from './supabase';
import type { State } from './types';
import { mergeStates } from './sync-merge';
export { mergeStates } from './sync-merge';

// Giriş dönüşündeki bilgiler adres çubuğundan kaybolmadan istemci hemen kurulur
sb();

const GUEST = 'watchverse:guest';
export type SyncStatus = 'off' | 'syncing' | 'ok' | 'offline' | 'error';
export type AccountUser = { id: string; email: string | null; google: boolean; apple?: boolean; name?: string | null };

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
  syncError: string | null;
  /** Apple ile giriş bu cihazda kullanılabilir mi (yalnızca iOS) */
  appleAvailable: boolean;
  apple: () => Promise<string | null>;
  google: () => Promise<string | null>;
  signOut: () => Promise<string | null>;
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

const loadMeta = async (): Promise<Meta> => (await checkpoint.load()).meta;
const saveMeta = checkpoint.saveMeta;

/* ---------- sağlayıcı ---------- */
export function AccountProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const enabled = hasAuth();
  const [user, setUser] = useState<AccountUser | null>(null);
  const [status, setStatus] = useState<SyncStatus>('off');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => { AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false)); }, []);
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
  const { getState, applySync } = store;
  const meta = useRef<Meta>({});
  const busy = useRef<Promise<void> | null>(null);
  const uidRef = useRef<string | null>(null);
  const [sessionGuard] = useState(createSessionGuard);

  const apply = useCallback((s: State, m: Meta) => {
    // Sunucudan gelen kayıt: cihaza özel alanlar korunur
    const cur = getState();
    const next = { ...s, device: cur.device, lastBackup: cur.lastBackup, onboarded: s.onboarded || cur.onboarded };
    return applySync(next, m);
  }, [getState, applySync]);

  /** Sunucudaki sürüm daha yeniyse alır; bu cihazda kaydedilmemiş değişiklik varsa birleştirir */
  const pull = useCallback(async (uid: string, force = false): Promise<void> => {
    const ticket = sessionGuard.capture(uid);
    if (!ticket) return;
    const c = sb()!;
    const { data: head, error: e1 } = await c.from('user_state').select('rev').eq('user_id', uid).maybeSingle();
    if (e1) throw e1;
    if (!sessionGuard.active(ticket)) return;
    const m = meta.current;
    const sameUser = m.uid === uid;
    if (!head) {
      // Hesap yeni: bu cihazdaki kayıt hesaba taşınır.
      // Ama cihazda önceki başka bir hesabın kaydı varsa yeni hesaba aktarılmaz.
      if (m.uid && !sameUser) {
        const cur = getState();
        await apply(sanitize({ onboarded: true, starter: true, name: '', view: cur.view, dv: 3 }), { uid, rev: 0 });
      }
      if (!sessionGuard.active(ticket)) return;
      meta.current = { uid, rev: 0 };
      await saveMeta(meta.current);
      return;
    }
    if (!force && sameUser && head.rev === m.rev && m.base) return;
    const { data: row, error: e2 } = await c.from('user_state').select('rev,data').eq('user_id', uid).maybeSingle();
    if (e2) throw e2;
    if (!sessionGuard.active(ticket)) return;
    if (!row) return;
    let remote = sanitize(row.data);
    const serverHash = hashOf(cloudPayload(remote));
    if (!remote.replica) {
      const before = sameUser && m.base ? sanitize(m.base) : initialState();
      remote = recordReplica({ ...before, replica: before.replica || seedReplica(before) }, remote, `legacy-server-${row.rev}`);
    }
    const local = getState();
    const localDirty = hashOf(cloudPayload(local)) !== m.hash;
    // Old clients did not persist a baseline. Never guess which missing records were deleted.
    if (sameUser && !m.base && hashOf(cloudPayload(local)) !== hashOf(cloudPayload(remote))) {
      throw new Error('Eski eşitleme kaydı: yerel ve bulut yedekleri karşılaştırılmadan otomatik birleştirme yapılamaz.');
    }
    let next: State;
    if (sameUser) next = localDirty ? mergeStates(local, remote, m.base || {}) : remote;
    else if (!m.uid && hasData(local)) next = mergeStates(local, remote); // bu cihaz ilk kez bağlanıyor
    else next = remote; // başka bir hesap bu cihazdan çıkmış
    meta.current = { uid, rev: row.rev, hash: serverHash, base: cloudPayload(remote), at: Date.now() };
    await apply(next, meta.current);
  }, [apply, getState, sessionGuard]);

  /** Sunucuya yazar; başka cihaz araya girdiyse önce birleştirir */
  const push = useCallback(async function send(uid: string, attempt = 0): Promise<void> {
    const ticket = sessionGuard.capture(uid);
    const c = sb()!;
    if (!ticket || meta.current.uid !== uid) return;
    if ((meta.current.rev || 0) > 0 && !meta.current.base) throw new Error('Eşitleme referansı eksik.');
    await checkpoint.flush();
    if (!sessionGuard.active(ticket)) return;
    const payload = cloudPayload(getState());
    const h = hashOf(payload);
    if (h === meta.current.hash && meta.current.uid === uid) return;
    const { data, error } = await c.rpc('save_state_v5', { p_data: payload, p_base: meta.current.rev ?? 0, p_owner: uid });
    if (error) throw error;
    if (!sessionGuard.active(ticket)) return;
    const rev = Number(data);
    if (rev > 0) {
      meta.current = { uid, rev, hash: h, base: payload, at: Date.now() };
      await saveMeta(meta.current);
      return;
    }
    if (attempt > 1) throw new Error('çakışma');
    await pull(uid, true);
    if (!sessionGuard.active(ticket)) return;
    return send(uid, attempt + 1);
  }, [getState, pull, sessionGuard]);

  const run = useCallback((fn: (uid: string) => Promise<void>) => {
    const uid = uidRef.current;
    const ticket = uid ? sessionGuard.capture(uid) : null;
    if (!uid || !ticket) return Promise.resolve();
    const job = (busy.current || Promise.resolve()).then(async () => {
      if (!sessionGuard.active(ticket)) return;
      setStatus('syncing');
      try {
        await fn(uid);
        if (!sessionGuard.active(ticket)) return;
        setStatus('ok');
        setSyncError(null);
        setLastSync(Date.now());
        if (meta.current.uid === uid && (meta.current.base || meta.current.rev === 0)) setFirstSync(true);
      } catch (e) {
        if (!sessionGuard.active(ticket)) return;
        const offline = /fetch|network|failed/i.test(String((e as Error)?.message || e));
        setStatus(offline ? 'offline' : 'error');
        setSyncError(authError(e));
      }
    });
    busy.current = job;
    return job;
  }, [sessionGuard]);

  const syncNow = useCallback(() => run(async (uid) => {
    const ticket = sessionGuard.capture(uid);
    await pull(uid);
    if (sessionGuard.active(ticket)) await push(uid);
  }), [run, pull, push, sessionGuard]);

  // Oturumu izle
  useEffect(() => {
    const c = sb();
    if (!c) return;
    let alive = true;
    const toUser = (u: { id: string; email?: string | null; app_metadata?: { provider?: string; providers?: string[] }; user_metadata?: { full_name?: string; name?: string; given_name?: string } } | null | undefined): AccountUser | null =>
      u ? { id: u.id, email: u.email || null, google: !!u.app_metadata?.providers?.includes('google') || u.app_metadata?.provider === 'google', apple: !!u.app_metadata?.providers?.includes('apple') || u.app_metadata?.provider === 'apple', name: (u.user_metadata?.given_name || u.user_metadata?.full_name || u.user_metadata?.name || '').trim().split(/\s+/)[0] || null } : null;
    const fallback = setTimeout(() => alive && setReady(true), 4000);
    const { data: sub } = c.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      setReady(true);
      const u = toUser(session?.user);
      const changed = (u?.id || null) !== uidRef.current;
      uidRef.current = u?.id || null;
      sessionGuard.switchUser(uidRef.current);
      setUser(u);
      if (!u) { setStatus('off'); setFirstSync(false); return; }
      if (changed || event === 'INITIAL_SESSION') setFirstSync(false);
      if (changed || event === 'INITIAL_SESSION') {
        const ticket = sessionGuard.capture(u.id);
        setTimeout(() => { loadMeta().then(m => { if (alive && sessionGuard.active(ticket)) { meta.current = m; syncNow(); } }).catch(() => { if (alive && sessionGuard.active(ticket)) setStatus('error'); }); }, 0);
      }
    });
    return () => { alive = false; sessionGuard.invalidate(); clearTimeout(fallback); sub.subscription.unsubscribe(); };
  }, [syncNow, sessionGuard]);

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
    enabled, ready: ready && guestLoaded, guest, setGuest, firstSync, user, status, lastSync, syncError, appleAvailable, syncNow,
    /** Apple ile giriş: Apple'ın verdiği kimlik belgesi Supabase'e doğrudan verilir (tarayıcı açılmaz) */
    async apple() {
      if (sessionGuard.isPaused()) return 'Hesap işlemi sürüyor. Lütfen bekle.';
      try {
        // Tek kullanımlık rastgele değer: Apple'a özeti, Supabase'e kendisi gider
        const raw = Crypto.randomUUID() + Crypto.randomUUID();
        const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
        const cred = await AppleAuthentication.signInAsync({
          requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
          nonce: hashed,
        });
        if (!cred.identityToken) return 'Apple girişi tamamlanamadı.';
        const { error } = await sb()!.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken, nonce: raw });
        if (error) return authError(error);
        // Apple adı yalnızca ilk girişte verir; boşsa kaydetmeye çalışmayız
        const given = cred.fullName?.givenName?.trim();
        if (given) await sb()!.auth.updateUser({ data: { given_name: given, full_name: [given, cred.fullName?.familyName].filter(Boolean).join(' ') } }).catch(() => {});
        return null;
      } catch (error) {
        if ((error as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return 'Giriş iptal edildi.';
        return authError(error);
      }
    },
    async google() {
      if (sessionGuard.isPaused()) return 'Hesap işlemi sürüyor. Lütfen bekle.';
      try {
        if (Platform.OS === 'web') {
          // Web: sayfa Google'a gider, dönüşte /auth/callback girişi tamamlar
          const { error } = await sb()!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: AUTH_REDIRECT } });
          return error ? authError(error) : null;
        }
        const { data, error } = await sb()!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: AUTH_REDIRECT, skipBrowserRedirect: true } });
        if (error) return authError(error);
        if (!data.url) return 'Giriş bağlantısı alınamadı.';
        const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT);
        if (result.type !== 'success') return 'Giriş iptal edildi.';
        await finishAuth(result.url);
        return null;
      } catch (error) { return authError(error); }
    },
    async signOut() {
      if (sessionGuard.isPaused()) return 'Hesap işlemi sürüyor. Lütfen bekle.';
      const uid = uidRef.current;
      const ticket = uid ? sessionGuard.capture(uid) : null;
      await run(push);
      if (!sessionGuard.active(ticket)) return 'Oturum değişti. Lütfen tekrar dene.';
      try {
        const device = getState().device;
        const owner = (await checkpoint.load()).meta.uid;
        if (device && owner === uid) await accountRpc('unregister_native_device', { p_id: device }, uid!);
        if (!sessionGuard.active(ticket)) return 'Oturum değişti. Lütfen tekrar dene.';
        const { error } = await sb()!.auth.signOut({ scope: 'local' });
        if (error) return authError(error);
        store.setState(s=>({...s,device:undefined}));
        setGuest(false);
        return null;
      } catch (error) { return authError(error); }
    },
    async deleteAccount() {
      const uid = uidRef.current;
      if (!uid) return 'Hesabı silmek için giriş yap.';
      const ticket = sessionGuard.pause(uid);
      if (!ticket) return 'Hesap işlemi sürüyor. Lütfen bekle.';
      let deleted = false;
      try {
        // Drain earlier sync jobs before deleting the server account.
        await busy.current;
        if (!sessionGuard.matches(ticket)) return 'Oturum değişti. Lütfen tekrar dene.';
        await checkpoint.flush();
        if (!sessionGuard.matches(ticket)) return 'Oturum değişti. Lütfen tekrar dene.';
        // Keep the local owner's identity. Retained data must never become guest data.
        // If another owner's data is still present, retain that owner instead.
        const localMeta = (await checkpoint.load()).meta;
        if (!sessionGuard.matches(ticket)) return 'Oturum değişti. Lütfen tekrar dene.';
        const ownedMeta = localMeta.uid ? localMeta : { ...localMeta, uid };
        await saveMeta(ownedMeta);
        if (!sessionGuard.matches(ticket)) return 'Oturum değişti. Lütfen tekrar dene.';
        meta.current = ownedMeta;
        const { error } = await sb()!.rpc('delete_my_account_v2', { p_owner: uid });
        if (error) return authError(error);
        deleted = true;
        if (!sessionGuard.matches(ticket)) return 'Hesap silindi; oturum değiştiği için yeni oturuma dokunulmadı.';
        const { error: signOutError } = await sb()!.auth.signOut({ scope: 'local' });
        if (signOutError) return 'Hesap silindi ancak cihaz oturumu kapatılamadı. Çıkış yapmayı yeniden dene.';
        setGuest(false);
        return null;
      } catch (error) {
        return deleted ? 'Hesap silindi ancak cihaz oturumu kapatılamadı. Çıkış yapmayı yeniden dene.' : authError(error);
      } finally { sessionGuard.resume(ticket); }
    },
  }), [enabled, ready, guestLoaded, guest, setGuest, firstSync, user, status, lastSync, syncError, appleAvailable, syncNow, run, push, sessionGuard, getState, store]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount, AccountProvider içinde kullanılmalı');
  return ctx;
}
