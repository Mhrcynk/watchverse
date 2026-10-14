import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { memo, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { scoreText, usePreview } from '@/components/preview';
import { PersonChip } from '@/components/people';
import { Row, TItemTile } from '@/components/rows';
import { MediaCard, PosterCard } from '@/components/media';
import { Btn, Chip, Empty, Eyebrow, Grid, H1, Pills, Press, Screen, SectionHead, Small, useLayout, SkeletonGrid } from '@/components/ui';
import { Backdrop, PageHeader, PickBanner } from '@/components/home';
import { isEn } from '@/lib/i18n';
import { CATALOG, CATEGORIES, CATEGORY_TR, search as searchCatalog } from '@/lib/catalog';
import { routeOf } from '@/lib/library';
import { useStore } from '@/lib/store';
import { C, F, R, alpha } from '@/lib/theme';
import { GENRES, discover, hasApi, img, niceProvider, providers, searchAll, today, trending, type Person, type TItem } from '@/lib/tmdb';

const PAGE = 48;
const PLATFORMS = ['Netflix', 'Disney+', 'Prime Video', 'HBO Max', 'TOD', 'Exxen', 'tabii', 'Gain', 'BluTV', 'Apple TV+'];
// Türkçe ek: "Netflix'te", "Disney+'ta"...
const AT: Record<string, string> = { Netflix: "Netflix'te", 'Disney+': "Disney+'ta", 'Prime Video': "Prime Video'da", 'HBO Max': "HBO Max'te", TOD: "TOD'da", Exxen: "Exxen'de", tabii: "tabii'de", Gain: "Gain'de", BluTV: "BluTV'de", 'Apple TV+': "Apple TV+'ta" };

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
        style={{ flex: 1, height: 48, color: C.text, fontFamily: F.regular, fontSize: 16, outlineStyle: 'none' } as any} />
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
  const [res, setRes] = useState<TItem[] | null>(null);
  const [people, setPeople] = useState<(Person & { known: string })[]>([]);
  const [err, setErr] = useState(false);
  const [plats, setPlats] = useState<{ id: number; name: string }[]>([]);
  const query = q.trim();

  useEffect(() => {
    providers().then((list) => {
      const pick: { id: number; name: string }[] = [];
      for (const name of PLATFORMS) {
        const p = list.find((x) => niceProvider(x.name) === name && !/kids|channel|with ads|standard|basic/i.test(x.name));
        if (p && !pick.some((x) => x.id === p.id)) pick.push({ id: p.id, name });
      }
      setPlats(pick);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (query.length < 2) { setRes(null); setErr(false); return; }
    let alive = true;
    const h = setTimeout(() => {
      setRes(null); setErr(false);
      searchAll(query).then((r) => { if (alive) { setRes(r.items); setPeople(r.people); } }).catch(() => alive && setErr(true));
    }, 350);
    return () => { alive = false; clearTimeout(h); };
  }, [query]);

  const local = useMemo(() => (query.length >= 2 ? searchCatalog(query, null).slice(0, 12) : []), [query]);
  const shown = (res || []).filter((x) => type === 'all' || x.m === type);
  const t0 = today();

  return (
    <Screen>
      <Backdrop />
      <View style={{ marginBottom: 18 }}><PageHeader bold="Keşfet" light={isEn ? undefined : 've bul'} sub="Tüm film ve diziler: ara, kategoriye göz at." /></View>
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
            ) : <Empty icon="search" title="Sonuç bulunamadı." text="Farklı bir yazım dene; orijinal adıyla da arayabilirsin." />}
        </>
      ) : (
        <>
          <PickBanner style={{ marginTop: 18 }} />
          <CategoryStrip />
          <PopularList />
          <Btn kind="secondary" icon="globe" label={`Evrenlerdeki ${CATALOG.length} yapıma göz at`} style={{ marginTop: 30, alignSelf: 'flex-start' }} onPress={() => router.push('/universes')} />
        </>
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

/** Kategoriler: telefonda iki sıra halinde yana kayan küçük kapsüller, geniş ekranda hepsi görünür */
function CategoryStrip() {
  const { width, pad } = useLayout();
  const wide = width >= 680;
  const pill = (g: (typeof GENRES)[number], i: number) => {
    const tone = TONES[i % TONES.length];
    return (
      <Press key={g.name} accessibilityRole="button" accessibilityLabel={`${g.name} kategorisi`} onPress={() => router.push({ pathname: '/genre/[id]', params: { id: g.name } })} scaleTo={0.95}
        style={{ height: 44, flexDirection: 'row', alignItems: 'center', gap: 9, paddingLeft: 6, paddingRight: 16, borderRadius: 22, backgroundColor: C.card }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: alpha(tone, 0.28), alignItems: 'center', justifyContent: 'center' }}>
          <Feather name={GICON[g.name] || 'film'} size={15} color="#F1F1F4" />
        </View>
        <Text style={{ fontFamily: F.semibold, fontSize: 14.5, color: C.text }}>{g.name}</Text>
      </Press>
    );
  };
  return (
    <>
      <Text accessibilityRole="header" style={{ marginTop: 26, marginBottom: 12, fontFamily: F.bold, fontSize: 18.5, color: C.text }}>Kategoriler</Text>
      {wide ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{GENRES.map(pill)}</View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -pad }} contentContainerStyle={{ paddingHorizontal: pad, gap: 8, flexDirection: 'column' }}>
          {[0, 1].map((r) => <View key={r} style={{ flexDirection: 'row', gap: 8 }}>{GENRES.map((g, i) => (i % 2 === r ? pill(g, i) : null))}</View>)}
        </ScrollView>
      )}
    </>
  );
}

