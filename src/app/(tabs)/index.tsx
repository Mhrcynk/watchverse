import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UniverseCard } from '@/components/media';
import { Billboard, RemoteRow, Row, Tile, TItemTile, useTileW, type BillboardItem } from '@/components/rows';
import { Backdrop, Coverflow, Greeting, SearchPill, TicketCard } from '@/components/home';
import { isEn } from '@/lib/i18n';
import { platformLists, type Lists } from '@/lib/platform-lists';
import { Btn, FadeIn, Press, Screen, Segmented, Small, tap, useLayout } from '@/components/ui';
import { TBY, TYPE_TR, UBY, daysUntil, posterPath, posterUrl, recentlyAdded, upcomingFor, type Upcoming } from '@/lib/catalog';
import { libraryEntries, shortDate } from '@/lib/library';
import { continueWatching, episodeLabel, fraction, isDone, nextEpisode, nextUp } from '@/lib/progress';
import { useStore } from '@/lib/store';
import { C, F, R, alpha } from '@/lib/theme';
import { GENRES, byGenre, detail, hasApi, keyOf, trendingKind, type Kind, type TItem } from '@/lib/tmdb';
import type { State } from '@/lib/types';

const HOME_GENRES = ['Aksiyon', 'Komedi', 'Dram', 'Suç', 'Bilim kurgu', 'Gerilim', 'Animasyon', 'Belgesel'];

