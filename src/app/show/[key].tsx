import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MediaCard, Poster } from '@/components/media';
import { BackLink, Bar, Btn, Chip, Empty, Eyebrow, FadeIn, H1, Muted, Panel, Pills, Press, Screen, SectionHead, Small, tap, useLayout, useToast } from '@/components/ui';
import { duration } from '@/lib/format';
import { catalogOf, libFromDetail, libProgress, routeOf, shortDate } from '@/lib/library';
import { useStore } from '@/lib/store';
import { C, F, R, alpha } from '@/lib/theme';
import { detail, epIndex, hasApi, img, parseKey, season as loadSeason, today, type TDetail, type TEpisode } from '@/lib/tmdb';

export default function Show() {
  const { key = '' } = useLocalSearchParams<{ key: string }>();
  const pk = parseKey(key);
  const store = useStore();
  const { state } = store;
  const toast = useToast();
  const { tablet, width, pad } = useLayout();
  const [d, setD] = useState<TDetail | null>(null);
  const [err, setErr] = useState(false);
  const [sn, setSn] = useState<number | null>(null);
  const [eps, setEps] = useState<TEpisode[] | null>(null);

  // Evren kataloğunda olan yapımlar kendi sayfasında açılır
  const cat = catalogOf(key);
  useEffect(() => { if (cat) router.replace(`/title/${cat.id}`); }, [cat]);

  useEffect(() => {
    if (!pk || !hasApi()) return;
    let alive = true;
    setD(null); setErr(false);
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
    setEps(null);
    loadSeason(d.id, sn).then((x) => alive && setEps(x)).catch(() => alive && setEps([]));
    return () => { alive = false; };
  }, [d?.id, sn]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pk) return <Screen><BackLink label="Geri" onPress={() => router.back()} /><Empty title="Bu yapım bulunamadı." /></Screen>;
  if (!hasApi()) return <Screen><BackLink label="Geri" onPress={() => router.back()} /><Empty icon="wifi-off" title="Arama henüz kurulmadı." text="Tüm film ve dizileri görmek için ara sunucu kurulumu gerekiyor." /></Screen>;
  if (err && !d) return <Screen><BackLink label="Geri" onPress={() => router.back()} /><Empty icon="wifi-off" title="Yapım bilgisi alınamadı." text="İnternet bağlantını kontrol edip tekrar dene." action="Tekrar dene" onAction={() => router.replace(`/show/${key}`)} /></Screen>;
  if (!d) return <Screen><BackLink label="Geri" onPress={() => router.back()} /><View style={{ paddingVertical: 80, alignItems: 'center' }}><ActivityIndicator color={C.accentSoft} /></View></Screen>;

  const li = state.lib[key];
  const inLib = !!li;
  const pr = libProgress(state, key, li || libFromDetail(d));
  const done = pr.finished;
  const t0 = today();
  const save = () => store.libSave(key, libFromDetail(d));
  const back = () => (router.canGoBack() ? router.back() : router.replace('/explore'));
  const seen = new Set(state.episodes[key] || []);
  const idx = (e: TEpisode) => epIndex(d.seasons, e.s, e.e);
  const airedEps = (eps || []).filter((e) => e.date && e.date <= t0);
  const seasonDone = airedEps.length > 0 && airedEps.every((e) => seen.has(idx(e)));
  const epCols = width >= 1000 ? 3 : tablet ? 2 : 1;
  const meta = [d.year, d.m === 'movie' ? 'Film' : 'Dizi', d.m === 'movie' ? (d.runtime ? duration(d.runtime) : null) : `${d.seasons.length} sezon · ${d.aired} bölüm`].filter(Boolean).join(' · ');
  const bd = img(d.b, 'w780');

  return (
    <Screen>
      <BackLink label="Geri" onPress={back} />
      <FadeIn>
        <View style={{ borderRadius: R.xl, overflow: 'hidden', backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line }}>
          {bd && <Image source={{ uri: bd }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />}
          <LinearGradient colors={['rgba(10,11,16,0.35)', 'rgba(10,11,16,0.94)']} style={StyleSheet.absoluteFill} />
          <View style={{ flexDirection: tablet ? 'row' : 'column', padding: tablet ? 28 : 18, gap: tablet ? 28 : 16 }}>
            <Poster uri={img(d.p, 'w500')} title={d.title} width={tablet ? 220 : 132} />
            <View style={{ flex: 1, justifyContent: 'flex-end' }}>
              {!!d.genres.length && <Eyebrow>{d.genres.slice(0, 3).join(' · ')}</Eyebrow>}
              <H1 style={{ marginTop: 8, fontSize: tablet ? 36 : 28, lineHeight: tablet ? 42 : 33 }} accessibilityRole="header">{d.title}</H1>
              {d.orig && d.orig !== d.title && <Muted style={{ marginTop: 4 }}>{d.orig}</Muted>}
              <Small style={{ marginTop: 10, color: '#D2D5DE' }}>{meta}</Small>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {d.vote > 0 && d.votes >= 20 && <Chip icon="star" label={`TMDB ${d.vote.toFixed(1)}`} color={C.amber} />}
                {d.pl.map((x) => <Chip key={x} icon="play-circle" label={x} />)}
                {!d.pl.length && <Chip label="Türkiye'de abonelikte yok" />}
                {d.m === 'tv' && d.next && <Chip icon="calendar" label={`Yeni bölüm ${shortDate(d.next.date)}`} color={C.accentSoft} />}
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
                <Btn icon={inLib ? 'check' : 'plus'} kind={inLib ? 'success' : 'primary'} label={inLib ? 'Kütüphanemde' : 'Kütüphaneme ekle'}
                  onPress={() => {
                    if (inLib) { store.libRemove(key); toast('Kütüphaneden çıkarıldı'); }
                    else { save(); tap('success'); toast('Kütüphanene eklendi'); }
                  }} />
                {d.m === 'movie' && (
                  <Btn icon="check" kind={done ? 'success' : 'secondary'} label={done ? 'İzlendi · Geri al' : 'İzledim'}
                    onPress={() => { if (!inLib) save(); store.watchKey(key, !done); tap(done ? 'light' : 'success'); toast(done ? 'İzleme işareti kaldırıldı' : 'İzlendi olarak kaydedildi'); }} />
                )}
                {!!d.yt && <Btn icon="youtube" kind="secondary" label="Fragman" onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${d.yt}`)} />}
              </View>
            </View>
          </View>
        </View>
      </FadeIn>

      {(d.overview || d.tagline) ? (
        <Panel style={{ marginTop: 14 }}>
          <Eyebrow>Konusu</Eyebrow>
          {!!d.tagline && <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.accentSoft, marginTop: 8 }}>{d.tagline}</Text>}
          {!!d.overview && <Text style={{ fontFamily: F.regular, fontSize: 16, lineHeight: 25, color: C.text, marginTop: 8 }}>{d.overview}</Text>}
        </Panel>
      ) : null}

      <Panel style={{ marginTop: 14 }}>
        <Eyebrow>Senin değerlendirmen</Eyebrow>
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 8 }}>
          {[1, 2, 3, 4, 5].map((n) => {
            const on = (state.ratings[key] || 0) >= n;
            return (
              <Press key={n} accessibilityRole="button" accessibilityLabel={`${n} yıldız`} scaleTo={0.85} hitSlop={4}
                onPress={() => { if (!inLib) save(); store.setRating(key, n); tap(); }} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={on ? 'star' : 'star-outline'} size={28} color={on ? C.amber : C.dim} />
              </Press>
            );
          })}
        </View>
        <TextInput value={state.notes[key] || ''} onChangeText={(v) => store.setNote(key, v)} placeholder="Kısa bir not ekle (sadece sen görürsün)" placeholderTextColor={C.dim} multiline maxLength={500} accessibilityLabel="Not"
          style={{ marginTop: 10, minHeight: 64, padding: 12, borderRadius: R.md, backgroundColor: C.bg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, color: C.text, fontFamily: F.regular, fontSize: 16, lineHeight: 22, textAlignVertical: 'top' }} />
      </Panel>

      {d.m === 'tv' && d.seasons.length > 0 && (
        <>
          <SectionHead title="Bölümler" note={`${pr.done} / ${d.aired} izlendi`} />
          <Bar pct={d.aired ? (pr.done / d.aired) * 100 : 0} height={6} />
          {d.seasons.length > 1 && <View style={{ marginTop: 16 }}><Pills value={String(sn)} onChange={(v) => setSn(Number(v))} options={d.seasons.map((s) => ({ id: String(s.n), label: s.name.length < 16 ? s.name : `${s.n}. sezon` }))} /></View>}
          {eps === null ? <View style={{ paddingVertical: 30, alignItems: 'center' }}><ActivityIndicator color={C.accentSoft} /></View> : (
            <>
              {airedEps.length > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                  <Small>{airedEps.filter((e) => seen.has(idx(e))).length} / {airedEps.length} bölüm izlendi</Small>
                  <Btn kind="quiet" label={seasonDone ? 'Sezonun işaretlerini kaldır' : 'Sezonu tamamladım'}
                    onPress={() => { if (!inLib) save(); store.setEpsKey(key, airedEps.map(idx), !seasonDone); tap('success'); toast(seasonDone ? 'Sezon işaretleri kaldırıldı' : 'Sezon tamamlandı'); }} />
                </View>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                {eps.map((e) => {
                  const n = idx(e);
                  const on = seen.has(n);
                  const future = !e.date || e.date > t0;
                  return (
                    <Pressable key={n} disabled={future} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: future }}
                      accessibilityLabel={`${e.s}. sezon ${e.e}. bölüm, ${e.name}, ${future ? 'henüz yayınlanmadı' : on ? 'izlendi' : 'izlenmedi'}`}
                      onPress={() => { if (!inLib) save(); store.setEpsKey(key, [n], !on); tap(on ? 'light' : 'success'); }}
                      style={({ pressed }) => ({ width: `${100 / epCols - (epCols > 1 ? 2 : 0)}%` as `${number}%`, flexGrow: 1, padding: 12, borderRadius: R.md, backgroundColor: on ? alpha(C.green, 0.12) : C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: on ? alpha(C.green, 0.5) : C.line, opacity: future ? 0.5 : pressed ? 0.75 : 1 })}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text numberOfLines={1} style={{ fontFamily: F.bold, fontSize: 13, color: C.muted, width: 72 }}>S{String(e.s).padStart(2, '0')} · B{String(e.e).padStart(2, '0')}</Text>
                        <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.semibold, fontSize: 14, color: C.text }}>{e.name}</Text>
                        <Feather name={future ? 'clock' : on ? 'check-circle' : 'circle'} size={18} color={on ? C.green : C.dim} />
                      </View>
                      <Small style={{ marginTop: 3, marginLeft: 82, color: on ? C.green : C.dim }}>{future ? (e.date ? `Yayın: ${shortDate(e.date)}` : 'Tarih belli değil') : [e.date ? shortDate(e.date) : null, e.runtime ? duration(e.runtime) : null].filter(Boolean).join(' · ')}</Small>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </>
      )}

      {d.recs.length > 0 && (
        <>
          <SectionHead title="Benzer yapımlar" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }} style={{ marginHorizontal: -pad }}>
            <View style={{ width: pad - 14 }} />
            {d.recs.map((r, i) => <MediaCard key={r.key} index={i} uri={img(r.p, 'w342')} title={r.title} sub={[r.year, r.m === 'movie' ? 'Film' : 'Dizi'].filter(Boolean).join(' · ')} width={tablet ? 150 : 124} onPress={() => router.push(routeOf(r.key))} />)}
            <View style={{ width: pad - 14 }} />
          </ScrollView>
        </>
      )}

      <Small style={{ marginTop: 28 }}>Bilgiler ve görseller The Movie Database (TMDB) kaynaklıdır; platform bilgisi JustWatch verisidir.</Small>
    </Screen>
  );
}
