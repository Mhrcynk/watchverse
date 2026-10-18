import { AppState, ScrollView, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Billboard, RemoteRow, Row, Tile, TItemTile, useTileW, type BillboardItem } from '@/components/rows';
import { Coverflow, PickBanner } from '@/components/home';
import { isEn } from '@/lib/i18n';
import { mergedPopular, platformLists, popularOf, type Lists, type PlatformList } from '@/lib/platform-lists';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Btn, FadeIn, Press, Segmented, Small, tap, useLayout } from '@/components/ui';
import { TBY, TYPE_TR, UBY, daysUntil, posterPath, upcomingFor, type Upcoming } from '@/lib/catalog';
import { usePreview } from '@/components/preview';
import { loadCollections, ofKind, todays, type Collection } from '@/lib/collections';
import { useFriendsLiked } from '@/components/collections';
import { nextUp } from '@/lib/progress';
import { useStore } from '@/lib/store';
import { C, F, R, alpha } from '@/lib/theme';
import { GENRES, detail, discover, hasApi, img, keyOf, today, trendingKind, type Kind, type TItem } from '@/lib/tmdb';
import type { State } from '@/lib/types';

type Plat = 'all' | number;
const PLAT_KEY = 'watchverse:plat';

/** Seçili platformda keşif: "Hepsi" seçiliyse dizi ve filmler harmanlanır */
async function onPlatform(pid: number, kind: Kind, tv: Record<string, string | number>, movie: Record<string, string | number>) {
  const base = { with_watch_providers: pid, with_watch_monetization_types: 'flatrate' };
  const [a, b] = await Promise.all([
    kind !== 'movie' ? discover('tv', { ...base, ...tv }) : Promise.resolve([] as TItem[]),
    kind !== 'tv' ? discover('movie', { ...base, ...movie }) : Promise.resolve([] as TItem[]),
  ]);
  const out: TItem[] = [];
  for (let i = 0; i < 20; i++) { if (a[i]) out.push(a[i]); if (b[i]) out.push(b[i]); }
  return out;
}

/**
 * Keşfet akışı (arama yapılmıyorken): tür ve platform seçimi, öne çıkanlar, popüler,
 * senin için, koleksiyonlar ve yakında. Eskiden ayrı "Öneriler" sayfasındaydı.
 */
