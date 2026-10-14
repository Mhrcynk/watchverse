import { isEn } from '@/lib/i18n';
import { detail } from '@/lib/tmdb';
import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Art, Wordmark } from '@/components/media';
import { BackLink, Bar, Btn, Chip, Empty, Eyebrow, H1, H2, H3, Muted, Panel, Pills, Press, Screen, SectionHead, Small, tap, useLayout, useToast } from '@/components/ui';
import { AFTER, TBY, TIER_TR, TYPE_TR, UBY, backdropUrl, whyOf } from '@/lib/catalog';
import { duration } from '@/lib/format';
import { episodeLabel, fraction, isDone, nextEpisode, readiness, remaining, route, totalMinutes, watchedEps } from '@/lib/progress';
import { useStore } from '@/lib/store';
import { C, F, R, alpha } from '@/lib/theme';
import { isSaved, itemFromTitle, useListPicker } from '@/components/lists';
import { useTrailer } from '@/components/trailer';

export default function TitleDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const { state } = store;
  const toast = useToast();
  const { pick } = useListPicker();
  const { play } = useTrailer();
  const { tablet, width } = useLayout();
  const t = TBY[id || ''];
  const seasons = useMemo(() => (t ? [...new Set(t.ep.map((e) => e[0]))] : []), [t]);
  const [season, setSeason] = useState<number>(() => {
    if (!t || !t.ep.length) return 1;
    const seen = new Set(state.episodes[t.id] || []);
    const firstOpen = t.ep.findIndex((_, i) => !seen.has(i + 1));
    return t.ep[firstOpen >= 0 ? firstOpen : 0][0];
  });
  const [showAfter, setShowAfter] = useState(false);
  const [showAllDeps, setShowAllDeps] = useState(false);
  // İngilizcede özet TMDB'den İngilizce alınır
  const [enSummary, setEnSummary] = useState<string | null>(null);
  useEffect(() => {
    if (!isEn || !t?.tmdb?.id || t.tmdb.id < 0) return;
    detail((t.tmdb.m || t.media) as 'movie' | 'tv', t.tmdb.id).then((d) => setEnSummary(d.overview || null), () => {});
  }, [t?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const summary = isEn ? enSummary : t?.summary;

  if (!t) return <Screen><BackLink label="Geri" onPress={() => router.back()} /><Empty title="Bu yapım bulunamadı." action="Ana sayfaya dön" onAction={() => router.replace('/')} /></Screen>;

  const u = UBY[t.u];
  const done = isDone(state, t);
  const inList = isSaved(state, t.id);
  const r = readiness(state, t.id);
  const missing = r.deps.filter((d) => !isDone(state, d));
  const list = route(state, t.u);
  const pos = list.findIndex((x) => x.id === t.id);
  const prev = pos > 0 ? list[pos - 1] : null;
  const next = pos >= 0 && pos < list.length - 1 ? list[pos + 1] : null;
  const after = AFTER[t.id] || [];
  const hideAfter = state.spoiler && !done && !showAfter;
  const bd = backdropUrl(t);
  const eps = watchedEps(state, t.id);
  const seasonIdx = t.ep.map((e, i) => ({ e, n: i + 1 })).filter((x) => x.e[0] === season);
  const seasonDone = seasonIdx.length > 0 && seasonIdx.every((x) => state.episodes[t.id]?.includes(x.n));
  const epCols = width >= 1000 ? 4 : tablet ? 3 : 2;

  const back = () => (router.canGoBack() ? router.back() : router.replace(`/universe/${t.u}`));

  return (
    <Screen>
      <BackLink label={u.name} onPress={back} />

      <View style={{ borderRadius: R.xl, overflow: 'hidden', backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line }}>
        {bd ? <Image source={{ uri: bd }} style={StyleSheet.absoluteFill} contentFit="cover" /> : (
          <LinearGradient colors={[alpha(u.color, 0.35), 'transparent']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
        )}
        <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0.92)']} style={StyleSheet.absoluteFill} />
        <View style={{ flexDirection: tablet ? 'row' : 'column', padding: tablet ? 28 : 18, gap: tablet ? 28 : 16 }}>
          <Art t={t} size="w500" style={{ width: tablet ? 220 : 132, alignSelf: tablet ? 'flex-start' : 'flex-start' }} />
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Eyebrow lang="en" style={{ color: u.color }}>{t.phase.startsWith(u.name) ? t.phase : `${u.name} · ${t.phase}`}</Eyebrow>
            <H1 style={{ marginTop: 8, fontSize: tablet ? 36 : 28, lineHeight: tablet ? 42 : 33 }} accessibilityRole="header">{t.title}</H1>
            {t.trTitle && <Muted style={{ marginTop: 4 }}>Türkiye’de: {t.trTitle}</Muted>}
            <Small style={{ marginTop: 10, color: '#D2D5DE' }}>
              {t.year} · {TYPE_TR[t.type]} · {t.episodes ? `${t.seasons > 1 ? t.seasons + ' sezon · ' : ''}${t.episodes} bölüm · toplam ${duration(totalMinutes(t))}` : duration(t.minutes)}
            </Small>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <Chip label={TIER_TR[t.tier]} color={t.tier === 0 ? C.accentSoft : C.muted} />
              {t.animated && <Chip label="Animasyon" />}
              {(t.pl || []).map((x) => <Chip key={x} label={x} icon="play-circle" />)}
            </View>
            <Small style={{ marginTop: 10, color: '#D2D5DE' }}>{whyOf(t)}</Small>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              <Btn icon="check" kind={done ? 'success' : 'primary'}
                label={done ? 'İzlendi · Geri al' : t.episodes ? 'Diziyi tamamladım' : 'İzledim'}
                onPress={() => { const v = store.toggleWatched(t.id); tap(v ? 'success' : 'light'); toast(v ? 'İzlendi olarak kaydedildi' : 'İzleme işareti kaldırıldı'); }} />
              {!!t.yt && <Btn icon="play" kind="secondary" label="Fragman" onPress={() => play(t.yt!, t.trTitle || t.title)} />}
              <Btn icon="bookmark" kind={inList ? 'success' : 'secondary'} label={inList ? 'Kütüphanende' : 'Kaydet'} accessibilityLabel={inList ? 'Kütüphanende; listeleri düzenle' : 'Kütüphaneme kaydet'} onPress={() => pick(itemFromTitle(t))} />
            </View>
          </View>
        </View>
      </View>

      {summary ? (
        <Panel style={{ marginTop: 14 }}>
          <Eyebrow>Konusu</Eyebrow>
          <Text style={{ fontFamily: F.regular, fontSize: 16, lineHeight: 25, color: C.text, marginTop: 8 }}>{summary}</Text>
        </Panel>
      ) : null}

      <Panel style={{ marginTop: 14 }}>
        <Eyebrow>Senin değerlendirmen</Eyebrow>
        <View accessibilityRole="adjustable" accessibilityLabel={`Puan: ${state.ratings[t.id] || 0} / 5`} style={{ flexDirection: 'row', gap: 4, marginTop: 8 }}>
          {[1, 2, 3, 4, 5].map((n) => {
            const on = (state.ratings[t.id] || 0) >= n;
            return (
              <Press key={n} accessibilityRole="button" accessibilityLabel={`${n} yıldız`} scaleTo={0.85} hitSlop={4}
                onPress={() => { store.setRating(t.id, n); tap(); }} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={on ? 'star' : 'star-outline'} size={28} color={on ? C.amber : C.dim} />
              </Press>
            );
          })}
        </View>
        <TextInput value={state.notes[t.id] || ''} onChangeText={(v) => store.setNote(t.id, v)}
          placeholder="Kısa bir not ekle (sadece sen görürsün)" placeholderTextColor={C.dim} multiline maxLength={500} accessibilityLabel="Not"
          style={{ marginTop: 10, minHeight: 64, padding: 12, borderRadius: R.md, backgroundColor: C.bg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, color: C.text, fontFamily: F.regular, fontSize: 16, lineHeight: 22, textAlignVertical: 'top' }} />
      </Panel>

      {t.episodes > 0 && (
        <>
          <SectionHead title="Bölüm ilerlemen" note={`${eps} / ${t.episodes} · ${duration(remaining(state, t))} kaldı`} />
          <Bar pct={fraction(state, t) * 100} color={u.color} height={6} />
          {t.ep.length ? (
            <>
              {seasons.length > 1 && <View style={{ marginTop: 16 }}><Pills value={String(season)} onChange={(v) => setSeason(Number(v))} options={seasons.map((s) => ({ id: String(s), label: `Sezon ${s}` }))} /></View>}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                <Small>{seasonIdx.filter((x) => state.episodes[t.id]?.includes(x.n)).length} / {seasonIdx.length} bölüm izlendi</Small>
                <Btn kind="quiet" label={seasonDone ? 'Sezonun işaretlerini kaldır' : 'Sezonu tamamladım'}
                  onPress={() => { store.setEpisodes(t.id, seasonIdx.map((x) => x.n), !seasonDone); tap('success'); toast(seasonDone ? 'Sezon işaretleri kaldırıldı' : `Sezon ${season} tamamlandı`); }} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
                {seasonIdx.map(({ e, n }) => {
                  const on = !!state.episodes[t.id]?.includes(n);
                  return (
                    <Pressable key={n} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${episodeLabel(t, n)} ${on ? 'izlendi' : 'izlenmedi'}`}
                      onPress={() => { store.toggleEpisode(t.id, n); tap(on ? 'light' : 'success'); }}
                      style={({ pressed }) => ({ width: `${100 / epCols - 2.4}%` as `${number}%`, flexGrow: 1, padding: 12, borderRadius: R.md, backgroundColor: on ? alpha(C.green, 0.12) : C.card, borderWidth: 1, borderColor: on ? alpha(C.green, 0.45) : C.line, opacity: pressed ? 0.7 : 1 })}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontFamily: F.semibold, fontSize: 14, color: C.text }}>{episodeLabel(t, n)}</Text>
                        <Feather name={on ? 'check-circle' : 'circle'} size={17} color={on ? C.green : C.dim} />
                      </View>
                      <Small style={{ marginTop: 3, color: on ? C.green : C.dim }}>{on ? 'İzlendi' : e[2] ? duration(e[2]) : 'İzlenmedi'}</Small>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : (
            <Panel style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Muted style={{ flex: 1 }}>Sezon dağılımı bu yapım için henüz yok. Bölüm sayacıyla ilerle.</Muted>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Btn kind="secondary" label="−" accessibilityLabel="Bir bölüm geri" onPress={() => { const arr = state.episodes[t.id] || []; if (arr.length) store.setEpisodes(t.id, [arr[arr.length - 1]], false); }} disabled={!eps} />
                <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.text, minWidth: 54, textAlign: 'center' }}>{eps}/{t.episodes}</Text>
                <Btn kind="secondary" label="+" accessibilityLabel="Bir bölüm ileri" onPress={() => { const n = nextEpisode(state, t); if (n) store.setEpisodes(t.id, [n], true); }} disabled={eps >= t.episodes} />
              </View>
            </Panel>
          )}
        </>
      )}

      <View style={{ flexDirection: tablet ? 'row' : 'column', gap: tablet ? 18 : 0 }}>
        <View style={tablet ? { flex: 1 } : undefined}>
          <SectionHead title="İzlemeden önce" />
          <Panel>
            {!r.deps.length ? (
              <Muted>Bu yapımı anlamak için önce izlemen gereken bir şey yok. Doğrudan başlayabilirsin.</Muted>
            ) : !missing.length ? (
              <>
                <Row icon="check-circle" color={C.green} text="Hazırsın. Bundan önce izlenmesi gerekenlerin hepsini izledin." />
                <Small style={{ marginTop: 8 }}>{r.deps.length} yapımın hepsi tamam.</Small>
              </>
            ) : (
              <>
                <Text style={{ fontFamily: F.semibold, fontSize: 15.5, lineHeight: 22, color: C.text }}>
                  {missing.length === 1 ? 'Önce şu yapımı izlemen önerilir:' : `Önce şu ${missing.length} yapımı izlemen önerilir:`}
                </Text>
                <View style={{ marginTop: 6 }}>{missing.slice(0, showAllDeps ? 99 : 5).map((d) => <DepLine key={d.id} id={d.id} />)}</View>
                {missing.length > 5 && <Btn kind="quiet" label={showAllDeps ? 'Daha az göster' : `${missing.length - 5} tane daha göster`} onPress={() => setShowAllDeps((v) => !v)} style={{ alignSelf: 'flex-start' }} />}
                <View style={{ marginTop: 10 }}><Bar pct={(r.done / r.deps.length) * 100} color={C.green} /></View>
                <Small style={{ marginTop: 8 }}>Gereken {r.deps.length} yapımın {r.done} tanesini izledin · yaklaşık {duration(missing.reduce((n, d) => n + remaining(state, d), 0))} kaldı</Small>
              </>
            )}
          </Panel>
        </View>
        <View style={tablet ? { flex: 1 } : undefined}>
          <SectionHead title="Bunu izledikten sonra" />
          <Panel>
            {after.length === 0 ? <Muted>Bu yapıma doğrudan bağlanan başka bir yapım tanımlı değil.</Muted> : hideAfter ? (
              <>
                <Row icon="lock" text={`${after.length} yapım bu hikâyeyi devam ettiriyor.`} />
                <Btn kind="quiet" label="Spoiler içerebilir · Göster" onPress={() => setShowAfter(true)} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
              </>
            ) : after.map((d) => <DepLine key={d.id} id={d.id} />)}
          </Panel>
        </View>
      </View>

      {(prev || next) && (
        <>
          <SectionHead title="Rotadaki yeri" note={pos >= 0 ? `${pos + 1} / ${list.length}` : undefined} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {prev ? <NavCard label="Önceki" id={prev.id} /> : <View style={{ flex: 1 }} />}
            {next ? <NavCard label="Sonraki" id={next.id} /> : <View style={{ flex: 1 }} />}
          </View>
        </>
      )}

      <View style={{ marginTop: 28, gap: 6 }}>
        {t.source && <Press onPress={() => Linking.openURL(t.source!)} accessibilityRole="link"><Small style={{ color: C.accentSoft }}>Yapım bilgisinin kaynağı</Small></Press>}
        <Small>WatchVerse yalnızca izleme takibi içindir; uygulamada film veya dizi oynatılmaz.</Small>
      </View>
    </Screen>
  );
}

function Row({ icon, text, color = C.muted }: { icon: React.ComponentProps<typeof Feather>['name']; text: string; color?: string }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Feather name={icon} size={18} color={color} /><Text style={{ flex: 1, fontFamily: F.medium, fontSize: 15, lineHeight: 21, color: color === C.muted ? C.muted : C.text }}>{text}</Text></View>;
}

function DepLine({ id }: { id: string }) {
  const { state } = useStore();
  const d = TBY[id];
  const ok = isDone(state, d);
  return (
    <Press accessibilityRole="button" onPress={() => router.push(`/title/${d.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 }}>
      <Feather name={ok ? 'check-circle' : 'circle'} size={17} color={ok ? C.green : C.dim} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: F.medium, fontSize: 14.5, color: C.text }}>{d.title}</Text>
        <Small>{d.year} · {TYPE_TR[d.type]}{d.u !== TBY[id].u ? '' : ''}</Small>
      </View>
      <Small style={{ color: ok ? C.green : d.tier === 0 ? UBY[d.u].color : C.dim }}>{ok ? 'İzlendi' : TIER_TR[d.tier]}</Small>
    </Press>
  );
}

function NavCard({ label, id }: { label: string; id: string }) {
  const t = TBY[id];
  return (
    <Press accessibilityRole="button" onPress={() => router.replace(`/title/${id}`)} style={{ flex: 1 }}>
      <Panel style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12 }}>
        <Art t={t} compact size="w185" style={{ width: 40, borderRadius: 7 }} />
        <View style={{ flex: 1 }}>
          <Small>{label}</Small>
          <H3 numberOfLines={2} style={{ fontSize: 14.5, lineHeight: 19 }}>{t.title}</H3>
        </View>
      </Panel>
    </Press>
  );
}
