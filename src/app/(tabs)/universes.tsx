import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { UniverseCard } from '@/components/media';
import { Chip, Eyebrow, Grid, H1, Muted, Pills, Screen, SectionHead, Small, useLayout } from '@/components/ui';
import { CATEGORIES, CATEGORY_TR, MODE_TR, UNIVERSES } from '@/lib/catalog';
import { universeProgress } from '@/lib/progress';
import { useStore } from '@/lib/store';

export default function Universes() {
  const { state } = useStore();
  const { tablet, width } = useLayout();
  const [cat, setCat] = useState<string>('all');
  const cols = width >= 1200 ? 3 : width >= 700 ? 2 : 1;
  const pcts = useMemo(() => Object.fromEntries(UNIVERSES.map((u) => [u.id, universeProgress(state, u.id).pct])), [state]);
  const list = UNIVERSES.filter((u) => cat === 'all' || u.category === cat);
  const mine = list.filter((u) => state.follow.includes(u.id));
  const rest = list.filter((u) => !state.follow.includes(u.id))
    .sort((a, b) => pcts[b.id] - pcts[a.id] || a.name.localeCompare(b.name, 'tr'));

  const grid = (arr: typeof UNIVERSES) => (
    <Grid items={arr} cols={cols} keyOf={(u) => u.id} render={(u) => <UniverseCard u={u} state={state} />} />
  );

  return (
    <Screen>
      <Eyebrow>Senin hikâyelerin</Eyebrow>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, gap: 12 }}>
        <H1>Evrenler</H1>
        <Chip label={`${state.follow.length} takip edilen`} />
      </View>
      <Muted style={{ marginTop: 6, marginBottom: 18 }}>{UNIVERSES.length} evren. Her birinde kaldığın yerden.</Muted>
      <Pills value={cat} onChange={setCat} options={[{ id: 'all', label: 'Tümü' }, ...CATEGORIES.map((c) => ({ id: c, label: CATEGORY_TR[c] }))]} />

      {mine.length > 0 && (<><SectionHead title="Takip ettiklerin" note={`${mine.length}`} />{grid(mine)}</>)}
      {rest.length > 0 && (<><SectionHead title={mine.length ? 'Diğer evrenler' : 'Tüm evrenler'} note={`${rest.length}`} />{grid(rest)}</>)}

      <Small style={{ marginTop: 24 }}>İlerleme, her evrende seçtiğin rotaya ve “{MODE_TR[state.mode]}” moduna göre hesaplanır.</Small>
    </Screen>
  );
}