export function DiscoverFeed({ footer }: { footer?: React.ReactNode }) {
  const { state } = useStore();
  const w = useTileW();
  const api = hasApi();
  const [kind, setKind] = useState<Kind>('all');
  const [plat, setPlatRaw] = useState<Plat>('all');
  const [lists, setLists] = useState<Lists | null>(null);
  const [trend, setTrend] = useState<TItem[]>([]);
  const [colls, setColls] = useState<Collection[]>([]);
  const { openKey } = usePreview();
  useEffect(() => { if (api) loadCollections(setColls).then(setColls).catch(() => {}); }, [api]);
  const liked = useFriendsLiked();
  useEffect(() => {
    if (!api) return;
    platformLists(setLists).then((v) => v && setLists(v)).catch(() => {});
    // uygulama öne gelince de tazele
    const listener = AppState.addEventListener('change', (st) => { if (st === 'active') platformLists(setLists).catch(() => {}); });
    return () => listener.remove();
  }, [api]);
  useEffect(() => { AsyncStorage.getItem(PLAT_KEY).then((v) => { if (v && v !== 'all') setPlatRaw(Number(v)); }).catch(() => {}); }, []);
  useEffect(() => { let a = true; if (api) trendingKind(kind).then((r) => a && setTrend(r.filter((x) => x.p).slice(0, 8))).catch(() => {}); return () => { a = false; }; }, [kind, api]);
  const setPlat = (p: Plat) => { tap(); setPlatRaw(p); AsyncStorage.setItem(PLAT_KEY, String(p)).catch(() => {}); };

  const typeOk = (t: 'movie' | 'tv') => kind === 'all' || kind === t;
  const forYou = useForYou(state, kind);
  const soon = useMemo(() => upcomingFor(state.follow), [state.follow]);
  const mine = (k: string) => !!(state.watched[k] || state.episodes[k]?.length);
  const likedNow = liked.filter((x) => !mine(x.k) && (kind === 'all' || (TBY[x.k] ? (kind === 'tv') === !!TBY[x.k].episodes : x.k.startsWith(kind))));
  // Bugünün koleksiyonları; seçili türde yeterli yapımı olanlar
  const collNow = todays(colls.filter((c) => ofKind(c, kind).length >= 6), 4);
  const ps = lists?.platforms || [];
  const P = plat === 'all' ? null : ps.find((x) => x.id === plat) || null;
  const t0 = today();
  const popular = P ? popularOf(P, kind) : mergedPopular(ps, kind);
  const featured = P ? popular.filter((x) => x.p).slice(0, 8) : trend.filter((x) => typeOk(x.m));
  const genres = ['Aksiyon', 'Komedi', 'Dram', 'Bilim kurgu'].map((n) => GENRES.find((g) => g.name === n)!).filter((g) => kind === 'all' || g[kind]);

  return (
    <>
      <View style={{ marginTop: 16 }}>
        <Segmented<Kind> label="Tür" value={kind} onChange={setKind} options={[{ id: 'all', label: 'Hepsi' }, { id: 'tv', label: 'Diziler' }, { id: 'movie', label: 'Filmler' }]} />
      </View>
      {ps.length > 0 && <PlatformBar ps={ps} value={plat} onChange={setPlat} />}

      {api ? (
        featured.length > 0 && (
          <View style={{ marginTop: 22 }}>
            <SectionTitle text={P ? `${P.name} öne çıkanlar` : 'Öne çıkan yapımlar'} />
            <Coverflow key={`${plat}-${kind}`} items={featured} />
          </View>
        )
      ) : <View style={{ marginTop: 18 }}><CatalogBillboard state={state} /></View>}

      <PickBanner style={{ marginTop: 22 }} />

      {P ? (
        <>
          {popular.length >= 5 && <RemoteRow title={`${P.at} popüler`} top10 load={() => Promise.resolve(popular)} deps={[plat, kind, lists?.updated]} />}
          <RemoteRow title={`${P.at} yeni`} deps={[plat, kind]}
            load={() => onPlatform(P.id, kind, { sort_by: 'first_air_date.desc', 'first_air_date.lte': t0, 'vote_count.gte': 5 }, { sort_by: 'primary_release_date.desc', 'primary_release_date.lte': t0, 'vote_count.gte': 10 })} />
          <RemoteRow title={`${P.at} en beğenilenler`} deps={[plat, kind]}
            load={() => onPlatform(P.id, kind, { sort_by: 'vote_average.desc', 'vote_count.gte': 300 }, { sort_by: 'vote_average.desc', 'vote_count.gte': 1000 })} />
          {genres.map((g) => (
            <RemoteRow key={g.name} title={`${P.at} ${g.name.toLocaleLowerCase('tr')}`} deps={[plat, kind]}
              load={() => onPlatform(P.id, kind, { with_genres: g.tv || '', sort_by: 'popularity.desc', 'vote_count.gte': 20 }, { with_genres: g.movie || '', sort_by: 'popularity.desc', 'vote_count.gte': 50 })} />
          ))}
          <Small style={{ marginTop: 20 }}>{P.source === 'netflix' ? "Popüler listesi Netflix'in Türkiye için yayımladığı haftalık izlenme sıralamasının son 4 haftasından hazırlanır." : P.source === 'apple' ? "Apple TV+ izlenme verisi yayımlamıyor ve Türkiye kataloğu TMDB/JustWatch'ta yer almıyor. Liste, Apple'ın kendi dizi ve filmlerinin son 30 gündeki Türkçe Wikipedia görüntülenmesi ve TMDB ilgisiyle sıralanır." : `${P.name} izlenme verisi yayımlamıyor. Popüler listesi, ${P.name}'da Türkiye'de izlenebilen yapımların son 30 gündeki Türkçe Wikipedia görüntülenmesi ve TMDB/JustWatch ilgisiyle sıralanır; her gün güncellenir.`}</Small>
        </>
      ) : (
        <>
          {popular.length >= 5 && <RemoteRow title="Şu an popüler" top10 load={() => Promise.resolve(popular)} deps={[kind, lists?.updated]} note="platformlarda" />}
          {forYou.length >= 3 && <Row title="Senin için">{forYou.map((x, i) => <TItemTile key={x.key} x={x} width={w} index={i} />)}</Row>}
          {likedNow.length >= 2 && (
            <Row title="Arkadaşlarının beğendikleri" onMore={() => router.push('/friends')}>
              {likedNow.map((x, i) => <Tile key={x.k} index={i} width={w} uri={img(x.p, 'w342')} title={x.title} sub={x.who} onPress={() => openKey(x.k, { title: x.title, year: x.year, p: x.p })} />)}
            </Row>
          )}
          {collNow.slice(0, 2).map((c) => <CollectionRow key={c.id} c={c} kind={kind} w={w} />)}
          {soon.length > 0 && (
            <Row title="Yakında" onMore={() => router.push('/calendar')}>
              {soon.map((x, i) => <SoonCard key={x.k + x.date} x={x} width={Math.round(w * 1.1)} index={i} />)}
            </Row>
          )}
          {collNow.slice(2).map((c) => <CollectionRow key={c.id} c={c} kind={kind} w={w} />)}
          {api && <Btn kind="secondary" icon="layers" label="Tüm koleksiyonlar ve seçkiler" style={{ marginTop: 22, alignSelf: 'flex-start' }} onPress={() => router.push('/collections')} />}
        </>
      )}

      {footer}
      {!api && (
        <View style={{ marginTop: 30 }}>
          <Small>Keşif içeriği şu an kullanılamıyor. Daha sonra tekrar dene.</Small>
        </View>
      )}
    </>
  );
}

