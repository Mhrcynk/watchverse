import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { shareLink } from '@/components/share';
import { BackLink, Btn, Empty, H1, H3, Muted, Panel, Press, Screen, SectionHead, Small, useToast } from '@/components/ui';
import { useAccount } from '@/lib/account';
import { confirm } from '@/lib/confirm';
import { ago, feedView, friendFeed, inviteUrl, myProfile, removeFriend, resetInvite, setSharing, type Friend, type MyProfile } from '@/lib/friends';
import { useStore } from '@/lib/store';
import { C, F, R, alpha } from '@/lib/theme';

function FriendCard({ f, onRemove }: { f: Friend; onRemove: () => void }) {
  const last = f.items[0]?.at;
  return (
    <Panel style={{ paddingHorizontal: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: alpha(C.accent, 0.22), alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: F.bold, fontSize: 17, color: C.text }}>{(f.name[0] || '?').toLocaleUpperCase('tr')}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <H3 numberOfLines={1}>{f.name}</H3>
          <Small>{!f.share ? 'İzlediklerini paylaşmıyor' : last ? `Son hareket ${ago(last)}` : 'Henüz bir şey izlemedi'}</Small>
        </View>
        <Press accessibilityRole="button" accessibilityLabel={`${f.name} arkadaşlıktan çıkar`} onPress={onRemove} hitSlop={10}>
          <Feather name="user-minus" size={18} color={C.dim} />
        </Press>
      </View>
      {f.items.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 18, marginTop: 14 }}>
          {f.items.slice(0, 15).map((x) => {
            const v = feedView(x);
            return (
              <Press key={x.k} accessibilityRole="button" accessibilityLabel={`${v.title}, ${v.what}${v.rating ? `, ${v.rating} yıldız` : ''}`} onPress={() => router.push(v.route as never)} scaleTo={0.95} style={{ width: 92 }}>
                <View style={{ width: 92, aspectRatio: 2 / 3, borderRadius: R.sm, overflow: 'hidden', backgroundColor: C.raised, justifyContent: 'flex-end', padding: 6 }}>
                  {v.poster ? <Image source={{ uri: v.poster }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Text numberOfLines={3} style={{ fontFamily: F.bold, fontSize: 12, color: C.text }}>{v.title}</Text>}
                  {!!v.rating && (
                    <View style={{ position: 'absolute', right: 4, top: 4, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.72)' }}>
                      <Text style={{ fontFamily: F.bold, fontSize: 10.5, color: C.amber }}>★ {v.rating}</Text>
                    </View>
                  )}
                </View>
                <Text numberOfLines={1} style={{ marginTop: 5, fontFamily: F.medium, fontSize: 12, color: C.text }}>{v.title}</Text>
                <Small numberOfLines={1} style={{ fontSize: 11 }}>{v.what}</Small>
              </Press>
            );
          })}
        </ScrollView>
      )}
    </Panel>
  );
}

