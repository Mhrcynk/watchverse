import { compatibleLayout, libraryLayout } from '@/lib/episode-identity';
import { RatingNotes } from '@/components/rating-notes';
import { SeasonActions } from '@/components/season-actions';
import { CatchUpControl } from '@/components/catch-up';
import { catchUpSelection } from '@/lib/catch-up';
import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Row, TItemTile, useTileW } from '@/components/rows';
import { BackLink, Bar, Btn, Chip, Empty, Eyebrow, FadeIn, H1, Muted, Panel, Pills, Press, Screen, SectionHead, Small, tap, useLayout, useToast, SkeletonPage, SkeletonRows } from '@/components/ui';
import { duration } from '@/lib/format';
import { catalogOf, libFromDetail, libProgress, shortDate } from '@/lib/library';
import { useStore } from '@/lib/store';
import { C, F, R } from '@/lib/theme';
import { RecommendBanner, TitleExtras } from '@/components/extras';
import { CastRow } from '@/components/people';
import { itemFromDetail, useListPicker } from '@/components/lists';
import { useTrailer } from '@/components/trailer';
import { detail, epIndex, hasApi, img, parseKey, season as loadSeason, today, type TDetail, type TEpisode } from '@/lib/tmdb';

export default function Show() {
  const { key = '' } = useLocalSearchParams<{ key: string }>();
  return <ShowContent key={key} routeId={key} />;
}

