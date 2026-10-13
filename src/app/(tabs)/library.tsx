import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { MediaCard } from '@/components/media';
import { Empty, Eyebrow, Grid, H1, Muted, Screen, Segmented, Small, useLayout } from '@/components/ui';
import { libraryEntries } from '@/lib/library';
import { useStore } from '@/lib/store';

type Tab = 'watching' | 'plan' | 'done';
const EMPTY: Record<Tab, [string, string]> = {
  watching: ['Şu an izlediğin bir dizi yok.', 'Bir dizinin bölümünü işaretlediğinde burada görünür.'],
  plan: ['İzleyeceklerin listesi boş.', 'Keşfet\'ten bir yapım bulup "Kütüphaneme ekle"ye dokun.'],
  done: ['Henüz bitirdiğin bir şey yok.', 'İzlediğin filmler ve bitirdiğin diziler burada birikir.'],
};

export default function Library() {
  const { state } = useStore();
  const { posterCols } = useLayout();
  const [tab, setTab] = useState<Tab>('watching');
  const e = useMemo(() => libraryEntries(state), [state]);
  const list = e[tab];
  return (
    <Screen>
      <Eyebrow>Senin listen</Eyebrow>
      <H1 style={{ marginTop: 6 }}>Kütüphanem</H1>
      <Muted style={{ marginTop: 6, marginBottom: 18 }}>Evrenlerdeki ve sonradan eklediğin tüm film ve diziler bir arada.</Muted>
      <Segmented<Tab> label="Kütüphane bölümü" value={tab} onChange={setTab}
        options={[{ id: 'watching', label: `İzliyorum · ${e.watching.length}` }, { id: 'plan', label: `İzleyeceğim · ${e.plan.length}` }, { id: 'done', label: `Bitirdim · ${e.done.length}` }]} />
      <View style={{ marginTop: 20 }}>
        {list.length ? (
          <Grid items={list} cols={posterCols} gap={14} rowGap={22} keyOf={(x) => x.key}
            render={(x, cw) => <MediaCard uri={x.poster} title={x.title} sub={x.sub} badge={x.tag} pct={tab === 'watching' ? x.pct : undefined} width={cw} onPress={() => router.push(x.route as never)} />} />
        ) : <Empty icon="bookmark" title={EMPTY[tab][0]} text={EMPTY[tab][1]} action="Keşfet'e git" onAction={() => router.push('/explore')} />}
      </View>
      {list.length > 0 && <Small style={{ marginTop: 20 }}>{list.length} yapım · en son dokunduğun en üstte</Small>}
    </Screen>
  );
}
