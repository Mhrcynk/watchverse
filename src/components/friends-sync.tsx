import { useEffect, useRef } from 'react';
import { useAccount } from '@/lib/account';
import { acceptInvite, myProfile, takePending } from '@/lib/friends';
import { useStore } from '@/lib/store';
import { useToast } from './ui';

/** Girişten sonra bekleyen daveti kabul eder; adın değişince profilini günceller */
export function FriendsSync() {
  const acc = useAccount();
  const { state } = useStore();
  const toast = useToast();
  const nameRef = useRef(state.name);
  nameRef.current = state.name;
  useEffect(() => {
    if (!acc.user) return;
    takePending().then(async (code) => {
      if (!code) return;
      try { const n = await acceptInvite(code, nameRef.current); toast(`${n} ile artık arkadaşsınız`); } catch { /* kendi davetin ya da geçersiz */ }
    });
  }, [acc.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!acc.user || !state.name) return;
    const h = setTimeout(() => { myProfile(state.name).catch(() => {}); }, 3000);
    return () => clearTimeout(h);
  }, [acc.user?.id, state.name]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
