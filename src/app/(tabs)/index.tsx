import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Brand } from '@/components/brand';
import { UniverseCard } from '@/components/media';
import { scoreText, usePreview } from '@/components/preview';
import { Billboard, RemoteRow, Row, Tile, TItemTile, useTileW, type BillboardItem } from '@/components/rows';
import { Btn, FadeIn, Press, Screen, Small, tap, useLayout, useToast } from '@/components/ui';
import { TBY, TYPE_TR, UBY, daysUntil, posterPath, posterUrl, recentlyAdded, upcomingFor, type Upcoming } from '@/lib/catalog';
import { catalogOf, libFromItem, libraryEntries } from '@/lib/library';
import { continueWatching, episodeLabel, fraction, isDone, nextEpisode, nextUp } from '@/lib/progress';
import { useStore } from '@/lib/store';
import { C, F, R, alpha } from '@/lib/theme';
import { GENRES, byGenre, detail, discover, hasApi, img, keyOf, platforms, today, trendingKind, type Kind, type TItem } from '@/lib/tmdb';
import type { State } from '@/lib/types';

const HOME_GENRES = ['Aksiyon', 'Komedi', 'Dram', 'Suç', 'Bilim kurgu', 'Gerilim', 'Animasyon', 'Belgesel'];

export default function Home() {
  const store = useStore();
  const { state } = store;
  const { pad, width, tablet } = useLayout();
  const insets = useSafeAreaInsets();
  const w = useTileW();
  const api = hasApi();
  const [kind, setKind] = useState<Kind>('all');
  const [cats, setCats] = useState(false);
  const [plats, setPlats] = useState<{ id: number; name: string; at: string }[]>([]);
  useEffect(() => { if (api) platforms().then(setPlats).catch(() => {}); }, [api]);

  const typeOk = (t: 'movie' | 'tv') => kind === 'all' || kind === t;
  const cont = useMemo(() => continueRow(state).filter((x) => typeOk(x.m)), [state, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const forYou = useForYou(state, kind);
  const soon = useMemo(() => upcomingFor(state.follow), [state.follow]);
  const fresh = useMemo(() => recentlyAdded().filter((t) => typeOk(t.type === 'Dizi' ? 'tv' : 'movie')).slice(0, 20), [kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const followed = state.follow.map((u) => UBY[u]).filter(Boolean);
  const progressCount = Object.keys(state.watched).length + Object.keys(state.episodes).length;
  const backupDue = progressCount >= 5 && (!state.lastBackup || Date.now() - state.lastBackup > 7 * 864e5);
  const t0 = today();
  const genreRows = HOME_GENRES.map((n) => GENRES.find((g) => g.name === n)!).filter((g) => kind === 'all' || g[kind]);

  return (
    <Screen style={{ paddingTop: 0 }}>
      {/* üst çubuk */}
      <View style={{ paddingTop: insets.top + 10, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Brand />
          <Press accessibilityRole="button" accessibilityLabel="Ara" onPress={() => router.push('/explore')} hitSlop={8} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="search" size={22} color={C.text} />
          </Press>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <KindChip label="Diziler" on={kind === 'tv'} onPress={() => setKind(kind === 'tv' ? 'all' : 'tv')} />
          <KindChip label="Filmler" on={kind === 'movie'} onPress={() => setKind(kind === 'movie' ? 'all' : 'movie')} />
          {api && <KindChip label="Kategoriler" icon="chevron-down" onPress={() => setCats(true)} />}
        </View>
      </View>

      {backupDue && (
        <Press accessibilityRole="button" onPress={() => router.push('/profile')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 14, borderRadius: R.md, backgroundColor: alpha(C.amber, 0.1), borderWidth: StyleSheet.hairlineWidth, borderColor: alpha(C.amber, 0.4) }}>
          <Feather name="shield" size={18} color={C.amber} />
          <Small style={{ flex: 1, color: C.text }}>İlerlemeni yedekle: Dosyalar'a tek dokunuşla kaydet.</Small>
          <Feather name="chevron-right" size={18} color={C.dim} />
        </Press>
      )}

      {api ? <OnlineBillboard kind={kind} /> : <CatalogBillboard state={state} />}

      {cont.length > 0 && (
        <Row title="İzlemeye devam et" note={cont.some((x) => x.badge === 'Yeni bölüm') ? 'yeni bölüm var' : undefined}>
          {cont.map((x, i) => <Tile key={x.key} index={i} uri={x.poster} title={x.title} width={w} pct={x.pct} badge={x.badge} sub={x.sub} onPress={() => router.push(x.route as never)} />)}
        </Row>
      )}

      {api && <RemoteRow title="Bu hafta en popüler 10" top10 load={() => trendingKind(kind)} deps={[kind]} />}

      {forYou.length >= 3 && (
        <Row title="Senin için">{forYou.map((x, i) => <TItemTile key={x.key} x={x} width={w} index={i} />)}</Row>
      )}

      {api && kind !== 'movie' && <RemoteRow title="Türk dizileri" load={() => discover('tv', { with_origin_country: 'TR', sort_by: 'popularity.desc', 'vote_count.gte': 5 })} deps={[kind]} />}
      {api && kind !== 'tv' && <RemoteRow title="Yeni Türk filmleri" load={() => discover('movie', { with_origin_country: 'TR', sort_by: 'primary_release_date.desc', 'primary_release_date.lte': t0, 'vote_count.gte': 3 })} deps={[kind]} />}

      {followed.length > 0 && (
        <Row title="Evrenlerin" onMore={() => router.push('/universes')}>
          {followed.map((u) => <UniverseCard key={u.id} u={u} state={state} style={{ width: Math.min(280, width * 0.72) }} />)}
        </Row>
      )}

      {api && plats.slice(0, 5).map((p) => (
        <RemoteRow key={p.id} title={`${p.at} popüler`} deps={[kind, p.id]}
          load={() => discover(kind === 'movie' ? 'movie' : 'tv', { with_watch_providers: p.id, with_watch_monetization_types: 'flatrate', sort_by: 'popularity.desc' })} />
      ))}

      {soon.length > 0 && (
        <Row title="Yakında" note={state.follow.length ? 'evrenlerinde' : undefined}>
          {soon.map((x, i) => <SoonCard key={x.k + x.date} x={x} width={Math.round(w * 1.1)} index={i} />)}
        </Row>
      )}

      {api && genreRows.slice(0, 4).map((g) => (
        <RemoteRow key={g.name} title={g.name} deps={[kind]} load={() => byGenre(g, kind)} onMore={() => router.push({ pathname: '/genre/[id]', params: { id: g.name, k: kind } })} />
      ))}

      {fresh.length > 0 && (
        <Row title="Evrenlere yeni eklenenler">{fresh.map((t, i) => <Tile key={t.id} index={i} uri={posterUrl(t)} title={t.title} width={w} color={UBY[t.u]?.color} onPress={() => router.push(`/title/${t.id}`)} />)}</Row>
      )}

      {api && genreRows.slice(4).map((g) => (
        <RemoteRow key={g.name} title={g.name} deps={[kind]} load={() => byGenre(g, kind)} onMore={() => router.push({ pathname: '/genre/[id]', params: { id: g.name, k: kind } })} />
      ))}

      {!api && (
        <View style={{ marginTop: 30 }}>
          <Small>Tüm film ve dizilerde arama ve listeler, ara sunucu kurulunca açılır.</Small>
        </View>
      )}

      <CategorySheet visible={cats} kind={kind} onClose={() => setCats(false)} />
    </Screen>
  );
}

function KindChip({ label, on, onPress, icon }: { label: string; on?: boolean; onPress: () => void; icon?: React.ComponentProps<typeof Feather>['name'] }) {
  return (
    <Press accessibilityRole="button" accessibilityState={{ selected: !!on }} onPress={() => { tap(); onPress(); }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: on ? C.text : 'transparent', borderWidth: 1, borderColor: on ? C.text : 'rgba(255,255,255,0.35)' }}>
      <Text style={{ fontFamily: F.semibold, fontSize: 13.5, color: on ? C.bg : C.text }}>{label}</Text>
      {icon && <Feather name={icon} size={15} color={on ? C.bg : C.text} />}
    </Press>
  );
}

/* ---------- vitrin ---------- */
function OnlineBillboard({ kind }: { kind: Kind }) {
  const store = useStore();
  const { open } = usePreview();
  const toast = useToast();
  const { tablet } = useLayout();
  const [items, setItems] = useState<TItem[]>([]);
  useEffect(() => { let a = true; trendingKind(kind).then((r) => a && setItems(r.filter((x) => x.p && x.b && x.overview).slice(0, 6))).catch(() => {}); return () => { a = false; }; }, [kind]);
  const bb: BillboardItem[] = items.map((x) => {
    const inLib = !!store.state.lib[x.key] || !!catalogOf(x.key);
    return {
      key: x.key, title: x.title, image: img(tablet ? x.b : x.p, 'w780'), score: scoreText(x.vote, x.votes),
      tags: [x.m === 'movie' ? 'Film' : 'Dizi', x.year].filter(Boolean).join(' · '),
      onInfo: () => open(x),
      actions: (
        <>
          <Btn icon={inLib ? 'check' : 'plus'} kind="secondary" label="Listem" style={{ minWidth: 110, backgroundColor: 'rgba(40,40,46,0.85)' }}
            onPress={() => { if (catalogOf(x.key)) { open(x); return; } if (store.state.lib[x.key]) { store.libRemove(x.key); toast('Kütüphaneden çıkarıldı'); } else { store.libSave(x.key, libFromItem(x)); tap('success'); toast('Kütüphanene eklendi'); } }} />
          <Btn icon="info" label="Bilgi" style={{ minWidth: 110 }} onPress={() => open(x)} />
        </>
      ),
    };
  });
  return <FadeIn><Billboard items={bb} /></FadeIn>;
}

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
