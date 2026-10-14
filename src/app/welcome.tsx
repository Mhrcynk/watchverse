import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Brand } from '@/components/brand';
import { Btn, Press, Small, useLayout } from '@/components/ui';
import { useAccount } from '@/lib/account';
import { LANG, setLang } from '@/lib/i18n';
import { CATALOG, TBY, TIER_TR, UNIVERSES, posterUrl } from '@/lib/catalog';
import { TIER_COLOR } from '@/components/media';
import { C, F, R, alpha } from '@/lib/theme';

type Slide = { title: string; text: string; art: 'posters' | 'order' | 'episodes' | 'devices' };

/* ---------- görseller ---------- */
function Posters({ w }: { w: number }) {
  const list = useMemo(() => CATALOG.filter((t) => t.tmdb?.p && t.tier === 0).slice(0, 40), []);
  const pick = (i: number) => list.length ? list[(i * 7) % list.length] : null;
  const pw = Math.round(w / 3.6);
  return (
    <View style={{ width: w, height: pw * 1.5 * 2 + 12, overflow: 'hidden' }}>
      {[0, 1].map((row) => (
        <View key={row} style={{ flexDirection: 'row', gap: 10, marginTop: row ? 12 : 0, marginLeft: row ? -pw * 0.45 : -pw * 0.15 }}>
          {[0, 1, 2, 3, 4].map((c) => {
            const t = pick(row * 5 + c + 1);
            const uri = t ? posterUrl(t, 'w185') : null;
            return (
              <View key={c} style={{ width: pw, aspectRatio: 2 / 3, borderRadius: R.sm, overflow: 'hidden', backgroundColor: C.card }}>
                {uri && <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />}
              </View>
            );
          })}
        </View>
      ))}
      <LinearGradient colors={['rgba(0,0,0,0)', C.bg]} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
    </View>
  );
}

const tag = (label: string, color: string) => (
  <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, backgroundColor: alpha(color, 0.18) }}>
    <Text style={{ fontFamily: F.bold, fontSize: 10.5, color }}>{label}</Text>
  </View>
);

function Card({ children, w }: { children: React.ReactNode; w: number }) {
  return <View style={{ width: Math.min(w, 340), alignSelf: 'center', backgroundColor: C.card, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, padding: 16, gap: 12 }}>{children}</View>;
}

function Order({ w }: { w: number }) {
  // Gerçek katalogdan: Marvel'in ilk yapımları ve etiketleri
  const rows = ['iron', 'hulk', 'marvel-b74740e8cc', 'iron2'].map((id) => TBY[id]).filter(Boolean);
  return (
    <Card w={w}>
      {rows.map((t, n) => (
        <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={{ width: 18, fontFamily: F.bold, fontSize: 15, color: C.dim }}>{n + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: F.semibold, fontSize: 15, color: C.text }}>{t.trTitle || t.title}</Text>
            <Small>{t.year}</Small>
          </View>
          {tag(TIER_TR[t.tier], TIER_COLOR(t))}
        </View>
      ))}
    </Card>
  );
}

function Episodes({ w }: { w: number }) {
  return (
    <Card w={w}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.text }}>2. Sezon</Text>
        {tag('Yeni bölüm', C.accentSoft)}
      </View>
      {[1, 2, 3, 4].map((e) => (
        <View key={e} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: e < 3 ? C.accent : C.line, backgroundColor: e < 3 ? C.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {e < 3 && <Feather name="check" size={14} color={C.onAccent} />}
          </View>
          <Text style={{ flex: 1, fontFamily: F.medium, fontSize: 14.5, color: e < 3 ? C.muted : C.text }}>{`${e}. Bölüm`}</Text>
          {e === 3 && <Small style={{ color: C.accentSoft }}>Sıradaki</Small>}
        </View>
      ))}
    </Card>
  );
}

function Devices() {
  const box = (icon: 'smartphone' | 'monitor' | 'tablet', size: number) => (
    <View style={{ width: size, height: size, borderRadius: 18, backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
      <Feather name={icon} size={size * 0.38} color={C.text} />
    </View>
  );
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: 74, height: 74, borderRadius: 37, backgroundColor: alpha(C.accent, 0.18), alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: alpha(C.accent, 0.5) }}>
        <Feather name="cloud" size={32} color={C.accentSoft} />
      </View>
      <View style={{ flexDirection: 'row', gap: 14, marginTop: 22, alignItems: 'flex-end' }}>
        {box('smartphone', 64)}{box('monitor', 84)}{box('tablet', 64)}
      </View>
    </View>
  );
}

