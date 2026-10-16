import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from '@/lib/motion';
import { isEn } from '@/lib/i18n';
import { C, F, R, alpha } from '@/lib/theme';
import { img, type TItem } from '@/lib/tmdb';
import { usePreview, scoreText } from './preview';
import { Bar, FadeIn, Press, useLayout } from './ui';

/** Satır kartlarının ortak genişliği: telefonda ekrana 3 tam + biraz taşan kart */
export function useTileW() {
  const { tablet, width, pad } = useLayout();
  return tablet ? 158 : Math.round((width - pad * 2 - 16) / 3.25);
}

/* ---------- satır ---------- */
export function Row({ title, note, children, onMore }: { title: string; note?: string; children: ReactNode; onMore?: () => void }) {
  const { pad } = useLayout();
  return (
    <View style={{ marginTop: 26 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 10 }}>
        <Text accessibilityRole="header" numberOfLines={1} style={{ flexShrink: 1, fontSize: 19, color: C.text, letterSpacing: -0.3 }}>
          {/* ilk kelime kalın, devamı ince (çeviride metin bölünmesin diye İngilizcede tek parça) */}
          {isEn || !title.includes(' ') ? <Text style={{ fontFamily: F.bold }}>{title}</Text> : (
            <><Text style={{ fontFamily: F.bold }}>{title.split(' ')[0]}</Text><Text style={{ fontFamily: F.regular }}>{' ' + title.split(' ').slice(1).join(' ')}</Text></>
          )}
        </Text>
        {onMore ? (
          <Press accessibilityRole="button" accessibilityLabel={`${title}: tümünü gör`} onPress={onMore} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Text style={{ fontFamily: F.medium, fontSize: 13.5, color: C.muted }}>Tümü</Text>
            <Feather name="chevron-right" size={16} color={C.muted} />
          </Press>
        ) : note ? <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.dim }}>{note}</Text> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingLeft: pad, paddingRight: pad }} style={{ marginHorizontal: -pad }}>
        {children}
      </ScrollView>
    </View>
  );
}

/* ---------- afiş kartı ---------- */
export const Tile = memo(function Tile({ uri, title, width, onPress, badge, pct, score, sub, index = 0, color = C.accent }: {
  uri: string | null; title: string; width: number; onPress: () => void; badge?: string; pct?: number; score?: string | null; sub?: string; index?: number; color?: string;
}) {
  return (
    <FadeIn index={index} from={10}>
      <Press accessibilityRole="button" accessibilityLabel={[title, sub, badge, score].filter(Boolean).join(', ')} onPress={onPress} scaleTo={0.95} style={{ width }}>
        <View style={{ width, aspectRatio: 2 / 3, borderRadius: 16, overflow: 'hidden', backgroundColor: C.card }}>
          <LinearGradient colors={[alpha(color, 0.45), C.card]} style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 8 }]}>
            {!uri && <Text numberOfLines={3} style={{ fontFamily: F.bold, fontSize: 13, color: C.text }}>{title}</Text>}
          </LinearGradient>
          {uri && <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} recyclingKey={uri} />}
          {!!badge && (
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: pct ? 6 : 0, alignItems: 'center' }}>
              <View style={{ backgroundColor: C.accent, paddingHorizontal: 7, paddingVertical: 3, borderTopLeftRadius: 4, borderTopRightRadius: 4 }}>
                <Text style={{ fontFamily: F.bold, fontSize: 10.5, color: C.onAccent }}>{badge}</Text>
              </View>
            </View>
          )}
          {!!score && (
            <View style={{ position: 'absolute', right: 6, top: 6, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99, backgroundColor: C.accent }}>
              <Text style={{ fontFamily: F.bold, fontSize: 10.5, color: C.onAccent }}>{score}</Text>
            </View>
          )}
          {pct != null && pct > 0 && <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}><Bar pct={pct * 100} height={4} color={C.accent} /></View>}
        </View>
        {!!sub && <Text numberOfLines={1} style={{ marginTop: 6, fontFamily: F.medium, fontSize: 12.5, color: C.muted }}>{sub}</Text>}
      </Press>
    </FadeIn>
  );
});

/** TMDB yapımı → önizleme açan kart */
export function TItemTile({ x, width, index, badge }: { x: TItem; width: number; index?: number; badge?: string }) {
  const { open } = usePreview();
  return <Tile uri={img(x.p, 'w342')} title={x.title} width={width} index={index} badge={badge} score={scoreText(x.vote, x.votes)} onPress={() => open(x)} />;
}

