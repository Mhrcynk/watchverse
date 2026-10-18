import { remoteSearchResults } from '@/lib/audit-logic';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { memo, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { usePreview } from '@/components/preview';
import { PersonChip } from '@/components/people';
import { Row, TItemTile } from '@/components/rows';
import { MediaCard, PosterCard } from '@/components/media';
import { Btn, Chip, Empty, Eyebrow, Grid, H1, Pills, Press, Screen, SectionHead, Small, useLayout, SkeletonGrid } from '@/components/ui';
import { Backdrop, PageHeader } from '@/components/home';
import { DiscoverFeed } from '@/components/discover-feed';
import { CATALOG, CATEGORIES, CATEGORY_TR, search as searchCatalog } from '@/lib/catalog';
import { routeOf } from '@/lib/library';
import { useStore } from '@/lib/store';
import { C, F, R, alpha } from '@/lib/theme';
import { GENRES, hasApi, searchAll, type Person, type TItem } from '@/lib/tmdb';

const PAGE = 48;

export default function Explore() {
  return hasApi() ? <Online /> : <CatalogOnly />;
}

function SearchBox({ q, setQ, placeholder }: { q: string; setQ: (v: string) => void; placeholder: string }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 18, height: 52, paddingHorizontal: 16, borderWidth: 1, borderColor: focus ? C.muted : 'transparent' }}>
      <Feather name="search" size={18} color={C.muted} />
      <TextInput value={q} onChangeText={setQ} placeholder={placeholder} placeholderTextColor={C.dim}
        accessibilityLabel={placeholder} autoCorrect={false} returnKeyType="search" clearButtonMode="while-editing"
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{ flex: 1, height: 48, color: C.text, fontFamily: F.regular, fontSize: 16 } as any} />
      {!!q && Platform.OS !== 'ios' && (
        <Pressable accessibilityRole="button" accessibilityLabel="Aramayı temizle" hitSlop={10} onPress={() => setQ('')}>
          <Feather name="x" size={18} color={C.muted} />
        </Pressable>
      )}
    </View>
  );
}

/* ---------- tüm film ve diziler (TMDB) ---------- */
function Online() {
  const { posterCols } = useLayout();
  const [q, setQ] = useState('');
  const { openTitle } = usePreview();
  const [type, setType] = useState<'all' | 'movie' | 'tv'>('all');
  const [result, setResult] = useState<{ query: string; items: TItem[]; people: (Person & { known: string })[]; error: boolean } | null>(null);
  const query = q.trim();
  const current = result?.query === query ? result : null;
  const res = current?.items ?? null;
  const people = current?.people ?? [];
  const err = current?.error ?? false;

  useEffect(() => {
    if (query.length < 2) return;
    let alive = true;
    const h = setTimeout(() => {
      searchAll(query).then((r) => {
        if (alive) setResult({ query, items: r.items, people: r.people, error: false });
      }).catch(() => { if (alive) setResult({ query, items: [], people: [], error: true }); });
    }, 350);
    return () => { alive = false; clearTimeout(h); };
  }, [query]);

  const local = useMemo(() => (query.length >= 2 ? searchCatalog(query, null).filter((t) => type === 'all' || (t.tmdb?.m || t.media) === type).slice(0, 12) : []), [query, type]);
  const shown = remoteSearchResults(res || [], local, type);

  return (
    <Screen>
      <Backdrop />
      <View style={{ marginBottom: 16 }}><PageHeader bold="Keşfet" /></View>
      <SearchBox q={q} setQ={setQ} placeholder="Film, dizi ya da kişi ara" />

      {query.length >= 2 ? (
        <>
          {local.length > 0 && (
            <>
              <SectionHead title="Evrenlerde" note={`${local.length}`} />
              <Rail items={local.map((t) => ({ key: t.id, uri: t.tmdb?.p ? `https://image.tmdb.org/t/p/w342${t.tmdb.p}` : null, title: t.title, sub: `${t.year} · ${t.type === 'Film' ? 'Film' : t.type === 'Dizi' ? 'Dizi' : 'Özel yapım'}`, go: () => openTitle(t) }))} />
            </>
          )}
          <View style={{ marginTop: 22 }}>
            <Pills value={type} onChange={setType} options={[{ id: 'all' as const, label: 'Hepsi' }, { id: 'movie' as const, label: 'Filmler' }, { id: 'tv' as const, label: 'Diziler' }]} />
          </View>
          {err ? <Empty icon="wifi-off" title="Arama yapılamadı." text="İnternet bağlantını kontrol edip tekrar dene." />
            : res === null ? <SkeletonGrid rows={2} />
            : shown.length || (type === 'all' && people.length) ? (
              <>
                {type === 'all' && people.length > 0 && (
                  <Row title="Kişiler" note={`${people.length}`}>
                    {people.map((p) => <PersonChip key={p.id} p={p} sub={p.known || p.role} />)}
                  </Row>
                )}
                <Small style={{ marginVertical: 14 }}>{shown.length} sonuç</Small>
                <Grid items={shown} cols={posterCols} gap={14} rowGap={22} keyOf={(x) => x.key}
                  render={(x, cw) => <ResultCard x={x} width={cw} />} />
              </>
            ) : local.length ? null : <Empty icon="search" title="Sonuç bulunamadı." text="Farklı bir yazım dene; orijinal adıyla da arayabilirsin." />}
        </>
      ) : (
        <DiscoverFeed footer={<CategoryStrip />} />
      )}
    </Screen>
  );
}

