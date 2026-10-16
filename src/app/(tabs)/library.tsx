import { VirtualPosterScreen } from '@/components/virtual-poster-screen';
import { SaveStatus } from '@/components/save-status';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { Backdrop, PageHeader } from '@/components/home';
import { MediaCard } from '@/components/media';
import { usePreview } from '@/components/preview';
import { ShareListButton } from '@/components/share';
import { Chip, Empty, Press, Small, useLayout } from '@/components/ui';
import { TBY } from '@/lib/catalog';
import { catalogOf, libraryEntries } from '@/lib/library';
import { useStore } from '@/lib/store';
import { C, F, R } from '@/lib/theme';
import { img } from '@/lib/tmdb';

type Part = 'watching' | 'plan' | 'done' | 'dropped';
const PARTS: [Part, string][] = [['watching', 'İzliyorum'], ['plan', 'İzleyeceğim'], ['done', 'Bitirdim'], ['dropped', 'Bıraktım']];
type Sort = 'recent' | 'az' | 'year';
const SORTS: [Sort, string][] = [['recent', 'Son işlem'], ['az', 'A–Z'], ['year', 'Yıl']];
const norm = (x: string) => x.toLocaleLowerCase('tr').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
const EMPTY: Record<Part, [string, string]> = {
  watching: ['Şu an izlediğin bir dizi yok.', 'Bir dizinin bölümünü işaretlediğinde burada görünür.'],
  plan: ['İzleyeceklerin boş.', 'Bir yapım bulup "Kaydet"e dokun.'],
  done: ['Henüz bitirdiğin bir şey yok.', 'İzlediğin filmler ve bitirdiğin diziler burada birikir.'],
  dropped: ['Yarıda bıraktığın bir şey yok.', 'Bir dizinin sayfasında "Bıraktım"a dokunursan burada durur.'],
};

/** Kütüphanem: kaydedilen her şey; listeler aynı filtre satırında klasör gibi durur */
export default function Library() {
  const { state } = useStore();
  const { pad } = useLayout();
  const { openTitle, openKey } = usePreview();
  const e = useMemo(() => libraryEntries(state), [state]);
  const lists = useMemo(() => Object.values(state.lists).sort((a, b) => b.updated - a.updated), [state.lists]);
  const first: Part = e.watching.length ? 'watching' : e.plan.length ? 'plan' : 'done';
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const match = (title: string) => !q.trim() || norm(title).includes(norm(q.trim()));
  const order = <T,>(arr: T[], title: (x: T) => string, year: (x: T) => number | null) =>
    sort === 'recent' ? arr : [...arr].sort((a, b) => (sort === 'az' ? title(a).localeCompare(title(b), 'tr') : (year(b) || 0) - (year(a) || 0)));
  const cur = sel && (PARTS.some(([p]) => p === sel) || state.lists[sel]) ? sel : first;
  const list = state.lists[cur];

  const listItems = list ? order(list.items.filter((x) => match(x.t)), (x) => x.t, (x) => x.y) : [];
  const partItems = list ? [] : order(e[cur as Part].filter((x) => match(x.title)), (x) => x.title, (x) => x.year);
  const noHit = !!q.trim() && (list ? list.items.length > 0 && !listItems.length : e[cur as Part].length > 0 && !partItems.length);
  const openEntry = (k: string) => {
    if (TBY[k]) return openTitle(TBY[k]);
    const c = catalogOf(k); if (c) return openTitle(c);
    const li = state.lib[k];
    if (li) openKey(k, { title: li.title, year: li.year, p: li.p });
  };

  const header = (
    <>
      <Backdrop />
      <PageHeader bold="Kütüphanem" sub="Kaydettiğin her şey ve listelerin bir arada." />
      <SaveStatus />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -pad, marginTop: 18 }} contentContainerStyle={{ gap: 8, paddingHorizontal: pad }}>
        {PARTS.filter(([p]) => p !== 'dropped' || e.dropped.length || cur === 'dropped').map(([p, label]) => <Chip key={p} label={`${label} · ${e[p].length}`} active={cur === p} onPress={() => setSel(p)} />)}
        {lists.length > 0 && <View style={{ width: 1, marginHorizontal: 4, backgroundColor: C.line }} />}
        {lists.map((l) => <Chip key={l.id} icon="folder" label={`${l.name} · ${l.items.length}`} active={cur === l.id} onPress={() => setSel(l.id)} />)}
        <Chip icon="plus" label="Yeni liste" onPress={() => router.push('/lists/new')} />
      </ScrollView>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
        <View style={{ flex: 1, height: 42, borderRadius: 14, backgroundColor: C.card, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 }}>
          <Feather name="search" size={16} color={C.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Kütüphanende ara" placeholderTextColor={C.dim} accessibilityLabel="Kütüphanende ara" returnKeyType="search"
            style={{ flex: 1, height: 42, color: C.text, fontFamily: F.regular, fontSize: 16, outlineStyle: 'none' } as never} />
          {!!q && <Press accessibilityRole="button" accessibilityLabel="Aramayı temizle" onPress={() => setQ('')} hitSlop={8}><Feather name="x" size={16} color={C.muted} /></Press>}
        </View>
        <Press accessibilityRole="button" accessibilityLabel={`Sıralama: ${SORTS.find(([k]) => k === sort)![1]}`} onPress={() => setSort(SORTS[(SORTS.findIndex(([k]) => k === sort) + 1) % SORTS.length][0])} scaleTo={0.95}
          style={{ height: 42, paddingHorizontal: 12, borderRadius: 14, backgroundColor: C.card, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Feather name="bar-chart-2" size={15} color={C.accent} style={{ transform: [{ rotate: '90deg' }] }} />
          <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.text }}>{SORTS.find(([k]) => k === sort)![1]}</Text>
        </Press>
      </View>

      {noHit && <Small style={{ marginTop: 18 }}>“{q.trim()}” için bu bölümde bir şey yok.</Small>}

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
        </>
      ) : null}
    </>
  );
  const cards = list ? listItems.map(x=>({key:x.k,title:x.t,poster:img(x.p,'w342'),sub:x.y?String(x.y):undefined,badge:undefined as string | undefined,pct:undefined as number | undefined,go:()=>openKey(x.k,{title:x.t,year:x.y,p:x.p})}))
    : partItems.map(x=>({key:x.key,title:x.title,poster:x.poster,sub:x.sub,badge:x.tag,pct:cur==='watching'?x.pct:undefined,go:()=>openEntry(x.key)}));
  return <VirtualPosterScreen items={cards} keyOf={x=>x.key} resetKey={cur} header={header}
    empty={noHit ? null : list ? <Empty icon="folder" title="Bu liste boş." text="Bir yapımda Kaydet'e dokunup bu listeyi seç." action="Keşfet'e git" onAction={()=>router.push('/explore')} /> : <Empty icon="bookmark" title={EMPTY[cur as Part][0]} text={EMPTY[cur as Part][1]} action="Keşfet'e git" onAction={()=>router.push('/explore')} />}
    render={(x,cw)=><MediaCard uri={x.poster} title={x.title} sub={x.sub} badge={x.badge} pct={x.pct} width={cw} onPress={x.go} />}
    footer={sort==='recent' && cards.length>0 ? <Small>En son dokunduğun en üstte.</Small> : null} />;
}
