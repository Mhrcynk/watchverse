import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { memo, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { MediaCard, PosterCard } from '@/components/media';
import { Btn, Chip, Empty, Eyebrow, Grid, H1, Pills, Screen, SectionHead, Small, useLayout } from '@/components/ui';
import { CATALOG, CATEGORIES, CATEGORY_TR, search as searchCatalog } from '@/lib/catalog';
import { routeOf } from '@/lib/library';
import { useStore } from '@/lib/store';
import { C, F, R } from '@/lib/theme';
import { discover, hasApi, img, niceProvider, providers, search, today, trending, type TItem } from '@/lib/tmdb';

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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: R.md, paddingHorizontal: 14, borderWidth: focus ? 1.5 : StyleSheet.hairlineWidth, borderColor: focus ? C.accent : C.line }}>
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
  const [type, setType] = useState<'all' | 'movie' | 'tv'>('all');
  const [res, setRes] = useState<TItem[] | null>(null);
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
      search(query).then((r) => alive && setRes(r)).catch(() => alive && setErr(true));
    }, 350);
    return () => { alive = false; clearTimeout(h); };
  }, [query]);

  const local = useMemo(() => (query.length >= 2 ? searchCatalog(query, null).slice(0, 12) : []), [query]);
  const shown = (res || []).filter((x) => type === 'all' || x.m === type);
  const t0 = today();

  return (
    <Screen>
      <Eyebrow>Tüm film ve diziler</Eyebrow>
      <H1 style={{ marginTop: 6, marginBottom: 18 }}>Keşfet</H1>
      <SearchBox q={q} setQ={setQ} placeholder="Film ya da dizi ara" />

      {query.length >= 2 ? (
        <>
          {local.length > 0 && (
            <>
              <SectionHead title="Evrenlerde" note={`${local.length}`} />
              <Rail items={local.map((t) => ({ key: t.id, uri: t.tmdb?.p ? `https://image.tmdb.org/t/p/w342${t.tmdb.p}` : null, title: t.title, sub: `${t.year} · ${t.type === 'Film' ? 'Film' : t.type === 'Dizi' ? 'Dizi' : 'Özel yapım'}`, go: () => router.push(`/title/${t.id}`) }))} />
            </>
          )}
          <View style={{ marginTop: 22 }}>
            <Pills value={type} onChange={setType} options={[{ id: 'all' as const, label: 'Hepsi' }, { id: 'movie' as const, label: 'Filmler' }, { id: 'tv' as const, label: 'Diziler' }]} />
          </View>
          {err ? <Empty icon="wifi-off" title="Arama yapılamadı." text="İnternet bağlantını kontrol edip tekrar dene." />
            : res === null ? <View style={{ paddingVertical: 40, alignItems: 'center' }}><ActivityIndicator color={C.accentSoft} /></View>
            : shown.length ? (
              <>
                <Small style={{ marginVertical: 14 }}>{shown.length} sonuç</Small>
                <Grid items={shown} cols={posterCols} gap={14} rowGap={22} keyOf={(x) => x.key}
                  render={(x, cw) => <ResultCard x={x} width={cw} />} />
              </>
            ) : <Empty icon="search" title="Sonuç bulunamadı." text="Farklı bir yazım dene; orijinal adıyla da arayabilirsin." />}
        </>
      ) : (
        <>
          <Section title="Bu hafta popüler" load={trending} />
          <Section title="Türk dizileri" load={() => discover('tv', { with_origin_country: 'TR', sort_by: 'popularity.desc', 'vote_count.gte': 5 })} />
          <Section title="Yeni Türk filmleri" load={() => discover('movie', { with_origin_country: 'TR', sort_by: 'primary_release_date.desc', 'primary_release_date.lte': t0, 'vote_count.gte': 3 })} />
          {plats.map((p) => (
            <Section key={p.id} title={`${AT[p.name] || p.name} popüler`} load={() => discover('tv', { with_watch_providers: p.id, with_watch_monetization_types: 'flatrate', sort_by: 'popularity.desc' })} />
          ))}
          <Section title="Sinemada ve yeni filmler" load={() => discover('movie', { sort_by: 'popularity.desc', 'primary_release_date.gte': new Date(Date.now() - 75 * 864e5).toISOString().slice(0, 10), 'primary_release_date.lte': t0 })} />
          <Btn kind="secondary" icon="globe" label={`Evrenlerdeki ${CATALOG.length} yapıma göz at`} style={{ marginTop: 30, alignSelf: 'flex-start' }} onPress={() => router.push('/universes')} />
        </>
      )}
    </Screen>
  );
}

const ResultCard = memo(function ResultCard({ x, width }: { x: TItem; width: number }) {
  const { state } = useStore();
  const r = routeOf(x.key);
  const badge = r.startsWith('/title/') ? 'Evrende' : state.lib[x.key] ? 'Ekli' : undefined;
  return <MediaCard uri={img(x.p, 'w342')} title={x.title} sub={[x.year, x.m === 'movie' ? 'Film' : 'Dizi'].filter(Boolean).join(' · ')} width={width} badge={badge} onPress={() => router.push(r)} />;
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

function Section({ title, load }: { title: string; load: () => Promise<TItem[]> }) {
  const { state } = useStore();
  const [items, setItems] = useState<TItem[] | null>(null);
  useEffect(() => { let a = true; load().then((r) => a && setItems(r.filter((x) => x.p).slice(0, 20))).catch(() => a && setItems([])); return () => { a = false; }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (items && !items.length) return null;
  return (
    <>
      <SectionHead title={title} />
      {items === null ? <View style={{ height: 120, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.dim} /></View> : (
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