// Kategori simgeleri ve renk tonları (siyah zemine uyumlu)
const TONES = ['#E3262F', '#B3122E', '#8E1B4D', '#5E2A84', '#2E4C9A', '#14707A', '#1F7A4A', '#8A6A12', '#A6461A', '#6B6B78'];
const GICON: Record<string, React.ComponentProps<typeof Feather>['name']> = {
  Aksiyon: 'zap', Komedi: 'smile', Dram: 'droplet', Suç: 'shield', 'Bilim kurgu': 'cpu', Gerilim: 'activity', Gizem: 'help-circle', Korku: 'moon',
  Romantik: 'heart', Fantastik: 'star', Macera: 'compass', Animasyon: 'pen-tool', Aile: 'users', Belgesel: 'video', Savaş: 'crosshair', Tarih: 'clock',
};

/** Kategoriler: iki sütunlu renkli kutular (geniş ekranda dört sütun) */
function CategoryStrip() {
  const { width } = useLayout();
  const cols = width >= 680 ? 4 : 2;
  return (
    <>
      <Text accessibilityRole="header" style={{ marginTop: 28, marginBottom: 12, fontFamily: F.bold, fontSize: 19, letterSpacing: -0.3, color: C.text }}>Kategoriler</Text>
      <Grid items={GENRES as unknown as (typeof GENRES)[number][]} cols={cols} gap={10} keyOf={(g) => g.name} render={(g) => {
        const tone = TONES[GENRES.indexOf(g) % TONES.length];
        return (
          <Press accessibilityRole="button" accessibilityLabel={`${g.name} kategorisi`} onPress={() => router.push({ pathname: '/genre/[id]', params: { id: g.name } })} scaleTo={0.96}
            style={{ height: 62, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: R.md, backgroundColor: alpha(tone, 0.32), overflow: 'hidden' }}>
            <Feather name={GICON[g.name] || 'film'} size={17} color="#F1F1F4" />
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.bold, fontSize: 15, color: C.text }}>{g.name}</Text>
          </Press>
        );
      }} />
    </>
  );
}

const ResultCard = memo(function ResultCard({ x, width }: { x: TItem; width: number }) {
  const { state } = useStore();
  const r = routeOf(x.key);
  const badge = r.startsWith('/title/') ? 'Evrende' : state.lib[x.key] ? 'Listende' : undefined;
  return <TItemTile x={x} width={width} badge={badge} />;
});

type RailItem = { key: string; uri: string | null; title: string; sub: string; go: () => void; badge?: string };
function Rail({ items }: { items: RailItem[] }) {
  const { tablet, pad, width } = useLayout();
  const w = tablet ? 150 : Math.min(132, (width - pad * 2 - 24) / 2.6);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }} style={{ marginHorizontal: -pad }}>
      <View style={{ width: pad - 14 }} />
      {items.map((x, i) => <MediaCard key={x.key} index={i} uri={x.uri} title={x.title} sub={x.sub} badge={x.badge} width={w} onPress={x.go} />)}
      <View style={{ width: pad - 14 }} />
    </ScrollView>
  );
}

/* ---------- ara sunucu kurulmadıysa: yalnızca evren kataloğu ---------- */
function CatalogOnly() {
  const { posterCols } = useLayout();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('all');
  const [type, setType] = useState<'all' | 'Film' | 'Dizi' | 'Special'>('all');
  const [limit, setLimit] = useState(PAGE);
  const dq = useDeferredValue(q);
  const found = useMemo(() => searchCatalog(dq, cat === 'all' ? null : cat).filter((t) => type === 'all' || t.type === type)
    .sort((a, b) => (dq ? 0 : b.release - a.release)), [dq, cat, type]);
  return (
    <Screen>
      <Eyebrow>Yeni bir dünya</Eyebrow>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, marginBottom: 18, gap: 12 }}>
        <H1>Keşfet</H1>
        <Chip label={`${CATALOG.length} yapım`} />
      </View>
      <SearchBox q={q} setQ={(v) => { setQ(v); setLimit(PAGE); }} placeholder="Film, dizi ya da evren ara" />
      <View style={{ marginTop: 14, gap: 10 }}>
        <Pills value={cat} onChange={(v) => { setCat(v); setLimit(PAGE); }} options={[{ id: 'all', label: 'Tüm türler' }, ...CATEGORIES.map((c) => ({ id: c, label: CATEGORY_TR[c] }))]} />
        <Pills value={type} onChange={(v) => { setType(v); setLimit(PAGE); }} options={[{ id: 'all' as const, label: 'Hepsi' }, { id: 'Film' as const, label: 'Filmler' }, { id: 'Dizi' as const, label: 'Diziler' }, { id: 'Special' as const, label: 'Özel yapımlar' }]} />
      </View>
      <Small style={{ marginVertical: 16 }}>{found.length.toLocaleString('tr-TR')} yapım{!dq ? ' · en yeniden eskiye' : ''}</Small>
      {found.length ? (
        <Grid items={found.slice(0, limit)} cols={posterCols} gap={14} rowGap={22} keyOf={(t) => t.id} render={(t, cw) => <PosterCard t={t} width={cw} />} />
      ) : <Empty icon="search" title="Aramana uygun yapım bulunamadı." text="Farklı bir yazım dene ya da tür filtresini kaldır." />}
      {found.length > limit && <Btn kind="secondary" label="Daha fazla göster" style={{ marginTop: 24 }} onPress={() => setLimit((l) => l + PAGE)} />}
      <Small style={{ marginTop: 24 }}>Çevrimiçi arama şu an kullanılamıyor. Evren kataloğunda aramaya devam edebilirsin.</Small>
    </Screen>
  );
}
