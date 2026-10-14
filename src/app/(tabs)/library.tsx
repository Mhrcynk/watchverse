import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Text } from 'react-native';
import { MediaCard } from '@/components/media';
import { Backdrop, PageHeader } from '@/components/home';
import { ListCover } from '@/components/lists';
import { Row, useTileW } from '@/components/rows';
import { Press } from '@/components/ui';
import { C, F, R, alpha } from '@/lib/theme';
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
  const tw = useTileW();
  const lists = Object.values(state.lists).sort((a, b) => b.updated - a.updated);
  return (
    <Screen>
      <Backdrop />
      <PageHeader bold="Kütüphanem" sub="Evrenlerdeki ve sonradan eklediğin tüm film ve diziler bir arada." />
      <Row title="Listelerim" note={lists.length ? `${lists.length} liste` : undefined}>
        {lists.map((l) => (
          <Press key={l.id} accessibilityRole="button" accessibilityLabel={`${l.name}, ${l.items.length} yapım`} onPress={() => router.push(`/lists/${l.id}`)} scaleTo={0.95} style={{ width: tw }}>
            <ListCover l={l} size={tw} />
            <Text numberOfLines={1} style={{ marginTop: 6, fontFamily: F.semibold, fontSize: 13.5, color: C.text }}>{l.name}</Text>
            <Small>{l.items.length} yapım</Small>
          </Press>
        ))}
        <Press accessibilityRole="button" accessibilityLabel="Yeni liste oluştur" onPress={() => router.push('/lists/new')} scaleTo={0.95} style={{ width: tw }}>
          <View style={{ width: tw, height: tw * 1.5, borderRadius: R.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: C.line, backgroundColor: alpha(C.accent, 0.06), alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Feather name="plus" size={24} color={C.accentSoft} />
            <Small style={{ color: C.accentSoft }}>Yeni liste</Small>
          </View>
        </Press>
      </Row>
      <View style={{ height: 22 }} />
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
