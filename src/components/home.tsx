import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { isEn } from '@/lib/i18n';
import { useReducedMotion } from '@/lib/motion';
import { C, F, R, alpha } from '@/lib/theme';
import { img, type TItem } from '@/lib/tmdb';
import { usePreview } from './preview';
import { Btn, Bar, FadeIn, Press, useLayout } from './ui';

/** Selamlama + profil yuvarlağı */
export function Greeting({ name, sub }: { name: string; sub: string }) {
  const initial = (name.trim()[0] || 'W').toLocaleUpperCase('tr');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" numberOfLines={1} style={{ fontSize: 22, color: C.text, letterSpacing: -0.4 }}>
          {isEn ? <Text style={{ fontFamily: F.bold }}>{name ? `Merhaba, ${name}.` : 'Merhaba, gezgin.'}</Text> : (
            <><Text style={{ fontFamily: F.bold }}>Merhaba</Text><Text style={{ fontFamily: F.regular }}>{` ${name || 'gezgin'}!`}</Text></>
          )}
        </Text>
        <Text style={{ marginTop: 4, fontFamily: F.regular, fontSize: 14, color: C.muted }}>{sub}</Text>
      </View>
      <Press accessibilityRole="button" accessibilityLabel="Profil" onPress={() => router.push('/profile')} scaleTo={0.92}>
        <LinearGradient colors={[C.accentSoft, '#C9902A']} style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: F.bold, fontSize: 19, color: C.onAccent }}>{initial}</Text>
        </LinearGradient>
      </Press>
    </View>
  );
}

const kindText = (x: TItem) => [x.m === 'movie' ? 'Film' : 'Dizi', x.year].filter(Boolean).join(' · ');

/** Öne çıkanlar: ortadaki afiş büyük, yanlardakiler küçülüp hafifçe döner */
export function Coverflow({ items }: { items: TItem[] }) {
  const { width, pad } = useLayout();
  const { open } = usePreview();
  const reduced = useReducedMotion();
  const cw = Math.min(300, Math.round((width - pad * 2) * 0.72));
  const gap = 14;
  const step = cw + gap;
  const side = (width - cw) / 2;
  const [x] = useState(() => new Animated.Value(0));
  const [i, setI] = useState(0);
  if (!items.length) return null;
  return (
    <View style={{ marginHorizontal: -pad }}>
      <Animated.ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={step} decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: side - gap / 2, paddingVertical: 8 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x } } }], { useNativeDriver: false, listener: (e: any) => { const n = Math.round(e.nativeEvent.contentOffset.x / step); if (n !== i) setI(n); } })}
        scrollEventThrottle={16}>
        {items.map((it, n) => {
          const r = [(n - 1) * step, n * step, (n + 1) * step];
          const scale = reduced ? 1 : x.interpolate({ inputRange: r, outputRange: [0.84, 1, 0.84], extrapolate: 'clamp' });
          const rotateY = reduced ? '0deg' : x.interpolate({ inputRange: r, outputRange: ['16deg', '0deg', '-16deg'], extrapolate: 'clamp' });
          const opacity = x.interpolate({ inputRange: r, outputRange: [0.55, 1, 0.55], extrapolate: 'clamp' });
          const uri = img(it.p, 'w500');
          return (
            <Animated.View key={it.key} style={{ width: cw, marginHorizontal: gap / 2, opacity, transform: [{ perspective: 900 }, { rotateY }, { scale }] }}>
              <Press accessibilityRole="button" accessibilityLabel={`${it.title}, ${kindText(it)}${it.vote ? `, puan ${it.vote.toFixed(1)}` : ''}`} onPress={() => open(it)} scaleTo={0.98}>
                <View style={{ width: cw, aspectRatio: 2 / 3, borderRadius: R.xl, overflow: 'hidden', backgroundColor: C.card, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 14 } }}>
                  {uri && <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />}
                  <LinearGradient colors={['rgba(21,23,29,0)', 'rgba(21,23,29,0.25)', 'rgba(15,16,21,0.94)']} locations={[0.45, 0.65, 1]} style={StyleSheet.absoluteFill} />
                  <View style={{ position: 'absolute', left: 18, right: 18, bottom: 18 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      {it.vote > 0 && it.votes >= 15 ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <Feather name="star" size={14} color={C.accent} />
                          <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.accent }}>{it.vote.toFixed(1)}</Text>
                        </View>
                      ) : <View />}
                      <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: C.accent }}>
                        <Text style={{ fontFamily: F.bold, fontSize: 11.5, color: C.onAccent }}>{kindText(it)}</Text>
                      </View>
                    </View>
                    <Text numberOfLines={2} style={{ marginTop: 10, fontFamily: F.heavy, fontSize: 26, lineHeight: 29, color: '#FFFFFF', letterSpacing: -0.6, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 10 }}>{it.title}</Text>
                  </View>
                </View>
              </Press>
            </Animated.View>
          );
        })}
      </Animated.ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 14 }} accessibilityLabel={`${items.length} öne çıkandan ${i + 1}.`}>
        {items.map((it, n) => <View key={it.key} style={{ width: n === i ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: n === i ? C.text : C.line }} />)}
      </View>
    </View>
  );
}

