import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UniverseCard } from '@/components/media';
import { Billboard, RemoteRow, Row, Tile, TItemTile, useTileW, type BillboardItem } from '@/components/rows';
import { Backdrop, Coverflow, Greeting, SearchPill, TicketCard } from '@/components/home';
import { isEn } from '@/lib/i18n';
import { mergedPopular, platformLists, popularOf, type Lists, type PlatformList } from '@/lib/platform-lists';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Btn, FadeIn, Press, Screen, Segmented, Small, tap, useLayout } from '@/components/ui';
import { TBY, TYPE_TR, UBY, daysUntil, posterPath, posterUrl, upcomingFor, type Upcoming } from '@/lib/catalog';
import { usePreview } from '@/components/preview';
import { StarterCard } from '@/components/starter';
import { useAccount } from '@/lib/account';
import { loadCollections, ofKind, todays, type Collection } from '@/lib/collections';
import { friendFeed } from '@/lib/friends';
import { libraryEntries } from '@/lib/library';
import { continueWatching, episodeLabel, fraction, isDone, nextEpisode, nextUp } from '@/lib/progress';
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

export default function Home() {
  const store = useStore();
  const { state } = store;
  const { width } = useLayout();
  const insets = useSafeAreaInsets();
  const w = useTileW();
  const api = hasApi();
  const [kind, setKind] = useState<Kind>('all');
  const [plat, setPlatRaw] = useState<Plat>('all');
  const [cats, setCats] = useState(false);
  const [lists, setLists] = useState<Lists | null>(null);
  const [trend, setTrend] = useState<TItem[]>([]);
  const [colls, setColls] = useState<Collection[]>([]);
  const [liked, setLiked] = useState<{ k: string; title: string; p: string | null; year: number | null; who: string }[]>([]);
  const acc = useAccount();
  const { openKey } = usePreview();
  useEffect(() => { if (api) loadCollections(setColls).then(setColls).catch(() => {}); }, [api]);
  // Arkadaşlarının 4-5 yıldız verdikleri (senin izlemediklerin)
  useEffect(() => {
    if (!acc.user) { setLiked([]); return; }
    friendFeed().then((fs) => {
      const seen = new Set<string>();
      const out: typeof liked = [];
      for (const f of fs) for (const x of f.items) {
        if ((x.r || 0) < 4 || seen.has(x.k)) continue;
        seen.add(x.k);
        out.push({ k: x.k, title: TBY[x.k]?.trTitle || TBY[x.k]?.title || x.t || '', p: TBY[x.k]?.tmdb?.p || x.p, year: TBY[x.k]?.year || (x.y ? Number(x.y) : null), who: f.name || 'Arkadaşın' });
      }
      setLiked(out.filter((x) => x.title).slice(0, 20));
    }).catch(() => {});
  }, [acc.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!api) return;
    platformLists(setLists).then((v) => v && setLists(v)).catch(() => {});
    // uygulama öne gelince de tazele
    const onVis = () => { if (typeof document !== 'undefined' && document.visibilityState === 'visible') platformLists(setLists).catch(() => {}); };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
    return () => { if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis); };
  }, [api]);
  useEffect(() => { AsyncStorage.getItem(PLAT_KEY).then((v) => { if (v && v !== 'all') setPlatRaw(Number(v)); }).catch(() => {}); }, []);
  useEffect(() => { let a = true; if (api) trendingKind(kind).then((r) => a && setTrend(r.filter((x) => x.p).slice(0, 8))).catch(() => {}); return () => { a = false; }; }, [kind, api]);
  const setPlat = (p: Plat) => { tap(); setPlatRaw(p); AsyncStorage.setItem(PLAT_KEY, String(p)).catch(() => {}); };

  const typeOk = (t: 'movie' | 'tv') => kind === 'all' || kind === t;
  const cont = useMemo(() => continueRow(state).filter((x) => typeOk(x.m)), [state, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const forYou = useForYou(state, kind);
  const soon = useMemo(() => upcomingFor(state.follow), [state.follow]);
  const followed = state.follow.map((u) => UBY[u]).filter(Boolean);
  const mine = (k: string) => !!(state.watched[k] || state.episodes[k]?.length);
  const likedNow = liked.filter((x) => !mine(x.k) && (kind === 'all' || (TBY[x.k] ? (kind === 'tv') === !!TBY[x.k].episodes : x.k.startsWith(kind))));
  // Bugünün koleksiyonları; seçili türde yeterli yapımı olanlar
  const collNow = todays(colls.filter((c) => ofKind(c, kind).length >= 6), 4);
  const tw = Math.min(340, Math.round(width * 0.82));
  const ps = lists?.platforms || [];
  const P = plat === 'all' ? null : ps.find((x) => x.id === plat) || null;
  const t0 = today();
  const popular = P ? popularOf(P, kind) : mergedPopular(ps, kind);
  const featured = P ? popular.filter((x) => x.p).slice(0, 8) : trend;
  const genres = ['Aksiyon', 'Komedi', 'Dram', 'Bilim kurgu'].map((n) => GENRES.find((g) => g.name === n)!).filter((g) => kind === 'all' || g[kind]);

  return (
    <Screen style={{ paddingTop: 0 }}>
      <Backdrop />
      <View style={{ paddingTop: insets.top + 18, gap: 18 }}>
        <Greeting name={state.name} sub="Bugün ne izlemek istersin?" />
        <SearchPill onFilter={api ? () => setCats(true) : undefined} />
        <Segmented<Kind> label="Tür" value={kind} onChange={setKind} options={[{ id: 'all', label: 'Hepsi' }, { id: 'tv', label: 'Diziler' }, { id: 'movie', label: 'Filmler' }]} />
      </View>
      <StarterCard />
      {ps.length > 0 && <PlatformBar ps={ps} value={plat} onChange={setPlat} />}

      {api ? (
        featured.length > 0 && (
          <View style={{ marginTop: 22 }}>
            <SectionTitle text={P ? `${P.name} öne çıkanlar` : 'Öne çıkan yapımlar'} />
            <Coverflow key={`${plat}-${kind}`} items={featured} />
          </View>
        )
      ) : <View style={{ marginTop: 18 }}><CatalogBillboard state={state} /></View>}

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
        </>
      ) : (
        <>
          {cont.length > 0 && (
            <Row title="İzlemeye devam et" note={cont.some((x) => x.badge === 'Yeni bölüm') ? 'yeni bölüm var' : undefined}>
              {cont.map((x, i) => <TicketCard key={x.key} index={i} width={tw} title={x.title} poster={x.poster} sub={x.sub} badge={x.badge} pct={x.pct} onPress={() => router.push(x.route as never)} />)}
            </Row>
          )}
          {popular.length >= 5 && <RemoteRow title="Şu an popüler" top10 load={() => Promise.resolve(popular)} deps={[kind, lists?.updated]} note="platformlarda" />}
          {forYou.length >= 3 && <Row title="Senin için">{forYou.map((x, i) => <TItemTile key={x.key} x={x} width={w} index={i} />)}</Row>}
          {likedNow.length >= 2 && (
            <Row title="Arkadaşlarının beğendikleri" onMore={() => router.push('/friends')}>
              {likedNow.map((x, i) => <Tile key={x.k} index={i} width={w} uri={img(x.p, 'w342')} title={x.title} sub={x.who} onPress={() => openKey(x.k, { title: x.title, year: x.year, p: x.p })} />)}
            </Row>
          )}
          {collNow.slice(0, 2).map((c) => <CollectionRow key={c.id} c={c} kind={kind} w={w} />)}
          {followed.length > 0 && (
            <Row title="Evrenlerin" onMore={() => router.push('/universes')}>
              {followed.map((u) => <UniverseCard key={u.id} u={u} state={state} style={{ width: Math.min(280, width * 0.72) }} />)}
            </Row>
          )}
          {soon.length > 0 && (
            <Row title="Yakında" onMore={() => router.push('/calendar')}>
              {soon.map((x, i) => <SoonCard key={x.k + x.date} x={x} width={Math.round(w * 1.1)} index={i} />)}
            </Row>
          )}
          {collNow.slice(2).map((c) => <CollectionRow key={c.id} c={c} kind={kind} w={w} />)}
        </>
      )}

      {P && <Small style={{ marginTop: 28 }}>{P.source === 'netflix' ? "Popüler listesi Netflix'in Türkiye için yayımladığı haftalık izlenme sıralamasının son 4 haftasından hazırlanır." : P.source === 'apple' ? "Apple TV+ izlenme verisi yayımlamıyor ve Türkiye kataloğu TMDB/JustWatch'ta yer almıyor. Liste, Apple'ın kendi dizi ve filmlerinin son 30 gündeki Türkçe Wikipedia görüntülenmesi ve TMDB ilgisiyle sıralanır." : `${P.name} izlenme verisi yayımlamıyor. Popüler listesi, ${P.name}'da Türkiye'de izlenebilen yapımların son 30 gündeki Türkçe Wikipedia görüntülenmesi ve TMDB/JustWatch ilgisiyle sıralanır; her gün güncellenir.`}</Small>}
      {!api && (
        <View style={{ marginTop: 30 }}>
          <Small>Tüm film ve dizilerde arama ve listeler, ara sunucu kurulunca açılır.</Small>
        </View>
      )}

      <CategorySheet visible={cats} kind={kind} onClose={() => setCats(false)} />
    </Screen>
  );
}