function ShowContent({ routeId: key }: { routeId: string }) {
  const pk = parseKey(key);
  const store = useStore();
  const { state } = store;
  const toast = useToast();
  const { pick } = useListPicker();
  const { play } = useTrailer();
  const { tablet, width, pad } = useLayout();
  const insets = useSafeAreaInsets();
  const tileW = useTileW();
  const [d, setD] = useState<TDetail | null>(null);
  const [err, setErr] = useState(false);
  const [sn, setSn] = useState<number | null>(null);
  const [seasonResult, setSeasonResult] = useState<{ sn: number; eps: TEpisode[] } | null>(null);
  const eps = seasonResult?.sn === sn ? seasonResult.eps : null;

  // Evren kataloğunda olan yapımlar kendi sayfasında açılır
  const cat = catalogOf(key);
  useEffect(() => { if (cat) router.replace(`/title/${cat.id}`); }, [cat]);

  useEffect(() => {
    if (!pk || !hasApi()) return;
    let alive = true;
    detail(pk.m, pk.id).then((x) => {
      if (!alive) return;
      setD(x);
      // Kütüphanedeyse bilgisi tazelensin
      if (state.lib[key]) store.libSave(key, { ...libFromDetail(x), added: state.lib[key].added });
      if (x.m === 'tv' && x.seasons.length) {
        const w = new Set(state.episodes[key] || []);
        const firstOpen = x.seasons.find((s) => { for (let e = 1; e <= s.count; e++) if (!w.has(epIndex(x.seasons, s.n, e))) return true; return false; });
        setSn((firstOpen || x.seasons[x.seasons.length - 1]).n);
      }
    }).catch(() => alive && setErr(true));
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!d || d.m !== 'tv' || sn == null) return;
    let alive = true;
    loadSeason(d.id, sn).then((x) => {
      if (!alive) return;
      const item = store.getState().lib[key];
      if (item) store.libSave(key, { ...item, episodeIds: { ...item.episodeIds, ...Object.fromEntries(x.filter(e=>e.id).map(e=>[`s${e.s}e${e.e}`,e.id!])) } });
      setSeasonResult({ sn, eps: x });
    }).catch(() => alive && setSeasonResult({ sn, eps: [] }));
    return () => { alive = false; };
  }, [d?.id, sn]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pk) return <Screen><BackLink label="Geri" onPress={() => router.back()} /><Empty title="Bu yapım bulunamadı." /></Screen>;
  if (!hasApi()) return <Screen><BackLink label="Geri" onPress={() => router.back()} /><Empty icon="wifi-off" title="Yapım bilgisi şu an kullanılamıyor." text="Daha sonra tekrar dene." /></Screen>;
  if (err && !d) return <Screen><BackLink label="Geri" onPress={() => router.back()} /><Empty icon="wifi-off" title="Yapım bilgisi alınamadı." text="İnternet bağlantını kontrol edip tekrar dene." action="Tekrar dene" onAction={() => router.replace(`/show/${key}`)} /></Screen>;
  if (!d) return <Screen><BackLink label="Geri" onPress={() => router.back()} /><SkeletonPage /></Screen>;

  const li = state.lib[key];
  const inLib = !!li;
  const pr = libProgress(state, key, li || libFromDetail(d));
  const done = pr.finished;
  const t0 = today();
  const save = () => store.libSave(key, { ...libFromDetail(d), episodeIds: Object.fromEntries((eps || []).filter(e=>e.id).map(e=>[`s${e.s}e${e.e}`,e.id!])) });
  const back = () => (router.canGoBack() ? router.back() : router.replace('/explore'));
  const seen = new Set(state.episodes[key] || []);
  const idx = (e: TEpisode) => epIndex(d.seasons, e.s, e.e);
  const airedEps = (eps || []).filter((e) => e.date && e.date <= t0);
  const catchUpLoad = async (s:number,e:number) => {
    const all:TEpisode[]=[];
    for(const part of d.seasons.filter(x=>x.n<=s).sort((a,b)=>a.n-b.n)) all.push(...await loadSeason(d.id,part.n));
    const ids=Object.fromEntries(all.filter(x=>x.id).map(x=>[`s${x.s}e${x.e}`,x.id!]));
    const old=store.getState().lib[key];
    if(old?.seasons && !compatibleLayout(libraryLayout(key,old),libraryLayout(key,{...old,...libFromDetail(d),episodeIds:{...old.episodeIds,...ids}}))) throw new Error('Bölüm sırası değişmiş. Güvenli eşleştirme tamamlanmadan toplu işaretleme yapılamıyor.');
    return {nums:catchUpSelection(all.map(x=>({n:idx(x),season:x.s,episode:x.e,aired:!!x.date && x.date<=t0})),s,e),ids};
  };

  const epCols = width >= 1000 ? 3 : tablet ? 2 : 1;
  const meta = [d.year, d.m === 'movie' ? 'Film' : 'Dizi', d.m === 'movie' ? (d.runtime ? duration(d.runtime) : null) : `${d.seasons.length} sezon · ${d.aired} bölüm`].filter(Boolean).join(' · ');
  const bd = img(d.b, 'w780');

  return (
    <Screen>
      {/* Netflix gibi: üstte tam genişlik görsel, altında ad, bilgiler ve geniş düğmeler */}
      <FadeIn>
        <View style={{ marginHorizontal: -pad, marginTop: -(insets.top + (tablet ? 28 : 14)) }}>
          <View style={{ width: '100%', aspectRatio: tablet ? 21 / 9 : 16 / 10, backgroundColor: C.card }}>
            {(bd || d.p) && <Image source={{ uri: bd || img(d.p, 'w780')! }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />}
            <LinearGradient colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', C.bg]} locations={[0, 0.25, 0.6, 1]} style={StyleSheet.absoluteFill} />
            <Press accessibilityRole="button" accessibilityLabel="Geri" onPress={back} hitSlop={8}
              style={{ position: 'absolute', top: insets.top + 8, left: pad - 6, height: 40, paddingLeft: 8, paddingRight: 14, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.55)', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Feather name="chevron-left" size={22} color="#fff" />
              <Text style={{ fontFamily: F.semibold, fontSize: 14, color: '#fff' }}>Geri</Text>
            </Press>
            {!!d.yt && (
              <Press accessibilityRole="button" accessibilityLabel="Fragmanı izle" onPress={() => play(d.yt!, d.title)}
                style={{ position: 'absolute', alignSelf: 'center', top: '38%', width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="play" size={24} color="#fff" style={{ marginLeft: 3 }} />
              </Press>
            )}
          </View>
        </View>
        <View style={{ marginTop: 4 }}>
          <H1 style={{ fontSize: tablet ? 38 : 28, lineHeight: tablet ? 44 : 33 }} accessibilityRole="header">{d.title}</H1>
          {d.orig && d.orig !== d.title && <Muted style={{ marginTop: 2 }}>{d.orig}</Muted>}
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {d.vote > 0 && d.votes >= 15 && <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.amber }}>★ {d.vote.toFixed(1)}</Text>}
            <Text style={{ fontFamily: F.medium, fontSize: 14, color: '#D0D0D6' }}>{meta}</Text>
          </View>
          {!!d.genres.length && <Small style={{ marginTop: 4 }}>{d.genres.slice(0, 4).join(' · ')}</Small>}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {d.pl.map((x) => <Chip key={x} icon="play-circle" label={x} />)}
            {!d.pl.length && <Chip label="Türkiye'de abonelikte yok" />}
            {d.m === 'tv' && d.next && <Chip icon="calendar" label={`Yeni bölüm ${shortDate(d.next.date)}`} color={C.accentSoft} />}
          </View>
          <View style={{ height: 16 }} />
          <RecommendBanner />
          <Btn icon="bookmark" kind={inLib ? 'success' : 'primary'} label={inLib ? 'Kütüphanende' : 'Kaydet'}
            accessibilityLabel={inLib ? 'Kütüphanende; listeleri düzenle' : 'Kütüphaneme kaydet'} onPress={() => { pick(itemFromDetail(d)); if (!inLib) save(); }} />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            {d.m === 'movie' && (
              <Btn style={{ flex: 1 }} icon="check" kind={done ? 'success' : 'secondary'} label={done ? 'İzlendi' : 'İzledim'}
                onPress={() => { if (!inLib) save(); store.watchKey(key, !done); tap(done ? 'light' : 'success'); toast(done ? 'İzleme işareti kaldırıldı' : 'İzlendi olarak kaydedildi'); }} />
            )}
            {!!d.yt && <Btn style={{ flex: 1 }} icon="play" kind="secondary" label="Fragman" onPress={() => play(d.yt!, d.title)} />}
          </View>
          <TitleExtras k={key} title={d.title} path={`show/${key}`} movie={d.m === 'movie'} done={done} started={pr.done > 0 || inLib} />
        </View>
      </FadeIn>

      {(d.overview || d.tagline) ? (
        <Panel style={{ marginTop: 14 }}>
          <Eyebrow>Konusu</Eyebrow>
          {!!d.tagline && <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.accentSoft, marginTop: 8 }}>{d.tagline}</Text>}
          {!!d.overview && <Text style={{ fontFamily: F.regular, fontSize: 16, lineHeight: 25, color: C.text, marginTop: 8 }}>{d.overview}</Text>}
        </Panel>
      ) : null}

      <CastRow cast={d.cast || []} makers={d.makers || []} />

      <RatingNotes rating={state.ratings[key] || 0} note={state.notes[key] || ''} onRating={n=>{if(!inLib)save();store.setRating(key,n);}} onNote={v=>{if(!inLib)save();store.setNote(key,v);}} />

      {d.m === 'tv' && d.seasons.length > 0 && (
        <>
          <SectionHead title="Bölümler" note={`${pr.done} / ${d.aired} izlendi`} />
          <Bar pct={d.aired ? (pr.done / d.aired) * 100 : 0} height={6} />
          <CatchUpControl seasons={d.seasons.map(s=>s.n)} load={catchUpLoad} seen={()=>store.getState().episodes[key] || []}
                apply={(nums,value,ids)=>{ if(value) {const old=store.getState().lib[key];const candidate={...old,...libFromDetail(d),episodeIds:{...old?.episodeIds,...ids}};if(old?.seasons && !compatibleLayout(libraryLayout(key,old),libraryLayout(key,candidate)))throw new Error('Bölüm eşlemesi değişti; yeniden önizle.');store.libSave(key,candidate);} store.setEpsKey(key,nums,value,false); }} />
              {d.seasons.length > 1 && <View style={{ marginTop: 16 }}><Pills value={String(sn)} onChange={(v) => setSn(Number(v))} options={d.seasons.map((s) => ({ id: String(s.n), label: s.name.length < 16 ? s.name : `${s.n}. sezon` }))} /></View>}
          {eps === null ? <SkeletonRows n={3} /> : (
            <>
              <SeasonActions nums={airedEps.map(idx)} seen={[...seen]} set={(nums,value)=>{if(!inLib)save();store.setEpsKey(key,nums,value);}} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                {eps.map((e) => {
                  const n = idx(e);
                  const on = seen.has(n);
                  const future = !e.date || e.date > t0;
                  return (
                    <Pressable key={n} disabled={future} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: future }} aria-checked={on} aria-disabled={future}
                      accessibilityLabel={`${e.s}. sezon ${e.e}. bölüm, ${e.name}, ${future ? 'henüz yayınlanmadı' : on ? 'izlendi' : 'izlenmedi'}`}
                      onPress={() => { if (!inLib) save(); store.setEpsKey(key, [n], !on); tap(on ? 'light' : 'success'); }}
                      style={({ pressed }) => ({ width: `${100 / epCols - (epCols > 1 ? 2 : 0)}%` as `${number}%`, flexGrow: 1, padding: 10, borderRadius: R.md, backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineSoft, opacity: future ? 0.5 : pressed ? 0.75 : 1 })}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={{ width: 118, aspectRatio: 16 / 9, borderRadius: 6, overflow: 'hidden', backgroundColor: C.raised, alignItems: 'center', justifyContent: 'center' }}>
                          {e.still ? <Image source={{ uri: img(e.still, 'w342')! }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Feather name="film" size={18} color={C.dim} />}
                          {on && <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, backgroundColor: C.accent }} />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={2} style={{ fontFamily: F.semibold, fontSize: 14.5, lineHeight: 19, color: C.text }}>{e.e}. {e.name}</Text>
                          <Small style={{ marginTop: 3, color: on ? C.green : C.dim }}>{future ? (e.date ? `Yayın: ${shortDate(e.date)}` : 'Tarih belli değil') : [on ? 'İzlendi' : null, e.date ? shortDate(e.date) : null, e.runtime ? duration(e.runtime) : null].filter(Boolean).join(' · ')}</Small>
                        </View>
                        <Feather name={future ? 'clock' : on ? 'check-circle' : 'circle'} size={22} color={on ? C.green : C.dim} />
                      </View>
                      {!!e.overview && !future && <Text numberOfLines={2} style={{ marginTop: 8, fontFamily: F.regular, fontSize: 13, lineHeight: 18, color: C.muted }}>{e.overview}</Text>}
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </>
      )}

      {d.recs.length > 0 && <Row title="Benzerleri">{d.recs.filter((r) => r.p).map((r, i) => <TItemTile key={r.key} x={r} width={tileW} index={i} />)}</Row>}

      <Small style={{ marginTop: 28 }}>Bilgiler ve görseller The Movie Database (TMDB) kaynaklıdır; platform bilgisi JustWatch verisidir.</Small>
    </Screen>
  );
}