/** Bilet görünümlü kart: solda afiş, sağda ad ve durum; aralarında küçük bir çentik */
export function TicketCard({ title, poster, sub, badge, pct, score, onPress, onWatched, watchedLabel, width, index = 0 }: {
  title: string; poster: string | null; sub?: string; badge?: string; pct?: number; score?: string | null; onPress: () => void; onWatched?: () => void; watchedLabel?: string; width: number; index?: number;
}) {
  const pw = 86;
  const notch = { position: 'absolute' as const, left: pw + 22, width: 18, height: 18, borderRadius: 9, backgroundColor: C.bg };
  return (
    <FadeIn index={index} from={8}>
      <View style={{ width }}>
      <Press accessibilityRole="button" accessibilityLabel={[title, sub, badge].filter(Boolean).join(', ')} onPress={onPress} scaleTo={0.97}
        style={{ width, flexDirection: 'row', gap: 16, padding: 12, borderRadius: R.lg, backgroundColor: C.card }}>
        <View style={{ width: pw, aspectRatio: 2 / 3, borderRadius: 14, overflow: 'hidden', backgroundColor: C.raised }}>
          {poster && <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />}
        </View>
        <View style={[notch, { top: -9 }]} />
        <View style={[notch, { bottom: -9 }]} />
        <View style={{ flex: 1, paddingVertical: 4, justifyContent: 'space-between' }}>
          <View>
            <Text numberOfLines={2} style={{ fontFamily: F.semibold, fontSize: 16, lineHeight: 21, color: C.text }}>{title}</Text>
            {!!score && <Text style={{ marginTop: 6, fontFamily: F.semibold, fontSize: 13, color: C.accent }}>{score}</Text>}
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              {!!sub && <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.regular, fontSize: 13, color: C.muted }}>{sub}</Text>}
              {!!badge && (
                <View style={{ paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99, backgroundColor: C.accent }}>
                  <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.onAccent }}>{badge}</Text>
                </View>
              )}
            </View>
            {pct != null && pct > 0 && <View style={{ marginTop: 10 }}><Bar pct={pct * 100} height={4} color={C.text} /></View>}
          </View>
        </View>
      </Press>
      {onWatched && <Btn kind="secondary" icon="check" label={watchedLabel || "İzledim"} onPress={onWatched} style={{ marginTop: 6 }} />}
      </View>
    </FadeIn>
  );
}

/** Sayfa başlığı: kalın + ince iki parça ve kısa açıklama */
export function PageHeader({ bold, light, sub, right }: { bold: string; light?: string; sub?: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" style={{ fontSize: 30, lineHeight: 36, color: C.text, letterSpacing: -0.8 }}>
          <Text style={{ fontFamily: F.bold }}>{bold}</Text>
          {!!light && <Text style={{ fontFamily: F.regular, color: C.muted }}>{' ' + light}</Text>}
        </Text>
        {!!sub && <Text style={{ marginTop: 6, fontFamily: F.regular, fontSize: 14.5, lineHeight: 21, color: C.muted }}>{sub}</Text>}
      </View>
      {right}
    </View>
  );
}

/** Sayfa zemini: üstte hafif aydınlık, alta doğru koyulaşan arduvaz */
export function Backdrop() {
  return (
    <LinearGradient pointerEvents="none" colors={[alpha('#3A4050', 0.55), alpha('#15171D', 0)]} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 420 }} />
  );
}

/** "Bugün ne izlesem?" aracına giriş kartı */
export function PickBanner({ style }: { style?: object }) {
  return (
    <Press accessibilityRole="button" accessibilityLabel="Bugün ne izlesem? Platformunu ve vaktini seç, tek bir öneri al." onPress={() => router.push('/pick')} scaleTo={0.98}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: R.lg, backgroundColor: C.card, overflow: 'hidden' }, style]}>
      <LinearGradient colors={[alpha(C.accent, 0.16), 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: alpha(C.accent, 0.22), alignItems: 'center', justifyContent: 'center' }}>
        <Feather name="shuffle" size={20} color={C.accentSoft} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.text }}>Bugün ne izlesem?</Text>
        <Text numberOfLines={2} style={{ marginTop: 2, fontFamily: F.regular, fontSize: 13, lineHeight: 18, color: C.muted }}>Platformunu ve vaktini seç, tek bir öneri al.</Text>
      </View>
      <Feather name="chevron-right" size={18} color={C.dim} />
    </Press>
  );
}

