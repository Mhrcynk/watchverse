import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { enablePush } from '@/lib/push';
import { useStore } from '@/lib/store';
import { hasSyncApi, syncDevice } from '@/lib/sync';
import { C, F, R, alpha } from '@/lib/theme';
import { FadeIn, Press, Small, tap, useToast } from './ui';

type IconName = React.ComponentProps<typeof Feather>['name'];

/** Yeni kullanıcıya ana sayfada isteğe bağlı ilk adımlar; kapatılabilir, hepsi bitince kendiliğinden kalkar */
export function StarterCard() {
  const store = useStore();
  const s = store.state;
  const toast = useToast();
  const [pushOn, setPushOn] = useState(false);
  const [busy, setBusy] = useState(false);

  const steps: { k: string; icon: IconName; title: string; sub: string; done: boolean; go: () => void }[] = [
    { k: 'u', icon: 'globe', title: 'Evrenlerini seç', sub: 'Marvel, Star Wars, Yüzüklerin Efendisi… Takip ettiklerin öne çıkar.', done: s.follow.length > 0, go: () => router.push('/onboarding?only=universes') },
    { k: 'i', icon: 'download' as IconName, title: 'İzlediklerini aktar', sub: 'Letterboxd ya da TV Time kaydın varsa tek seferde gelsin.', done: Object.keys(s.lib).length + Object.keys(s.watched).length >= 10, go: () => router.push('/import') },
    {
      k: 'n', icon: 'bell', title: 'Bildirimleri aç', sub: 'Takip ettiğin dizide yeni bölüm çıkınca haber ver.', done: pushOn,
      go: async () => {
        if (busy) return;
        setBusy(true);
        const r = await enablePush(s.follow);
        if (!r.ok) toast(r.reason);
        else if (hasSyncApi() && (await syncDevice(s, store.ensureDevice(), true))) { setPushOn(true); tap('success'); toast('Bildirimler açıldı'); }
        else toast('Bildirimler açılamadı, sonra Profil’den tekrar dene');
        setBusy(false);
      },
    },
  ];
  const left = steps.filter((x) => !x.done).length;
  const close = () => store.setState((x) => ({ ...x, starter: false }));
  // hepsi tamamlanınca kart kendiliğinden kalkar
  useEffect(() => { if (s.starter && left === 0) { const h = setTimeout(close, 2500); return () => clearTimeout(h); } }, [s.starter, left]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s.starter) return null;

  return (
    <FadeIn>
      <View style={{ marginTop: 22, borderRadius: R.lg, backgroundColor: C.card, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 }}>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={{ fontFamily: F.bold, fontSize: 17, color: C.text }}>{left ? 'Başlarken' : 'Hazırsın'}</Text>
            <Small style={{ marginTop: 2 }}>{left ? `İsteğe bağlı · ${steps.length - left} / ${steps.length} tamam` : 'Hepsi tamam. İyi seyirler!'}</Small>
          </View>
          <Press accessibilityRole="button" accessibilityLabel="Başlarken kartını kapat" onPress={close} hitSlop={10}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.raised, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="x" size={17} color={C.muted} />
          </Press>
        </View>
        {steps.map((x, i) => (
          <Press key={x.k} accessibilityRole="button" accessibilityLabel={`${x.title}${x.done ? ', tamamlandı' : ''}`} onPress={x.done ? undefined : x.go} scaleTo={x.done ? 1 : 0.99}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: C.line, opacity: x.done ? 0.6 : 1 }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: x.done ? alpha(C.green, 0.16) : alpha(C.accent, 0.14), alignItems: 'center', justifyContent: 'center' }}>
              <Feather name={x.done ? 'check' : x.icon} size={16} color={x.done ? C.green : C.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.text, textDecorationLine: x.done ? 'line-through' : 'none' }}>{x.title}</Text>
              {!x.done && <Text style={{ marginTop: 2, fontFamily: F.regular, fontSize: 12.5, lineHeight: 17, color: C.muted }}>{x.sub}</Text>}
            </View>
            {!x.done && <Feather name="chevron-right" size={18} color={C.dim} />}
          </Press>
        ))}
      </View>
    </FadeIn>
  );
}