/* ---------- İlk 10 ---------- */
export function Top10Tile({ x, n, width }: { x: TItem; n: number; width: number }) {
  const { open } = usePreview();
  const big = Math.round(width * 1.25);
  const stroke = { color: C.line };
  return (
    <FadeIn index={n}>
      <Press accessibilityRole="button" accessibilityLabel={`${n}. sıra: ${x.title}`} onPress={() => open(x)} scaleTo={0.95} style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <Text style={[{ fontFamily: F.heavy, fontSize: big, lineHeight: big * 1.02, letterSpacing: -big * 0.08, marginRight: -width * 0.16, zIndex: 0 }, stroke]}>{n}</Text>
        <View style={{ width, aspectRatio: 2 / 3, borderRadius: 16, overflow: 'hidden', backgroundColor: C.card, zIndex: 1 }}>
          {x.p && <Image source={{ uri: img(x.p, 'w342')! }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />}
        </View>
      </Press>
    </FadeIn>
  );
}

/* ---------- yükleniyor / boş ---------- */
export function RowLoading({ width }: { width: number }) {
  return (
    <>
      {[0, 1, 2, 3].map((i) => <View key={i} style={{ width, aspectRatio: 2 / 3, borderRadius: R.sm, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }}>{i === 0 && <ActivityIndicator color={C.dim} />}</View>)}
    </>
  );
}

/** Uzaktan yüklenen satır: veri gelince görünür, boşsa hiç çıkmaz */
export function RemoteRow({ title, load, deps = [], top10, onMore, filter, note }: { title: string; load: () => Promise<TItem[]>; deps?: unknown[]; top10?: boolean; onMore?: () => void; filter?: (x: TItem) => boolean; note?: string }) {
  const w = useTileW();
  const requestKey = JSON.stringify(deps);
  const [result, setResult] = useState<{ key: string; items: TItem[] } | null>(null);
  const items = result?.key === requestKey ? result.items : null;
  useEffect(() => {
    let alive = true;
    load().then(r => { if (alive) setResult({ key: requestKey, items: r.filter(x => x.p && (!filter || filter(x))).slice(0, top10 ? 10 : 20) }); })
      .catch(() => { if (alive) setResult({ key: requestKey, items: [] }); });
    return () => { alive = false; };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  if (items && items.length < (top10 ? 5 : 3)) return null;
  return (
    <Row title={title} onMore={onMore} note={note}>
      {items === null ? <RowLoading width={w} /> : top10 ? items.map((x, i) => <Top10Tile key={x.key} x={x} n={i + 1} width={w} />) : items.map((x, i) => <TItemTile key={x.key} x={x} width={w} index={i} />)}
    </Row>
  );
}

/* ---------- vitrin ---------- */
export type BillboardItem = { key: string; title: string; image: string | null; tags: string; score?: string | null; onInfo: () => void; actions: ReactNode };
export function Billboard({ items }: { items: BillboardItem[] }) {
  const { width, pad, tablet } = useLayout();
  const w = width - pad * 2;
  const h = Math.min(tablet ? 560 : 520, w * (tablet ? 0.62 : 1.38));
  const ref = useRef<ScrollView>(null);
  const [i, setI] = useState(0);
  const reduced = useReducedMotion();
  const touching = useRef(false);
  useEffect(() => {
    if (reduced || items.length < 2) return;
    const h2 = setInterval(() => {
      if (touching.current) return;
      setI((cur) => { const n = (cur + 1) % items.length; ref.current?.scrollTo({ x: n * w, animated: true }); return n; });
    }, 7000);
    return () => clearInterval(h2);
  }, [reduced, items.length, w]);
  if (!items.length) return null;
  return (
    <View>
      <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} snapToInterval={w} decelerationRate="fast"
        onScrollBeginDrag={() => { touching.current = true; }} onScrollEndDrag={() => { touching.current = false; }}
        onMomentumScrollEnd={(e) => setI(Math.round(e.nativeEvent.contentOffset.x / w))}
        onScroll={(e) => { const n = Math.round(e.nativeEvent.contentOffset.x / w); if (n !== i) setI(n); }} scrollEventThrottle={64}
        style={{ width: w, borderRadius: R.lg }}>
        {items.map((b) => (
          <View key={b.key} style={{ width: w, height: h, borderRadius: R.lg, overflow: 'hidden', backgroundColor: C.card }}>
            {b.image && <Image source={{ uri: b.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />}
            <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.92)']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
            <Press accessibilityRole="button" accessibilityLabel={`${b.title} ayrıntıları`} onPress={b.onInfo} scaleTo={1} style={StyleSheet.absoluteFill}><View /></Press>
            <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 18, alignItems: 'center' }}>
              <Text numberOfLines={2} style={{ fontFamily: F.heavy, fontSize: tablet ? 40 : 30, lineHeight: tablet ? 44 : 34, color: '#fff', textAlign: 'center', letterSpacing: -0.6, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 12 }}>{b.title}</Text>
              <Text numberOfLines={1} style={{ marginTop: 8, fontFamily: F.medium, fontSize: 13, color: '#E4E4EA', textAlign: 'center' }}>
                {b.tags}{b.score ? <Text style={{ color: C.amber }}>{`   ${b.score}`}</Text> : null}
              </Text>
              <View pointerEvents="box-none" style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>{b.actions}</View>
            </View>
          </View>
        ))}
      </ScrollView>
      {items.length > 1 && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 }} accessibilityLabel={`${items.length} öne çıkandan ${i + 1}.`}>
          {items.map((b, n) => <View key={b.key} style={{ width: n === i ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: n === i ? C.accent : C.line }} />)}
        </View>
      )}
    </View>
  );
}

/** Animasyonlu yukarı kayan üst çubuk arka planı (kaydırınca koyulaşır) */
export function useHeaderFade() {
  const [y] = useState(() => new Animated.Value(0));
  return { y, bg: y.interpolate({ inputRange: [0, 120], outputRange: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.92)'], extrapolate: 'clamp' }) };
}
