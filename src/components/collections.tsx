import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Bar, Press, Small } from '@/components/ui';
import { useAccount } from '@/lib/account';
import { TBY } from '@/lib/catalog';
import type { Collection, CItem } from '@/lib/collections';
import { friendFeed } from '@/lib/friends';
import { catalogOf } from '@/lib/library';
import { C, F, R } from '@/lib/theme';
import { img } from '@/lib/tmdb';
import type { State } from '@/lib/types';

/** Bir yapımı izlemiş ya da izlemeye başlamış mı (evren kataloğundaki karşılığıyla birlikte) */
export function seenItem(s: State, x: CItem) {
  const keys = [x.key, catalogOf(x.key)?.id].filter(Boolean) as string[];
  return keys.some((k) => !!s.watched[k] || !!s.episodes[k]?.length);
}

/** Koleksiyon kartı: evren kartlarıyla aynı düzen; arka planda ilk yapımın görseli, altta ilerleme */
export function CollectionCard({ c, state, style }: { c: Collection; state: State; style?: StyleProp<ViewStyle> }) {
  const seen = c.items.filter((x) => seenItem(state, x)).length;
  const pct = c.items.length ? Math.round((seen / c.items.length) * 100) : 0;
  const bd = c.items.find((x) => x.b)?.b;
  const ps = c.items.filter((x) => x.p).slice(0, 3);
  return (
    <Press accessibilityRole="button" accessibilityLabel={`${c.title}, ${c.items.length} yapım, ${seen} izledin`} scaleTo={0.98}
      onPress={() => router.push({ pathname: '/collection/[id]', params: { id: c.id } })}
      style={[{ borderRadius: R.lg, overflow: 'hidden', backgroundColor: C.card }, style]}>
      <View style={{ aspectRatio: 16 / 10, justifyContent: 'flex-end' }}>
        {bd ? <Image source={{ uri: img(bd, 'w780')! }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
          : <LinearGradient colors={[C.raised, C.card]} style={StyleSheet.absoluteFill} />}
        <LinearGradient colors={['rgba(21,23,29,0.15)', 'rgba(21,23,29,0.35)', 'rgba(21,23,29,0.96)']} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
        {!bd && ps.length > 0 && (
          <View style={{ position: 'absolute', top: 14, right: 14, width: 40 + (ps.length - 1) * 24, height: 60 }}>
            {ps.map((x, i) => (
              <View key={x.key} style={{ position: 'absolute', right: i * 24, width: 40, height: 60, borderRadius: 6, overflow: 'hidden', backgroundColor: C.raised, borderWidth: 1.5, borderColor: C.card, zIndex: 3 - i }}>
                <Image source={{ uri: img(x.p, 'w185')! }} style={StyleSheet.absoluteFill} contentFit="cover" />
              </View>
            ))}
          </View>
        )}
        {pct === 100 && (
          <View style={{ position: 'absolute', top: 12, right: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: C.green }}>
            <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.onAccent }}>Tamamlandı</Text>
          </View>
        )}
        <View style={{ padding: 16, paddingBottom: 14 }}>
          <Text numberOfLines={1} style={{ fontFamily: F.heavy, fontSize: 22, letterSpacing: -0.4, color: C.text }}>{c.title}</Text>
          <Small numberOfLines={1} style={{ marginTop: 3, color: '#D5D8E0' }}>{c.sub}</Small>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <Small numberOfLines={1} style={{ flex: 1, color: '#D5D8E0' }}>{seen ? `${c.items.length} yapımdan ${seen} tanesini izledin` : `${c.items.length} yapım`}</Small>
            <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.text }}>{pct}%</Text>
          </View>
          <View style={{ marginTop: 8 }}><Bar pct={pct} color={C.text} height={3} /></View>
        </View>
      </View>
    </Press>
  );
}

export type Liked = { k: string; title: string; p: string | null; year: number | null; who: string };
/** Arkadaşlarının 4-5 yıldız verdikleri */
export function useFriendsLiked() {
  const acc = useAccount();
  const [liked, setLiked] = useState<Liked[]>([]);
  useEffect(() => {
    if (!acc.user) { setLiked([]); return; }
    friendFeed().then((fs) => {
      const seen = new Set<string>();
      const out: Liked[] = [];
      for (const f of fs) for (const x of f.items) {
        if ((x.r || 0) < 4 || seen.has(x.k)) continue;
        seen.add(x.k);
        out.push({ k: x.k, title: TBY[x.k]?.trTitle || TBY[x.k]?.title || x.t || '', p: TBY[x.k]?.tmdb?.p || x.p, year: TBY[x.k]?.year || (x.y ? Number(x.y) : null), who: f.name || 'Arkadaşın' });
      }
      setLiked(out.filter((x) => x.title).slice(0, 20));
    }).catch(() => {});
  }, [acc.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return liked;
}