export default function Home() {
  const store = useStore();
  const { state } = store;
  const { width } = useLayout();
  const insets = useSafeAreaInsets();
  const w = useTileW();
  const api = hasApi();
  const [kind, setKind] = useState<Kind>('all');
  const [cats, setCats] = useState(false);
  const [lists, setLists] = useState<Lists | null>(null);
  const [featured, setFeatured] = useState<TItem[]>([]);
  useEffect(() => { if (api) platformLists().then(setLists).catch(() => {}); }, [api]);
  useEffect(() => { let a = true; if (api) trendingKind(kind).then((r) => a && setFeatured(r.filter((x) => x.p).slice(0, 8))).catch(() => {}); return () => { a = false; }; }, [kind, api]);

  const typeOk = (t: 'movie' | 'tv') => kind === 'all' || kind === t;
  const cont = useMemo(() => continueRow(state).filter((x) => typeOk(x.m)), [state, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const forYou = useForYou(state, kind);
  const soon = useMemo(() => upcomingFor(state.follow), [state.follow]);
  const fresh = useMemo(() => recentlyAdded().filter((t) => typeOk(t.type === 'Dizi' ? 'tv' : 'movie')).slice(0, 20), [kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const followed = state.follow.map((u) => UBY[u]).filter(Boolean);
  const genreRows = HOME_GENRES.map((n) => GENRES.find((g) => g.name === n)!).filter((g) => kind === 'all' || g[kind]);
  const tw = Math.min(340, Math.round(width * 0.82));
  // Netflix resmî İlk 10 (dizi/film seçimine göre)
  const nf = lists?.netflix;
  const nfRows = nf ? ([['tv', 'Netflix Türkiye İlk 10 · Diziler', nf.tv], ['movie', 'Netflix Türkiye İlk 10 · Filmler', nf.movie]] as const).filter(([m, , l]) => typeOk(m) && l.length >= 5) : [];
  const platRows = (lists?.platforms || []).filter((p) => p.name !== 'Netflix' || !nf).flatMap((p) =>
    (kind === 'all' ? (['tv', 'movie'] as const) : [kind as 'tv' | 'movie']).map((m) => ({ key: `${p.id}-${m}`, title: `${p.at} popüler ${m === 'tv' ? 'diziler' : 'filmler'}`, items: p[m] })).filter((r) => r.items.length >= 5));

  return (
    <Screen style={{ paddingTop: 0 }}>
      <Backdrop />
      <View style={{ paddingTop: insets.top + 18, gap: 18 }}>
        <Greeting name={state.name} sub="Bugün ne izlemek istersin?" />
        <SearchPill onFilter={api ? () => setCats(true) : undefined} />
        <Segmented<Kind> label="Tür" value={kind} onChange={setKind} options={[{ id: 'all', label: 'Hepsi' }, { id: 'tv', label: 'Diziler' }, { id: 'movie', label: 'Filmler' }]} />
      </View>

      {api ? (
        featured.length > 0 && (
          <View style={{ marginTop: 26 }}>
            <SectionTitle text="Öne çıkan yapımlar" />
            <Coverflow items={featured} />
          </View>
        )
      ) : <View style={{ marginTop: 18 }}><CatalogBillboard state={state} /></View>}

      {cont.length > 0 && (
        <Row title="İzlemeye devam et" note={cont.some((x) => x.badge === 'Yeni bölüm') ? 'yeni bölüm var' : undefined}>
          {cont.map((x, i) => <TicketCard key={x.key} index={i} width={tw} title={x.title} poster={x.poster} sub={x.sub} badge={x.badge} pct={x.pct} onPress={() => router.push(x.route as never)} />)}
        </Row>
      )}

      {nfRows.map(([m, title, l]) => <RemoteRow key={m} title={title} top10 load={() => Promise.resolve(l)} deps={[kind, nf?.week]} note={nf ? `hafta: ${shortDate(nf.week)}` : undefined} />)}

      {forYou.length >= 3 && (
        <Row title="Senin için">{forYou.map((x, i) => <TItemTile key={x.key} x={x} width={w} index={i} />)}</Row>
      )}

      {followed.length > 0 && (
        <Row title="Evrenlerin" onMore={() => router.push('/universes')}>
          {followed.map((u) => <UniverseCard key={u.id} u={u} state={state} style={{ width: Math.min(280, width * 0.72) }} />)}
        </Row>
      )}

      {platRows.slice(0, 4).map((r) => <RemoteRow key={r.key} title={r.title} load={() => Promise.resolve(r.items)} deps={[kind, lists?.updated]} />)}

      {soon.length > 0 && (
        <Row title="Yakında" note={state.follow.length ? 'evrenlerinde' : undefined}>
          {soon.map((x, i) => <SoonCard key={x.k + x.date} x={x} width={Math.round(w * 1.1)} index={i} />)}
        </Row>
      )}

      {api && genreRows.slice(0, 3).map((g) => (
        <RemoteRow key={g.name} title={g.name} deps={[kind]} load={() => byGenre(g, kind)} onMore={() => router.push({ pathname: '/genre/[id]', params: { id: g.name, k: kind } })} />
      ))}

      {platRows.slice(4).map((r) => <RemoteRow key={r.key} title={r.title} load={() => Promise.resolve(r.items)} deps={[kind, lists?.updated]} />)}

      {fresh.length > 0 && (
        <Row title="Evrenlere yeni eklenenler">{fresh.map((t, i) => <Tile key={t.id} index={i} uri={posterUrl(t)} title={t.title} width={w} color={UBY[t.u]?.color} onPress={() => router.push(`/title/${t.id}`)} />)}</Row>
      )}

      {api && genreRows.slice(3).map((g) => (
        <RemoteRow key={g.name} title={g.name} deps={[kind]} load={() => byGenre(g, kind)} onMore={() => router.push({ pathname: '/genre/[id]', params: { id: g.name, k: kind } })} />
      ))}

      {lists && <Small style={{ marginTop: 28 }}>Netflix listesi Netflix'in resmî Türkiye İlk 10 verisidir. Diğer platform listeleri, o platformda Türkiye'de izlenebilen yapımların TMDB/JustWatch popülerliğine göre sıralanır ve her gün güncellenir.</Small>}
      {!api && (
        <View style={{ marginTop: 30 }}>
          <Small>Tüm film ve dizilerde arama ve listeler, ara sunucu kurulunca açılır.</Small>
        </View>
      )}

      <CategorySheet visible={cats} kind={kind} onClose={() => setCats(false)} />
    </Screen>
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
  const go = () => (x.id ? router.push(`/title/${x.id}`) : Linking.openURL(`https://www.themoviedb.org/${x.k.startsWith('tv') ? 'tv' : 'movie'}/${x.k.split(':')[1]}`));
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
