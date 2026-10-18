import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { CollectionCard, CollectionRowItem, useFriendsLiked } from '@/components/collections';
import { Backdrop, PageHeader } from '@/components/home';
import { usePreview } from '@/components/preview';
import { Row, Tile, useTileW } from '@/components/rows';
import { Chip, Empty, FadeIn, Press, Screen, Small, useLayout } from '@/components/ui';
import { loadCollections, type Collection } from '@/lib/collections';
import { useStore } from '@/lib/store';
import { C, F, R } from '@/lib/theme';
import { hasApi, img } from '@/lib/tmdb';

type Filter = 'all' | 'award' | 'tmdb' | 'mine';
const FILTERS: [Filter, string][] = [['all', 'Hepsi'], ['award', 'Ödüllüler'], ['tmdb', 'Seçkiler'], ['mine', 'Listelerim']];

/** Koleksiyonlar sekmesi: haftanın seçkisi, ödüllüler ve seçkiler, kendi listelerin */
export default function Collections() {
  const { state } = useStore();
  const { width } = useLayout();
  const { openKey } = usePreview();
  const w = useTileW();
  const api = hasApi();
  const [all, setAll] = useState<Collection[] | null>(api ? null : []);
  const [filter, setFilter] = useState<Filter>('all');
  useEffect(() => { if (api) loadCollections(setAll).then(setAll).catch(() => setAll([])); }, [api]);
  const liked = useFriendsLiked().filter((x) => !state.watched[x.k] && !state.episodes[x.k]?.length);
  const lists = useMemo(() => Object.values(state.lists).sort((a, b) => b.updated - a.updated), [state.lists]);
  // Haftanın seçkisi: her hafta sıradaki koleksiyon
  const [weekNo] = useState(() => Math.floor(Date.now() / (7 * 864e5)));
  const week = all?.length ? all[weekNo % all.length] : null;
  const shown = (all || []).filter((c) => (filter === 'all' || c.kind === filter) && c.id !== week?.id);
  const featuredW = Math.min(width - 32, 560);

  return (
    <Screen>
      <Backdrop />
      <PageHeader bold="Koleksiyonlar" sub="Seçkiler her gün yenilenir." />

      {week && filter === 'all' && (
        <FadeIn>
          <View style={{ marginTop: 20, width: '100%', maxWidth: featuredW }}>
            <View style={{ position: 'absolute', zIndex: 2, left: 14, top: 14, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: C.accent }}>
              <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.onAccent }}>Haftanın seçkisi</Text>
            </View>
            <CollectionCard c={week} state={state} />
          </View>
        </FadeIn>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>
        {FILTERS.map(([id, label]) => <Chip key={id} label={label} active={filter === id} onPress={() => setFilter(id)} />)}
      </View>

      {filter === 'mine' ? (
        <View style={{ marginTop: 16, gap: 10 }}>
          {lists.map((l) => (
            <Press key={l.id} accessibilityRole="button" accessibilityLabel={`${l.name}, ${l.items.length} yapım`} onPress={() => router.push(`/lists/${l.id}`)} scaleTo={0.98}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: R.md, backgroundColor: C.card }}>
              <Feather name="folder" size={20} color={C.accentSoft} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: F.bold, fontSize: 15, color: C.text }}>{l.name}</Text>
                <Small>{l.items.length} yapım{l.share ? ' · paylaşılıyor' : ''}</Small>
              </View>
              <Feather name="chevron-right" size={18} color={C.muted} />
            </Press>
          ))}
          <Press accessibilityRole="button" onPress={() => router.push('/lists/new')} scaleTo={0.98}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: R.md, borderWidth: 1, borderStyle: 'dashed', borderColor: C.line }}>
            <Feather name="plus" size={18} color={C.text} />
            <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.text }}>Yeni liste</Text>
          </Press>
        </View>
      ) : all === null ? (
        <View style={{ marginTop: 16, gap: 10 }}>
          {Array.from({ length: 5 }, (_, i) => <View key={i} accessibilityLabel={i ? undefined : 'Yükleniyor'} style={{ height: 92, borderRadius: R.md, backgroundColor: C.card }} />)}
        </View>
      ) : !all.length ? (
        <Empty icon="layers" title={api ? 'Koleksiyonlar şu an yüklenemedi.' : 'Koleksiyonlar şu an kullanılamıyor.'} text={api ? 'İnternet bağlantını kontrol edip sayfayı yenile.' : undefined} />
      ) : (
        <View style={{ marginTop: 16, gap: 10 }}>
          {shown.map((c, i) => <FadeIn key={c.id} index={i}><CollectionRowItem c={c} state={state} /></FadeIn>)}
        </View>
      )}

      {filter === 'all' && liked.length >= 2 && (
        <Row title="Arkadaşlarının beğendikleri" note="4-5 yıldız" onMore={() => router.push('/friends')}>
          {liked.map((x, i) => <Tile key={x.k} index={i} width={w} uri={img(x.p, 'w342')} title={x.title} sub={x.who} onPress={() => openKey(x.k, { title: x.title, year: x.year, p: x.p })} />)}
        </Row>
      )}

      {filter !== 'mine' && !!all?.length && <Small style={{ marginTop: 24 }}>Ödül listeleri Wikidata&apos;daki resmî kayıtlardan, seçkiler TMDB verisinden hazırlanır.</Small>}
    </Screen>
  );
}