/** Dikey liste başlığı: solda başlık, sağda isteğe bağlı "Tümü" */
export function ListHead({ title, onMore }: { title: string; onMore?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 10, gap: 10 }}>
      <Text accessibilityRole="header" numberOfLines={1} style={{ flexShrink: 1, fontFamily: F.bold, fontSize: 19, color: C.text, letterSpacing: -0.3 }}>{title}</Text>
      {onMore && (
        <Press accessibilityRole="button" accessibilityLabel={`${title}: tümünü gör`} onPress={onMore} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 }}>
          <Text style={{ fontFamily: F.medium, fontSize: 13.5, color: C.muted }}>Tümü</Text>
          <Feather name="chevron-right" size={16} color={C.muted} />
        </Press>
      )}
    </View>
  );
}

/**
 * İzlemeye devam et: yana kayan afiş kartı. Afişin altında ince ilerleme çizgisi,
 * altında ad + durum ve küçük yuvarlak ✓ (sıradakini izledim). Afişe dokunmak yapım sayfasını açar.
 */
export function ContinueItem({ title, poster, sub, badge, pct, onPress, onWatched, watchedLabel, width, index = 0 }: {
  title: string; poster: string | null; sub?: string; badge?: string; pct?: number; onPress: () => void; onWatched?: () => void; watchedLabel: string; width: number; index?: number;
}) {
  return (
    <FadeIn index={index} from={8}>
      <View style={{ width, borderRadius: R.md, overflow: 'hidden', backgroundColor: C.card }}>
        <Press accessibilityRole="button" accessibilityLabel={[title, badge, sub].filter(Boolean).join(', ')} onPress={onPress} scaleTo={0.97}>
          <View style={{ width, aspectRatio: 2 / 3, backgroundColor: C.raised }}>
            {poster ? <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : (
              <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', padding: 10 }]}>
                <Text numberOfLines={3} style={{ fontFamily: F.bold, fontSize: 15, textAlign: 'center', color: C.muted }}>{title}</Text>
              </View>
            )}
            {!!badge && (
              <View style={{ position: 'absolute', left: 8, bottom: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99, backgroundColor: C.accent }}>
                <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.onAccent }}>{badge}</Text>
              </View>
            )}
          </View>
          <View style={{ height: 3, backgroundColor: C.line }}>
            <View style={{ width: `${Math.round(Math.max(0, Math.min(1, pct || 0)) * 100)}%`, height: '100%', backgroundColor: C.accent }} />
          </View>
          <View style={{ paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10 }}>
            <Text numberOfLines={1} style={{ fontFamily: F.semibold, fontSize: 13.5, color: C.text }}>{title}</Text>
            {!!sub && <Text numberOfLines={1} style={{ marginTop: 2, fontFamily: F.regular, fontSize: 12, color: C.muted }}>{sub}</Text>}
          </View>
        </Press>
        {onWatched && (
          <Press accessibilityRole="button" accessibilityLabel={`${title}: ${watchedLabel}`} onPress={onWatched} hitSlop={4} scaleTo={0.88}
            style={{ position: 'absolute', top: 6, right: 6, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(15,16,21,0.72)', borderWidth: 1, borderColor: alpha('#FFFFFF', 0.22), alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="check" size={18} color="#FFFFFF" />
          </Press>
        )}
      </View>
    </FadeIn>
  );
}

/** Bu hafta çıkacak bölümler/yapımlar: tarih + ad + ne çıkıyor; tek satır */
export function WeekItem({ when, title, what, soon, onPress }: { when: string; title: string; what: string; soon: boolean; onPress: () => void }) {
  return (
    <Press accessibilityRole="button" accessibilityLabel={`${when}: ${title}, ${what}`} onPress={onPress} scaleTo={0.98}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 4 }}>
      <View style={{ width: 66, paddingVertical: 5, borderRadius: 99, alignItems: 'center', backgroundColor: soon ? alpha(C.accent, 0.18) : C.card }}>
        <Text numberOfLines={1} style={{ fontFamily: F.semibold, fontSize: 12, color: soon ? C.accentSoft : C.muted }}>{when}</Text>
      </View>
      <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.medium, fontSize: 14.5, color: C.text }}>{title}</Text>
      <Text numberOfLines={1} style={{ fontFamily: F.regular, fontSize: 13, color: C.muted }}>{what}</Text>
    </Press>
  );
}