/* ---------- ekran ---------- */
export default function Welcome() {
  const acc = useAccount();
  const { width, pad, tablet } = useLayout();
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  const [h, setH] = useState(0);
  const ref = useRef<ScrollView>(null);
  const w = Math.min(width, 720);
  const inner = w - pad * 2;

  const slides: Slide[] = [
    { art: 'posters', title: 'Tüm film ve diziler tek yerde', text: 'Türk dizilerinden dünya yapımlarına her şeyi bul. Puanını ve hangi platformda olduğunu gör.' },
    { art: 'order', title: 'Evrenleri doğru sırayla izle', text: `Marvel, Star Wars ve ${Math.max(UNIVERSES.length - 2, 0)} evren daha. Ana hikâye, çıkış sırası ya da kronolojik.` },
    { art: 'episodes', title: 'Kaldığın yeri unutma', text: 'Bölüm bölüm işaretle, sıradakini hemen gör. Yeni bölüm çıkınca bildirim gelsin.' },
    { art: 'devices', title: 'Her cihazda seninle', text: 'Hesabınla giriş yap; izlediklerin telefonda da bilgisayarda da aynı görünür, kaybolmaz.' },
  ];

  if (acc.ready && acc.user) return <Redirect href="/" />;

  const go = (n: number) => { setI(n); ref.current?.scrollTo({ x: n * w, animated: true }); };
  const last = i === slides.length - 1;
  const guest = () => { acc.setGuest(true); router.replace('/'); };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center' }}>
      <LinearGradient colors={[alpha(C.accent, 0.2), 'transparent']} style={[StyleSheet.absoluteFill, { height: 360 }]} pointerEvents="none" />
      <View style={{ width: w, flex: 1, paddingTop: insets.top + 18 }}>
        <View style={{ paddingHorizontal: pad, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Brand />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
            {Platform.OS === 'web' && (
              <Press accessibilityRole="button" accessibilityLabel={LANG === 'en' ? 'Türkçe' : 'English'} onPress={() => setLang(LANG === 'en' ? 'tr' : 'en')} hitSlop={10}
                style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line }}>
                <Text style={{ fontFamily: F.semibold, fontSize: 12, color: C.muted }}>{LANG === 'en' ? 'TR' : 'EN'}</Text>
              </Press>
            )}
            {!last && <Press accessibilityRole="button" onPress={() => go(slides.length - 1)} hitSlop={10}><Small style={{ color: C.muted }}>Atla</Small></Press>}
          </View>
        </View>

        <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ flex: 1 }} onLayout={(e) => setH(e.nativeEvent.layout.height)}
          onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / w))}
          onScroll={(e) => { const n = Math.round(e.nativeEvent.contentOffset.x / w); if (n !== i) setI(n); }} scrollEventThrottle={64}>
          {slides.map((s) => (
            <View key={s.title} style={{ width: w, height: h || undefined, paddingHorizontal: pad, justifyContent: 'center' }}>
              <View style={{ minHeight: tablet ? 340 : Math.min(300, Math.max(220, h - 230)), justifyContent: 'center' }}>
                {s.art === 'posters' ? <View style={{ marginHorizontal: -pad }}><Posters w={w} /></View> : s.art === 'order' ? <Order w={inner} /> : s.art === 'episodes' ? <Episodes w={inner} /> : <Devices />}
              </View>
              <Text accessibilityRole="header" style={{ marginTop: 26, fontFamily: F.bold, fontSize: tablet ? 36 : 29, lineHeight: tablet ? 42 : 35, color: C.text, letterSpacing: -0.8 }}>{s.title}</Text>
              <Text style={{ marginTop: 10, fontFamily: F.regular, fontSize: 16, lineHeight: 24, color: C.muted, maxWidth: 520 }}>{s.text}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: pad, paddingBottom: insets.bottom + 18, paddingTop: 12 }}>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 20 }} accessibilityLabel={`${slides.length} tanıtımdan ${i + 1}.`}>
            {slides.map((s, n) => (
              <Press key={s.title} accessibilityRole="button" accessibilityLabel={`${n + 1}. tanıtım`} onPress={() => go(n)} hitSlop={8} scaleTo={1}>
                <View style={{ width: n === i ? 22 : 7, height: 7, borderRadius: 4, backgroundColor: n === i ? C.accent : C.line }} />
              </Press>
            ))}
          </View>
          {acc.enabled ? (
            last ? (
              <>
                <Btn label="Hesap aç" onPress={() => router.push('/account?mode=signup&from=welcome')} />
                <Btn kind="secondary" label="Giriş yap" style={{ marginTop: 10 }} onPress={() => router.push('/account?mode=signin&from=welcome')} />
                <Press accessibilityRole="button" onPress={guest} hitSlop={8} style={{ alignSelf: 'center', marginTop: 16 }}>
                  <Small style={{ color: C.dim }}>Hesap açmadan devam et</Small>
                </Press>
              </>
            ) : (
              <>
                <Btn label="Devam" onPress={() => go(i + 1)} />
                <Btn kind="secondary" label="Zaten hesabım var" style={{ marginTop: 10 }} onPress={() => router.push('/account?mode=signin&from=welcome')} />
              </>
            )
          ) : (
            <Btn label={last ? 'Başla' : 'Devam'} onPress={() => (last ? guest() : go(i + 1))} />
          )}
        </View>
      </View>
    </View>
  );
}
