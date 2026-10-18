import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Backdrop, PageHeader } from '@/components/home';
import { UniverseCard } from '@/components/media';
import { Row } from '@/components/rows';
import { FadeIn, Grid, Pills, Screen, Small, useLayout } from '@/components/ui';
import { CATEGORIES, CATEGORY_TR, UNIVERSES } from '@/lib/catalog';
import { isEn } from '@/lib/i18n';
import { universeProgress } from '@/lib/progress';
import { useStore } from '@/lib/store';
import { C, F } from '@/lib/theme';

export default function Universes() {
  const { state } = useStore();
  const { width } = useLayout();
  const [cat, setCat] = useState<string>('all');
  const cols = width >= 1100 ? 3 : width >= 680 ? 2 : 1;
  const pcts = useMemo(() => Object.fromEntries(UNIVERSES.map((u) => [u.id, universeProgress(state, u.id).pct])), [state]);
  const mine = UNIVERSES.filter((u) => state.follow.includes(u.id)).sort((a, b) => pcts[b.id] - pcts[a.id]);
  const list = UNIVERSES.filter((u) => (cat === 'all' || u.category === cat) && !state.follow.includes(u.id));
  const cats = CATEGORIES.filter((c) => UNIVERSES.some((u) => u.category === c && !state.follow.includes(u.id)));
  const cw = Math.min(330, Math.round(width * 0.8));

  return (
    <Screen>
      <Backdrop />
      <PageHeader bold="Evrenler" light={isEn ? undefined : 've hikâyeler'} sub={`${UNIVERSES.length} evren: birbirine bağlı filmler ve diziler, doğru sırayla.`} />

      {mine.length > 0 && (
        <Row title="Takip ettiklerin" note={`${mine.length} evren`}>
          {mine.map((u, i) => <FadeIn key={u.id} index={i}><UniverseCard u={u} state={state} style={{ width: cw }} /></FadeIn>)}
        </Row>
      )}

      <View style={{ marginTop: 28, marginBottom: 14 }}>
        <Text accessibilityRole="header" style={{ fontSize: 19, color: C.text, letterSpacing: -0.3, marginBottom: 12 }}>
          {isEn || !mine.length ? <Text style={{ fontFamily: F.bold }}>{mine.length ? 'Diğer evrenler' : 'Tüm evrenler'}</Text> : <><Text style={{ fontFamily: F.bold }}>Diğer</Text><Text style={{ fontFamily: F.regular }}> evrenler</Text></>}
        </Text>
        <Pills value={cat} onChange={setCat} options={[{ id: 'all', label: 'Tümü' }, ...cats.map((c) => ({ id: c, label: CATEGORY_TR[c] }))]} />
      </View>
      <Grid items={list} cols={cols} gap={14} keyOf={(u) => u.id} render={(u) => <FadeIn index={list.indexOf(u)}><UniverseCard u={u} state={state} /></FadeIn>} />

      <Small style={{ marginTop: 24 }}>İlerleme, her evrenin ana rotasındaki ana hikâyeye göre hesaplanır; sıralama ilerlemeyi değiştirmez.</Small>
    </Screen>
  );
}