/** Platform seçici: logolar yan yana, seçilenin çevresinde ince halka */
function PlatformBar({ ps, value, onChange }: { ps: PlatformList[]; value: Plat; onChange: (p: Plat) => void }) {
  const { pad } = useLayout();
  const cell = (key: string, on: boolean, label: string, onPress: () => void, inner: React.ReactNode) => (
    <Press key={key} accessibilityRole="button" accessibilityState={{ selected: on }} aria-pressed={on} accessibilityLabel={label} onPress={onPress} scaleTo={0.92} style={{ alignItems: 'center', width: 64 }}>
      <View style={{ width: 54, height: 54, borderRadius: 17, padding: 2, borderWidth: 2, borderColor: on ? C.text : 'transparent' }}>
        <View style={{ flex: 1, borderRadius: 13, overflow: 'hidden', backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', opacity: on ? 1 : 0.8 }}>{inner}</View>
      </View>
      <Text numberOfLines={1} style={{ marginTop: 6, fontFamily: on ? F.semibold : F.regular, fontSize: 11.5, color: on ? C.text : C.muted }}>{label}</Text>
    </Press>
  );
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -pad, marginTop: 16 }} contentContainerStyle={{ paddingHorizontal: pad, gap: 8 }}>
      {cell('all', value === 'all', 'Tümü', () => onChange('all'), <Feather name="grid" size={20} color={C.text} />)}
      {ps.map((p) => cell(String(p.id), value === p.id, p.name, () => onChange(p.id),
        p.logo ? <Image source={{ uri: img(p.logo, 'w185')! }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.text }}>{p.name}</Text>))}
    </ScrollView>
  );
}

function SectionTitle({ text }: { text: string }) {
  const [a, ...b] = text.split(' ');
  return (
    <Text accessibilityRole="header" style={{ fontSize: 19, color: C.text, letterSpacing: -0.3, marginBottom: 14 }}>
      {isEn ? <Text style={{ fontFamily: F.bold }}>{text}</Text> : <><Text style={{ fontFamily: F.bold }}>{a}</Text><Text style={{ fontFamily: F.regular }}>{' ' + b.join(' ')}</Text></>}
    </Text>
  );
}

/* ---------- vitrin (çevrimiçi arama yokken) ---------- */
function CatalogBillboard({ state }: { state: State }) {
  const { tablet } = useLayout();
  const items: BillboardItem[] = state.follow.map((u) => nextUp(state, u)).filter(Boolean).slice(0, 5).map((t) => ({
    key: t!.id, title: t!.title, image: tablet ? (t!.tmdb?.b ? `https://image.tmdb.org/t/p/w780${t!.tmdb.b}` : null) : (t!.tmdb?.p ? `https://image.tmdb.org/t/p/w780${t!.tmdb.p}` : null),
    tags: [UBY[t!.u]?.name, TYPE_TR[t!.type], t!.year].filter(Boolean).join(' · '),
    onInfo: () => router.push(`/title/${t!.id}`),
    actions: <Btn icon="play" label="Sıradaki" style={{ minWidth: 130 }} onPress={() => router.push(`/title/${t!.id}`)} />,
  }));
  return <FadeIn><Billboard items={items} /></FadeIn>;
}