/** Platform seçici: logolar yan yana, seçilenin çevresinde ince halka */
function PlatformBar({ ps, value, onChange }: { ps: PlatformList[]; value: Plat; onChange: (p: Plat) => void }) {
  const { pad } = useLayout();
  const cell = (key: string, on: boolean, label: string, onPress: () => void, inner: React.ReactNode) => (
    <Press key={key} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={label} onPress={onPress} scaleTo={0.92} style={{ alignItems: 'center', width: 64 }}>
      <View style={{ width: 58, height: 58, borderRadius: 18, padding: 2, borderWidth: 2, borderColor: on ? C.text : 'transparent' }}>
        <View style={{ flex: 1, borderRadius: 14, overflow: 'hidden', backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', opacity: on ? 1 : 0.75 }}>{inner}</View>
      </View>
      <Text numberOfLines={1} style={{ marginTop: 6, fontFamily: on ? F.semibold : F.regular, fontSize: 11.5, color: on ? C.text : C.dim }}>{label}</Text>
    </Press>
  );
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -pad, marginTop: 18 }} contentContainerStyle={{ paddingHorizontal: pad, gap: 8 }}>
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

/* ---------- vitrin ---------- */
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

/* ---------- izlemeye devam et ---------- */
type ContItem = { key: string; m: 'movie' | 'tv'; title: string; poster: string | null; pct?: number; badge?: string; sub?: string; route: string; at: number };
function continueRow(s: State): ContItem[] {
  const out: ContItem[] = [];
  for (const e of libraryEntries(s).watching) {
    const m = e.key.startsWith('movie:') ? 'movie' : 'tv';
    out.push({ key: e.key, m, title: e.title, poster: e.poster, pct: e.pct, badge: e.tag, sub: e.sub, route: e.route, at: (e.tag ? 1e15 : 0) + e.touched });
  }
  const have = new Set(out.map((x) => x.key));
  for (const t of continueWatching(s)) if (!have.has(t.id)) { const n = nextEpisode(s, t); out.push({ key: t.id, m: 'tv', title: t.title, poster: posterUrl(t), pct: fraction(s, t), sub: n ? `Sıradaki ${episodeLabel(t, n)}` : undefined, route: `/title/${t.id}`, at: s.touched[t.id] || 0 }); have.add(t.id); }
  for (const u of s.follow) {
    const t = nextUp(s, u);
    if (t && !have.has(t.id) && !isDone(s, t)) { out.push({ key: t.id, m: t.type === 'Dizi' ? 'tv' : 'movie', title: t.title, poster: posterUrl(t), badge: 'Sıradaki', sub: UBY[t.u]?.name, route: `/title/${t.id}`, at: 0 }); have.add(t.id); }
  }
  return out.sort((a, b) => b.at - a.at).slice(0, 20);
}

/* ---------- senin için ---------- */
function useForYou(s: State, kind: Kind) {
  const [items, setItems] = useState<TItem[]>([]);
  const seeds = useMemo(() => {
    const keys: { key: string; r: number }[] = [];
    for (const [id, r] of Object.entries(s.ratings)) {
      if (r < 4) continue;
      if (id.includes(':')) keys.push({ key: id, r });
      else { const t = TBY[id]; if (t?.tmdb?.id) keys.push({ key: keyOf((t.tmdb.m || t.media) as 'movie' | 'tv', t.tmdb.id), r }); }
    }
    return keys.sort((a, b) => b.r - a.r).slice(0, 4).map((k) => k.key);
  }, [s.ratings]);
  useEffect(() => {
    if (!hasApi() || !seeds.length) { setItems([]); return; }
    let a = true;
    Promise.all(seeds.map((k) => { const [m, id] = k.split(':'); return detail(m as 'movie' | 'tv', Number(id)).then((d) => d.recs).catch(() => []); })).then((lists) => {
      if (!a) return;
      const seen = new Set<string>(seeds);
      const out: TItem[] = [];
      for (let i = 0; i < 16; i++) for (const l of lists) { const x = l[i]; if (x && !seen.has(x.key) && x.p) { seen.add(x.key); out.push(x); } }
      setItems(out);
    });
    return () => { a = false; };
  }, [seeds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  return items.filter((x) => (kind === 'all' || x.m === kind) && !s.lib[x.key] && !s.watched[x.key]).slice(0, 20);
}

/* ---------- kategoriler ---------- */
function CategorySheet({ visible, kind, onClose }: { visible: boolean; kind: Kind; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const list = GENRES.filter((g) => kind === 'all' || g[kind]);
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.94)' }}>
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 50, paddingBottom: 140, alignItems: 'center', gap: 4 }}>
          <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.muted, marginBottom: 14 }}>{kind === 'tv' ? 'Dizi kategorileri' : kind === 'movie' ? 'Film kategorileri' : 'Kategoriler'}</Text>
          {list.map((g) => (
            <Pressable key={g.name} accessibilityRole="button" onPress={() => { onClose(); router.push({ pathname: '/genre/[id]', params: { id: g.name, k: kind } }); }}
              style={({ pressed }) => ({ paddingVertical: 12, paddingHorizontal: 30, opacity: pressed ? 0.6 : 1 })}>
              <Text style={{ fontFamily: F.semibold, fontSize: 20, color: '#D6D6DC' }}>{g.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={{ position: 'absolute', bottom: insets.bottom + 30, left: 0, right: 0, alignItems: 'center' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Kapat" onPress={onClose} style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: C.text, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="x" size={26} color={C.bg} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
function SoonCard({ x, width, index }: { x: Upcoming; width: number; index: number }) {
  const u = UBY[x.u];
  const d = daysUntil(x.date);
  const when = d <= 0 ? 'Bugün' : d === 1 ? 'Yarın' : d < 60 ? `${d} gün` : `${Number(x.date.slice(8, 10))} ${MONTHS[Number(x.date.slice(5, 7)) - 1]} ${x.date.slice(0, 4)}`;
  const what = x.kind === 'season' ? `${x.season}. sezon başlıyor` : x.kind === 'episode' ? `S${String(x.season).padStart(2, '0')} · B${String(x.episode).padStart(2, '0')}` : x.kind === 'film' ? 'Yeni film' : 'Yeni dizi';
  const img = posterPath(x.p, 'w342');
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
          {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : (
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

/** Ana sayfada bir koleksiyon satırı */
function CollectionRow({ c, kind, w }: { c: Collection; kind: Kind; w: number }) {
  const items = ofKind(c, kind).slice(0, 20);
  return (
    <Row title={c.title} onMore={() => router.push({ pathname: '/collection/[id]', params: { id: c.id } })}>
      {items.map((x, i) => <TItemTile key={x.key} x={x} width={w} index={i} badge={x.note && c.kind === 'award' ? x.note : undefined} />)}
    </Row>
  );
}
