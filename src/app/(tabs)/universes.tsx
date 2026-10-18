import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Backdrop, PageHeader } from '@/components/home';
import { UniverseTile } from '@/components/media';
import { FadeIn, Grid, Pills, Press, Screen, Small, useLayout } from '@/components/ui';
import { CATEGORIES, CATEGORY_TR, UNIVERSES } from '@/lib/catalog';
import { nextUp, universeProgress } from '@/lib/progress';
import { useStore } from '@/lib/store';
import { C, F, R } from '@/lib/theme';
import type { State, Universe } from '@/lib/types';

/** İlerleme halkası: ortasında yüzde */
function Ring({ pct, size = 56 }: { pct: number; size?: number }) {
  const sw = 5;
  const r = (size - sw) / 2;
  const len = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.line} strokeWidth={sw} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.accent} strokeWidth={sw} fill="none" strokeLinecap="round"
          strokeDasharray={`${len} ${len}`} strokeDashoffset={len * (1 - Math.max(0, Math.min(100, pct)) / 100)} />
      </Svg>
      <Text style={{ fontFamily: F.heavy, fontSize: 13, color: C.text }}>{pct}%</Text>
    </View>
  );
}

/** Takip edilen evren satırı: halka, ad, sıradaki yapım ve tek dokunuşla sıradakine geçiş */
function FollowedRow({ u, state, pct }: { u: Universe; state: State; pct: number }) {
  const n = nextUp(state, u.id);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: R.lg, backgroundColor: C.card }}>
      <Press accessibilityRole="button" accessibilityLabel={`${u.name}, yüzde ${pct}${n ? `, sıradaki ${n.trTitle || n.title}` : ''}`} onPress={() => router.push(`/universe/${u.id}`)} scaleTo={0.98}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Ring pct={pct} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontFamily: F.heavy, fontSize: 17, color: C.text }}>{u.name}</Text>
          <Text numberOfLines={1} style={{ marginTop: 3, fontFamily: F.regular, fontSize: 13, color: C.muted }}>{n ? `Sıradaki: ${n.trTitle || n.title}` : 'Hepsini izledin'}</Text>
        </View>
      </Press>
      {n && (
        <Press accessibilityRole="button" accessibilityLabel={`Sıradakini aç: ${n.trTitle || n.title}`} onPress={() => router.push(`/title/${n.id}`)} scaleTo={0.9}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="play" size={18} color={C.onAccent} />
        </Press>
      )}
    </View>
  );
}

export default function Universes() {
  const { state } = useStore();
  const { width } = useLayout();
  const [cat, setCat] = useState<string>('all');
  const cols = width >= 1100 ? 4 : width >= 680 ? 3 : 2;
  const pcts = useMemo(() => Object.fromEntries(UNIVERSES.map((u) => [u.id, universeProgress(state, u.id).pct])), [state]);
  const mine = UNIVERSES.filter((u) => state.follow.includes(u.id)).sort((a, b) => pcts[b.id] - pcts[a.id]);
  const list = UNIVERSES.filter((u) => (cat === 'all' || u.category === cat) && !state.follow.includes(u.id));
  const cats = CATEGORIES.filter((c) => UNIVERSES.some((u) => u.category === c && !state.follow.includes(u.id)));

  return (
    <Screen>
      <Backdrop />
      <PageHeader bold="Evrenler" sub="Birbirine bağlı film ve diziler, doğru sırayla." />

      {mine.length > 0 && (
        <>
          <Text accessibilityRole="header" style={{ marginTop: 24, marginBottom: 12, fontFamily: F.bold, fontSize: 19, letterSpacing: -0.3, color: C.text }}>Takip ettiklerin</Text>
          <View style={{ gap: 10 }}>
            {mine.map((u, i) => <FadeIn key={u.id} index={i}><FollowedRow u={u} state={state} pct={pcts[u.id]} /></FadeIn>)}
          </View>
        </>
      )}

      <View style={{ marginTop: 28, marginBottom: 14 }}>
        <Text accessibilityRole="header" style={{ fontFamily: F.bold, fontSize: 19, letterSpacing: -0.3, color: C.text, marginBottom: 12 }}>{mine.length ? 'Diğer evrenler' : 'Tüm evrenler'}</Text>
        <Pills value={cat} onChange={setCat} options={[{ id: 'all', label: 'Tümü' }, ...cats.map((c) => ({ id: c, label: CATEGORY_TR[c] }))]} />
      </View>
      <Grid items={list} cols={cols} gap={10} keyOf={(u) => u.id} render={(u) => <FadeIn index={list.indexOf(u)}><UniverseTile u={u} state={state} /></FadeIn>} />

      <Small style={{ marginTop: 24 }}>İlerleme, her evrenin ana rotasındaki ana hikâyeye göre hesaplanır; sıralama ilerlemeyi değiştirmez.</Small>
    </Screen>
  );
}
