import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { TItemTile } from '@/components/rows';
import { BackLink, Btn, Empty, Grid, H1, Pills, Screen, Small, useLayout, SkeletonGrid } from '@/components/ui';
import { C } from '@/lib/theme';
import { Backdrop, PageHeader } from '@/components/home';
import { GENRES, byGenre, hasApi, type Kind, type TItem } from '@/lib/tmdb';

export default function GenrePage() {
  const p = useLocalSearchParams<{ id: string; k?: string }>();
  const g = GENRES.find((x) => x.name === p.id);
  const { posterCols } = useLayout();
  const [kind, setKind] = useState<Kind>((['all', 'movie', 'tv'].includes(p.k || '') ? p.k : 'all') as Kind);
  const [items, setItems] = useState<TItem[] | null>(null);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!g || !hasApi()) return;
    let a = true; setItems(null); setPage(1);
    byGenre(g, kind, 1).then((r) => a && setItems(r.filter((x) => x.p))).catch(() => a && setItems([]));
    return () => { a = false; };
  }, [g?.name, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!g) return <Screen><Backdrop /><BackLink label="Geri" onPress={() => router.back()} /><Empty title="Kategori bulunamadı." /></Screen>;
  const more = async () => {
    setBusy(true);
    try { const r = await byGenre(g, kind, page + 1); setItems((cur) => { const have = new Set((cur || []).map((x) => x.key)); return [...(cur || []), ...r.filter((x) => x.p && !have.has(x.key))]; }); setPage(page + 1); } catch {}
    setBusy(false);
  };
  const kinds = [{ id: 'all' as Kind, label: 'Hepsi' }, ...(g.tv ? [{ id: 'tv' as Kind, label: 'Diziler' }] : []), ...(g.movie ? [{ id: 'movie' as Kind, label: 'Filmler' }] : [])];
  return (
    <Screen><Backdrop />
      <BackLink label="Geri" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <View style={{ marginBottom: 14 }}><PageHeader bold={g.name} /></View>
      {kinds.length > 2 && <Pills value={kind} onChange={setKind} options={kinds} />}
      <View style={{ marginTop: 18 }}>
        {items === null ? <SkeletonGrid rows={3} />
          : items.length ? <Grid items={items} cols={posterCols} gap={8} rowGap={10} keyOf={(x) => x.key} render={(x, cw) => <TItemTile x={x} width={cw} />} />
          : <Empty icon="film" title="Bu kategoride yapım bulunamadı." />}
      </View>
      {!!items?.length && page < 10 && <Btn kind="secondary" label={busy ? 'Yükleniyor…' : 'Daha fazla göster'} disabled={busy} style={{ marginTop: 22 }} onPress={more} />}
      <Small style={{ marginTop: 20 }}>Popülerliğe göre sıralı · kaynak: TMDB</Small>
    </Screen>
  );
}
