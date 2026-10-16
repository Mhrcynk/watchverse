import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { CollectionCard, useFriendsLiked } from '@/components/collections';
import { Backdrop, PageHeader } from '@/components/home';
import { usePreview } from '@/components/preview';
import { Row, Tile, useTileW } from '@/components/rows';
import { Empty, FadeIn, Grid, Screen, Small, useLayout } from '@/components/ui';
import { isEn } from '@/lib/i18n';
import { loadCollections, type Collection } from '@/lib/collections';
import { useStore } from '@/lib/store';
import { C, F, R } from '@/lib/theme';
import { hasApi, img } from '@/lib/tmdb';

/** Koleksiyonlar sekmesi: ödüllüler ve seçkiler, evrenler sayfasıyla aynı düzende */
export default function Collections() {
  const { state } = useStore();
  const { width } = useLayout();
  const { openKey } = usePreview();
  const w = useTileW();
  const api = hasApi();
  const [all, setAll] = useState<Collection[] | null>(api ? null : []);
  useEffect(() => { if (api) loadCollections(setAll).then(setAll).catch(() => setAll([])); }, [api]);
  const liked = useFriendsLiked().filter((x) => !state.watched[x.k] && !state.episodes[x.k]?.length);
  const cols = width >= 1100 ? 3 : width >= 680 ? 2 : 1;
  const awards = (all || []).filter((c) => c.kind === 'award');
  const picks = (all || []).filter((c) => c.kind !== 'award');

  const section = (title: string, list: Collection[], start = 0) => list.length > 0 && (
    <>
      <Text accessibilityRole="header" style={{ marginTop: 28, marginBottom: 12, fontFamily: F.bold, fontSize: 19, letterSpacing: -0.3, color: C.text }}>{title}</Text>
      <Grid items={list} cols={cols} gap={14} keyOf={(c) => c.id} render={(c) => <FadeIn index={start + list.indexOf(c)}><CollectionCard c={c} state={state} /></FadeIn>} />
    </>
  );

  return (
    <Screen>
      <Backdrop />
      <PageHeader bold="Koleksiyonlar" light={isEn ? undefined : 've seçkiler'} sub="Ödüllü yapımlar, klasikler ve kısa diziler. Her gün güncellenir." />

      {liked.length >= 2 && (
        <Row title="Arkadaşlarının beğendikleri" note="4-5 yıldız" onMore={() => router.push('/friends')}>
          {liked.map((x, i) => <Tile key={x.k} index={i} width={w} uri={img(x.p, 'w342')} title={x.title} sub={x.who} onPress={() => openKey(x.k, { title: x.title, year: x.year, p: x.p })} />)}
        </Row>
      )}

      {all === null ? (
        <View style={{ marginTop: 28, flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          {Array.from({ length: cols * 2 }, (_, i) => (
            <View key={i} accessibilityLabel={i ? undefined : 'Yükleniyor'} style={{ width: `${(100 - (cols - 1) * 3) / cols}%` as `${number}%`, aspectRatio: 16 / 10, borderRadius: R.lg, backgroundColor: C.card }} />
          ))}
        </View>
      ) : !all.length ? (
        <Empty icon="layers" title={api ? 'Koleksiyonlar şu an yüklenemedi.' : 'Koleksiyonlar ara sunucu kurulunca açılır.'} text={api ? 'İnternet bağlantını kontrol edip sayfayı yenile.' : undefined} />
      ) : (
        <>
          {section('Ödüllüler', awards)}
          {section('Seçkiler', picks, awards.length)}
          <Small style={{ marginTop: 24 }}>Ödül listeleri Wikidata&apos;daki resmî kayıtlardan, seçkiler TMDB verisinden hazırlanır.</Small>
        </>
      )}
    </Screen>
  );
}
