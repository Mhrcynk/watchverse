import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Backdrop, PageHeader } from '@/components/home';
import { MediaCard } from '@/components/media';
import { usePreview } from '@/components/preview';
import { BackLink, Empty, Grid, Pills, Screen, Small, useLayout } from '@/components/ui';
import { loadCollections, ofKind, type Collection } from '@/lib/collections';
import { img } from '@/lib/tmdb';

/** Bir koleksiyonun tamamı */
export default function CollectionPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { open } = usePreview();
  const { posterCols } = useLayout();
  const [all, setAll] = useState<Collection[] | null>(null);
  const [kind, setKind] = useState<'all' | 'tv' | 'movie'>('all');
  useEffect(() => { loadCollections(setAll).then(setAll); }, []);
  const c = all?.find((x) => x.id === id);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/collections'));
  if (all && !c) return <Screen><BackLink label="Geri" onPress={back} /><Empty icon="layers" title="Bu koleksiyon bulunamadı." /></Screen>;
  const items = c ? ofKind(c, kind) : [];
  const mixed = c ? c.items.some((x) => x.m === 'tv') && c.items.some((x) => x.m === 'movie') : false;
  return (
    <Screen>
      <Backdrop />
      <BackLink label="Geri" onPress={back} />
      <PageHeader bold={c?.title || 'Koleksiyon'} sub={c ? `${c.sub} · ${c.items.length} yapım` : undefined} />
      {mixed && <View style={{ marginTop: 16 }}><Pills value={kind} onChange={setKind} options={[{ id: 'all', label: 'Hepsi' }, { id: 'movie', label: 'Filmler' }, { id: 'tv', label: 'Diziler' }]} /></View>}
      <View style={{ marginTop: 20 }}>
        {c ? (
          <Grid items={items} cols={posterCols} gap={14} rowGap={22} keyOf={(x) => x.key}
            render={(x, cw) => <MediaCard uri={img(x.p, 'w342')} title={x.title} sub={[x.note, x.year && x.note !== String(x.year) ? x.year : null].filter(Boolean).join(' · ') || (x.year ? String(x.year) : undefined)} width={cw} onPress={() => open(x)} />} />
        ) : <View style={{ height: 300 }} />}
      </View>
      {c && <Small style={{ marginTop: 22 }}>{c.source === 'Wikidata' ? 'Kaynak: Wikidata (resmî ödül kayıtları). Her gün güncellenir.' : 'Kaynak: TMDB. Her gün güncellenir.'}</Small>}
    </Screen>
  );
}
