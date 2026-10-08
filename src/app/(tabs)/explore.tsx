import Feather from '@expo/vector-icons/Feather';
import { useDeferredValue, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { PosterCard } from '@/components/media';
import { Btn, Chip, Empty, Eyebrow, Grid, H1, Pills, Screen, Small, useLayout } from '@/components/ui';
import { CATALOG, CATEGORIES, CATEGORY_TR, search } from '@/lib/catalog';
import { C, F, R } from '@/lib/theme';

const PAGE = 48;

export default function Explore() {
  const { posterCols } = useLayout();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('all');
  const [type, setType] = useState<'all' | 'Film' | 'Dizi' | 'Special'>('all');
  const [limit, setLimit] = useState(PAGE);
  const dq = useDeferredValue(q);
  const found = useMemo(() => search(dq, cat === 'all' ? null : cat).filter((t) => type === 'all' || t.type === type)
    .sort((a, b) => (dq ? 0 : b.release - a.release)), [dq, cat, type]);

  return (
    <Screen>
      <Eyebrow>Yeni bir dünya</Eyebrow>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, marginBottom: 18, gap: 12 }}>
        <H1>Keşfet</H1>
        <Chip label={`${CATALOG.length} yapım`} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: R.md, paddingHorizontal: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line }}>
        <Feather name="search" size={18} color={C.muted} />
        <TextInput value={q} onChangeText={(v) => { setQ(v); setLimit(PAGE); }} placeholder="Film, dizi ya da evren ara" placeholderTextColor={C.dim}
          accessibilityLabel="Film, dizi ya da evren ara" autoCorrect={false} returnKeyType="search" clearButtonMode="while-editing"
          style={{ flex: 1, height: 48, color: C.text, fontFamily: F.regular, fontSize: 16 }} />
        {!!q && Platform.OS !== 'ios' && (
          <Pressable accessibilityRole="button" accessibilityLabel="Aramayı temizle" hitSlop={10} onPress={() => { setQ(''); setLimit(PAGE); }}>
            <Feather name="x" size={18} color={C.muted} />
          </Pressable>
        )}
      </View>

      <View style={{ marginTop: 14, gap: 10 }}>
        <Pills value={cat} onChange={(v) => { setCat(v); setLimit(PAGE); }} options={[{ id: 'all', label: 'Tüm türler' }, ...CATEGORIES.map((c) => ({ id: c, label: CATEGORY_TR[c] }))]} />
        <Pills value={type} onChange={(v) => { setType(v); setLimit(PAGE); }} options={[{ id: 'all' as const, label: 'Hepsi' }, { id: 'Film' as const, label: 'Filmler' }, { id: 'Dizi' as const, label: 'Diziler' }, { id: 'Special' as const, label: 'Özel yapımlar' }]} />
      </View>

      <Small style={{ marginVertical: 16 }}>{found.length.toLocaleString('tr-TR')} yapım{!dq ? ' · en yeniden eskiye' : ''}</Small>

      {found.length ? (
        <Grid items={found.slice(0, limit)} cols={posterCols} gap={14} rowGap={22} keyOf={(t) => t.id} render={(t, cw) => <PosterCard t={t} width={cw} />} />
      ) : <Empty icon="search" title="Aramana uygun yapım bulunamadı." text="Farklı bir yazım dene ya da tür filtresini kaldır." />}
      {found.length > limit && <Btn kind="secondary" label="Daha fazla göster" style={{ marginTop: 24 }} onPress={() => setLimit((l) => l + PAGE)} />}
    </Screen>
  );
}