/* ---------- senin için ---------- */
function useForYou(s: State, kind: Kind) {
  const [result, setResult] = useState<{ key: string; items: TItem[] } | null>(null);
  const seeds = useMemo(() => {
    const keys: { key: string; r: number }[] = [];
    for (const [id, r] of Object.entries(s.ratings)) {
      if (r < 4) continue;
      if (id.includes(':')) keys.push({ key: id, r });
      else { const t = TBY[id]; if (t?.tmdb?.id) keys.push({ key: keyOf((t.tmdb.m || t.media) as 'movie' | 'tv', t.tmdb.id), r }); }
    }
    return keys.sort((a, b) => b.r - a.r).slice(0, 4).map((k) => k.key);
  }, [s.ratings]);
  const seedKey = seeds.join(',');
  const items = result?.key === seedKey ? result.items : [];
  useEffect(() => {
    if (!hasApi() || !seeds.length) return;
    let a = true;
    Promise.all(seeds.map((k) => { const [m, id] = k.split(':'); return detail(m as 'movie' | 'tv', Number(id)).then((d) => d.recs).catch(() => []); })).then((lists) => {
      if (!a) return;
      const seen = new Set<string>(seeds);
      const out: TItem[] = [];
      for (let i = 0; i < 16; i++) for (const l of lists) { const x = l[i]; if (x && !seen.has(x.key) && x.p) { seen.add(x.key); out.push(x); } }
      setResult({ key: seedKey, items: out });
    });
    return () => { a = false; };
  }, [seedKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return items.filter((x) => (kind === 'all' || x.m === kind) && !s.lib[x.key] && !s.watched[x.key]).slice(0, 20);
}

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
function SoonCard({ x, width, index }: { x: Upcoming; width: number; index: number }) {
  const u = UBY[x.u];
  const d = daysUntil(x.date);
  const when = d <= 0 ? 'Bugün' : d === 1 ? 'Yarın' : d < 60 ? `${d} gün` : `${Number(x.date.slice(8, 10))} ${MONTHS[Number(x.date.slice(5, 7)) - 1]} ${x.date.slice(0, 4)}`;
  const what = x.kind === 'season' ? `${x.season}. sezon başlıyor` : x.kind === 'episode' ? `S${String(x.season).padStart(2, '0')} · B${String(x.episode).padStart(2, '0')}` : x.kind === 'film' ? 'Yeni film' : 'Yeni dizi';
  const poster = posterPath(x.p, 'w342');
  const { open, openTitle } = usePreview();
  const go = () => {
    const t = x.id ? TBY[x.id] : null;
    if (t) return openTitle(t);
    const m = x.k.startsWith('tv') ? 'tv' : 'movie';
    open({ key: x.k, m, id: Number(x.k.split(':')[1]), title: x.title, orig: x.title, year: Number(x.date.slice(0, 4)) || null, date: x.date, p: x.p || null, b: null, overview: '', vote: 0, votes: 0, lang: '' });
  };
  return (
    <FadeIn index={index}>
      <Press accessibilityRole="button" accessibilityLabel={`${x.title}, ${what}, ${when}`} onPress={go} style={{ width }}>
        <View style={{ width, aspectRatio: 2 / 3, borderRadius: R.md, overflow: 'hidden', backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line }}>
          {poster ? <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : (
            <LinearGradient colors={[alpha(u.color, 0.5), C.card]} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ fontFamily: F.heavy, fontSize: width * 0.5, color: alpha('#FFFFFF', 0.12) }}>{x.title[0]}</Text>
            </LinearGradient>
          )}
          <View style={{ position: 'absolute', left: 8, top: 8, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99, backgroundColor: d <= 7 ? u.color : 'rgba(0,0,0,0.82)' }}>
            <Text style={{ fontFamily: F.bold, fontSize: 12, color: d <= 7 ? C.bg : C.text }}>{when}</Text>
          </View>
        </View>
        <Text numberOfLines={2} style={{ marginTop: 8, fontFamily: F.semibold, fontSize: 14, lineHeight: 18, color: C.text }}>{x.title}</Text>
        <Small numberOfLines={1} style={{ marginTop: 2, color: u.color }}>{what}</Small>
      </Press>
    </FadeIn>
  );
}

/** Bir koleksiyon satırı */
function CollectionRow({ c, kind, w }: { c: Collection; kind: Kind; w: number }) {
  const items = ofKind(c, kind).slice(0, 20);
  return (
    <Row title={c.title} onMore={() => router.push({ pathname: '/collection/[id]', params: { id: c.id } })}>
      {items.map((x, i) => <TItemTile key={x.key} x={x} width={w} index={i} badge={x.note && c.kind === 'award' ? x.note : undefined} />)}
    </Row>
  );
}