export default function Friends() {
  const acc = useAccount();
  const store = useStore();
  const toast = useToast();
  const [me, setMe] = useState<MyProfile | null>(null);
  const [list, setList] = useState<Friend[] | null>(null);
  const [err, setErr] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState(store.state.name);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

  const load = useCallback(async () => {
    try {
      const [p, f] = await Promise.all([myProfile(store.state.name), friendFeed()]);
      setMe(p); setList(f); setErr(false);
    } catch { setErr(true); }
  }, [store.state.name]);
  useEffect(() => { if (acc.user && store.state.name) load(); }, [acc.user, store.state.name, load]);

  if (!acc.enabled || !acc.user) {
    return (
      <Screen>
        <BackLink label="Profil" onPress={back} />
        <H1>Arkadaşlar</H1>
        <Empty icon="users" title="Arkadaşlar için giriş yap." text="Arkadaşlarını davet etmek ve neler izlediklerini görmek için bir hesabın olmalı." action="Giriş yap" onAction={() => router.push('/account')} />
      </Screen>
    );
  }

  if (!store.state.name) {
    return (
      <Screen>
        <BackLink label="Profil" onPress={back} />
        <H1>Arkadaşlar</H1>
        <Muted style={{ marginTop: 6, marginBottom: 16 }}>Önce bir ad seç; arkadaşların seni bu adla görecek.</Muted>
        <TextInput value={name} onChangeText={setName} autoFocus placeholder="Adın" placeholderTextColor={C.dim} maxLength={40} accessibilityLabel="Adın"
          style={{ height: 50, borderRadius: R.md, backgroundColor: C.raised, color: C.text, paddingHorizontal: 14, fontFamily: F.regular, fontSize: 16, outlineStyle: 'none' } as never} />
        <Btn label="Devam" style={{ marginTop: 12 }} disabled={!name.trim()} onPress={() => store.setName(name.trim())} />
      </Screen>
    );
  }

  return (
    <Screen refresh={<RefreshControl refreshing={refreshing} tintColor={C.muted} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <BackLink label="Profil" onPress={back} />
      <H1>Arkadaşlar</H1>
      <Muted style={{ marginTop: 6 }}>Davet bağlantını gönder; açan kişi seninle arkadaş olur. Birbirinizin son izlediklerini ve puanlarını görürsünüz, notlarınız gizli kalır.</Muted>

      <Panel style={{ marginTop: 18 }}>
        <Btn icon="user-plus" label="Davet bağlantısını gönder" disabled={!me} onPress={() => me && shareLink(inviteUrl(me.code), `${store.state.name} seni WatchVerse'e davet ediyor`, toast)} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: F.semibold, fontSize: 14.5, color: C.text }}>İzlediklerimi arkadaşlarım görebilsin</Text>
            <Small>Kapatırsan arkadaşların yalnızca adını görür.</Small>
          </View>
          <Switch value={me?.share ?? true} disabled={!me} trackColor={{ true: C.accent, false: C.line }} thumbColor="#fff" {...({ activeThumbColor: "#fff" } as object)} accessibilityLabel="İzlediklerimi arkadaşlarım görebilsin"
            onValueChange={async (v) => { setMe((m) => (m ? { ...m, share: v } : m)); try { await setSharing(v); } catch { toast('Kaydedilemedi'); } }} />
        </View>
        <Btn kind="quiet" label="Bağlantıyı yenile" style={{ alignSelf: 'flex-start', marginTop: 8 }} disabled={!me}
          onPress={() => confirm('Davet bağlantısı yenilensin mi?', 'Eski bağlantı artık çalışmaz. Var olan arkadaşların silinmez.', 'Yenile', async () => {
            try { const code = await resetInvite(); setMe((m) => (m ? { ...m, code } : m)); toast('Yeni bağlantı hazır'); } catch { toast('Yenilenemedi'); }
          })} />
      </Panel>

      <SectionHead title="Arkadaşların" note={list ? `${list.length} kişi` : undefined} />
      {err ? <Empty icon="wifi-off" title="Arkadaşların yüklenemedi." action="Tekrar dene" onAction={load} />
        : list === null ? <View style={{ paddingVertical: 40, alignItems: 'center' }}><ActivityIndicator color={C.accentSoft} /></View>
        : list.length ? <View style={{ gap: 12 }}>{list.map((f) => (
          <FriendCard key={f.id} f={f} onRemove={() => confirm(`${f.name} arkadaşlıktan çıkarılsın mı?`, 'Birbirinizin izlediklerini artık görmezsiniz.', 'Çıkar', async () => {
            try { await removeFriend(f.id); setList((l) => (l || []).filter((x) => x.id !== f.id)); toast('Arkadaşlıktan çıkarıldı'); } catch { toast('Çıkarılamadı'); }
          })} />
        ))}</View>
        : <Empty icon="users" title="Henüz arkadaşın yok." text="Davet bağlantını gönder; açan kişi seni ekler." />}
    </Screen>
  );
}