const ResultCard = memo(function ResultCard({ x, width }: { x: TItem; width: number }) {
  const { state } = useStore();
  const r = routeOf(x.key);
  const badge = r.startsWith('/title/') ? 'Evrende' : state.lib[x.key] ? 'Listende' : undefined;
  return <TItemTile x={x} width={width} badge={badge} />;
});

/** Netflix aramasındaki gibi: geniş görselli popüler yapımlar listesi */
function PopularList() {
  const { open } = usePreview();
  const [items, setItems] = useState<TItem[] | null>(null);
  useEffect(() => { let a = true; trending().then((r) => a && setItems(r.filter((x) => x.b).slice(0, 12))).catch(() => a && setItems([])); return () => { a = false; }; }, []);
  if (items && !items.length) return null;
  return (
    <>
      <Text accessibilityRole="header" style={{ marginTop: 28, marginBottom: 12, fontFamily: F.bold, fontSize: 18.5, color: C.text }}>Bu hafta en çok bakılanlar</Text>
      {items === null ? <ActivityIndicator color={C.dim} /> : items.map((x) => (
        <Press key={x.key} accessibilityRole="button" accessibilityLabel={x.title} onPress={() => open(x)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, backgroundColor: C.card, borderRadius: R.sm, overflow: 'hidden' }}>
          <View style={{ width: 132, aspectRatio: 16 / 9, backgroundColor: C.raised }}>{x.b && <Image source={{ uri: img(x.b, 'w342')! }} style={StyleSheet.absoluteFill} contentFit="cover" />}</View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} style={{ fontFamily: F.semibold, fontSize: 14.5, color: C.text }}>{x.title}</Text>
            <Small style={{ marginTop: 2 }}>{[x.year, x.m === 'movie' ? 'Film' : 'Dizi', scoreText(x.vote, x.votes)].filter(Boolean).join(' · ')}</Small>
          </View>
          <Feather name="info" size={20} color={C.muted} style={{ marginRight: 14 }} />
        </Press>
      ))}
    </>
  );
}

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

function Section({ title, load }: { title: string; load: () => Promise<TItem[]> }) {
  const { state } = useStore();
  const [items, setItems] = useState<TItem[] | null>(null);
  useEffect(() => { let a = true; load().then((r) => a && setItems(r.filter((x) => x.p).slice(0, 20))).catch(() => a && setItems([])); return () => { a = false; }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (items && !items.length) return null;
  return (
    <>
      <SectionHead title={title} />
      {items === null ? <SkeletonGrid rows={1} /> : (
        <Rail items={items.map((x) => {
          const r = routeOf(x.key);
          return { key: x.key, uri: img(x.p, 'w342'), title: x.title, sub: [x.year, x.m === 'movie' ? 'Film' : 'Dizi'].filter(Boolean).join(' · '), go: () => router.push(r), badge: r.startsWith('/title/') ? 'Evrende' : state.lib[x.key] ? 'Ekli' : undefined };
        })} />
      )}
    </>
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
      <Small style={{ marginTop: 24 }}>Tüm film ve dizilerde arama, ara sunucu kurulunca açılır.</Small>
    </Screen>
  );
}

