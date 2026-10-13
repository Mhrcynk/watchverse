import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { useAccount } from '@/lib/account';
import { confirm } from '@/lib/confirm';
import { copyText } from '@/lib/push';
import { useStore } from '@/lib/store';
import { sb, siteUrl } from '@/lib/supabase';
import type { UList } from '@/lib/types';
import { Btn, useToast } from './ui';

const slugId = () => Array.from({ length: 12 }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]).join('');
export const shareUrl = (slug: string) => `${siteUrl()}l/${slug}`;

async function pushList(l: UList, ownerName: string, slug: string) {
  const { error } = await sb()!.rpc('share_list', { p_slug: slug, p_name: l.name, p_items: l.items.map(({ k, t, p, y }) => ({ k, t, p, y })), p_owner_name: ownerName });
  if (error) throw error;
}

/** Bağlantıyı paylaşma penceresi ya da panoya kopyalama */
export async function shareLink(url: string, title: string, toast: (m: string) => void) {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'share' in navigator) {
    try { await navigator.share({ title, url }); return; } catch (e) { if ((e as Error)?.name === 'AbortError') return; }
  }
  toast((await copyText(url)) ? 'Bağlantı kopyalandı' : url);
}

export function ShareListButton({ list }: { list: UList }) {
  const acc = useAccount();
  const store = useStore();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!acc.enabled) return null;
  if (!acc.user) return <Btn icon="share-2" kind="secondary" label="Paylaş" onPress={() => { toast('Paylaşmak için giriş yapman gerekiyor'); router.push('/account'); }} />;

  if (list.share) {
    const slug = list.share;
    return (
      <>
        <Btn icon="share-2" label="Bağlantıyı paylaş" onPress={() => shareLink(shareUrl(slug), list.name, toast)} />
        <Btn kind="quiet" label="Paylaşımı kapat" onPress={() => confirm('Paylaşım kapatılsın mı?', 'Bağlantı artık açılmaz. Listen sende kalır.', 'Kapat', async () => {
          await sb()!.rpc('unshare_list', { p_slug: slug });
          store.listSetShare(list.id, undefined);
          toast('Paylaşım kapatıldı');
        })} />
      </>
    );
  }
  return (
    <Btn icon="share-2" kind="secondary" label={busy ? 'Hazırlanıyor…' : 'Paylaş'} disabled={busy}
      onPress={async () => {
        setBusy(true);
        const slug = slugId();
        try {
          await pushList(list, store.state.name, slug);
          store.listSetShare(list.id, slug);
          await shareLink(shareUrl(slug), list.name, toast);
        } catch { toast('Paylaşılamadı. İnternet bağlantını kontrol et.'); }
        setBusy(false);
      }} />
  );
}

/** Paylaşılan listeler değişince sunucudaki kopyasını günceller */
export function SharedListsSync() {
  const { state } = useStore();
  const acc = useAccount();
  const pushed = useRef<Record<string, number>>({});
  const sig = Object.values(state.lists).filter((l) => l.share).map((l) => `${l.share}:${l.updated}`).join('|');
  useEffect(() => {
    if (!acc.user || !sig) return;
    const h = setTimeout(() => {
      for (const l of Object.values(state.lists)) {
        if (!l.share || pushed.current[l.share] === l.updated) continue;
        const at = l.updated;
        pushList(l, state.name, l.share).then(() => { pushed.current[l.share!] = at; }).catch(() => {});
      }
    }, 2500);
    return () => clearTimeout(h);
  }, [sig, acc.user]); // eslint-disable-line react-hooks/exhaustive-deps
  return <View style={{ display: 'none' }} />;
}
