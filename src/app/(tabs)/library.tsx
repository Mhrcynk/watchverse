import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Backdrop, PageHeader } from '@/components/home';
import { MediaCard } from '@/components/media';
import { usePreview } from '@/components/preview';
import { ShareListButton } from '@/components/share';
import { Chip, Empty, Grid, Press, Screen, Small, useLayout } from '@/components/ui';
import { TBY } from '@/lib/catalog';
import { catalogOf, libraryEntries } from '@/lib/library';
import { useStore } from '@/lib/store';
import { C, F, R } from '@/lib/theme';
import { img } from '@/lib/tmdb';

type Part = 'watching' | 'plan' | 'done';
const PARTS: [Part, string][] = [['watching', 'İzliyorum'], ['plan', 'İzleyeceğim'], ['done', 'Bitirdim']];
const EMPTY: Record<Part, [string, string]> = {
  watching: ['Şu an izlediğin bir dizi yok.', 'Bir dizinin bölümünü işaretlediğinde burada görünür.'],
  plan: ['İzleyeceklerin boş.', 'Bir yapım bulup "Kaydet"e dokun.'],
  done: ['Henüz bitirdiğin bir şey yok.', 'İzlediğin filmler ve bitirdiğin diziler burada birikir.'],
};

/** Kütüphanem: kaydedilen her şey; listeler aynı filtre satırında klasör gibi durur */
export default function Library() {
  const { state } = useStore();
  const { posterCols, pad } = useLayout();
  const { openTitle, openKey } = usePreview();
  const e = useMemo(() => libraryEntries(state), [state]);
  const lists = useMemo(() => Object.values(state.lists).sort((a, b) => b.updated - a.updated), [state.lists]);
  const first: Part = e.watching.length ? 'watching' : e.plan.length ? 'plan' : 'done';
  const [sel, setSel] = useState<string | null>(null);
  const cur = sel && (PARTS.some(([p]) => p === sel) || state.lists[sel]) ? sel : first;
  const list = state.lists[cur];

  const openEntry = (k: string) => {
    if (TBY[k]) return openTitle(TBY[k]);
    const c = catalogOf(k); if (c) return openTitle(c);
    const li = state.lib[k];
    if (li) openKey(k, { title: li.title, year: li.year, p: li.p });
  };

  return (
    <Screen>
      <Backdrop />
      <PageHeader bold="Kütüphanem" sub="Kaydettiğin her şey ve listelerin bir arada." />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -pad, marginTop: 18 }} contentContainerStyle={{ gap: 8, paddingHorizontal: pad }}>
        {PARTS.map(([p, label]) => <Chip key={p} label={`${label} · ${e[p].length}`} active={cur === p} onPress={() => setSel(p)} />)}
        {lists.length > 0 && <View style={{ width: 1, marginHorizontal: 4, backgroundColor: C.line }} />}
        {lists.map((l) => <Chip key={l.id} icon="folder" label={`${l.name} · ${l.items.length}`} active={cur === l.id} onPress={() => setSel(l.id)} />)}
        <Chip icon="plus" label="Yeni liste" onPress={() => router.push('/lists/new')} />
      </ScrollView>

      {list ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 }}>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontFamily: F.bold, fontSize: 19, color: C.text }}>{list.name}</Text>
              <Small>{list.items.length} yapım{list.share ? ' · paylaşılıyor' : ''}</Small>
            </View>
            <ShareListButton list={list} compact />
            <Press accessibilityRole="button" accessibilityLabel="Listeyi düzenle" onPress={() => router.push(`/lists/${list.id}`)} scaleTo={0.94}
              style={{ width: 46, height: 46, borderRadius: R.md, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="edit-2" size={17} color={C.text} />
            </Press>
          </View>
          <View style={{ marginTop: 16 }}>
            {list.items.length ? (
              <Grid items={list.items} cols={posterCols} gap={14} rowGap={22} keyOf={(x) => x.k}
                render={(x, cw) => <MediaCard uri={img(x.p, 'w342')} title={x.t} sub={x.y ? String(x.y) : undefined} width={cw} onPress={() => openKey(x.k, { title: x.t, year: x.y, p: x.p })} />} />
            ) : <Empty icon="folder" title="Bu liste boş." text={'Bir yapımda "Kaydet"e dokunup bu listeyi seç.'} action="Keşfet'e git" onAction={() => router.push('/explore')} />}
          </View>
        </>
      ) : (
        <View style={{ marginTop: 20 }}>
          {e[cur as Part].length ? (
            <Grid items={e[cur as Part]} cols={posterCols} gap={14} rowGap={22} keyOf={(x) => x.key}
              render={(x, cw) => <MediaCard uri={x.poster} title={x.title} sub={x.sub} badge={x.tag} pct={cur === 'watching' ? x.pct : undefined} width={cw} onPress={() => openEntry(x.key)} />} />
          ) : <Empty icon="bookmark" title={EMPTY[cur as Part][0]} text={EMPTY[cur as Part][1]} action="Keşfet'e git" onAction={() => router.push('/explore')} />}
          {e[cur as Part].length > 0 && <Small style={{ marginTop: 20 }}>En son dokunduğun en üstte.</Small>}
        </View>
      )}
    </Screen>
  );
}
