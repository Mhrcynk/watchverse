import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Brand } from '@/components/brand';
import { Art, PosterCard, UniverseCard } from '@/components/media';
import { Btn, Chip, Empty, Grid, Eyebrow, H1, H2, H3, Muted, Panel, Press, Ring, Screen, SectionHead, Small, tap, useLayout, useToast } from '@/components/ui';
import { TBY, TYPE_TR, UBY, backdropUrl } from '@/lib/catalog';
import { duration } from '@/lib/format';
import { bigStory, continueWatching, episodeLabel, isDone, nextEpisode, nextUp, readiness, tonight, universeProgress } from '@/lib/progress';
import { useStore } from '@/lib/store';
import { C, F, R, alpha } from '@/lib/theme';

export default function Home() {
  const store = useStore();
  const { state } = store;
  const { tablet, width, pad } = useLayout();
  const toast = useToast();

  const cw = useMemo(() => continueWatching(state), [state]);
  const hero = useMemo(() => cw[0] || state.follow.map((u) => nextUp(state, u)).find(Boolean) || null, [state, cw]);
  const big = useMemo(() => bigStory(state), [state]);
  const night = useMemo(() => tonight(state), [state]);
  const followed = state.follow.map((u) => UBY[u]).filter(Boolean);
  const list = state.list.map((id) => TBY[id]).filter((t) => t && !isDone(state, t));

  const railW = tablet ? 150 : Math.min(132, (width - pad * 2 - 24) / 2.6);
  const cardW = Math.min(290, width * 0.74);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 26 }}>
        <Brand />
        <Chip
          icon={state.spoiler ? 'lock' : 'unlock'}
          label={state.spoiler ? 'Spoiler koruması açık' : 'Spoiler koruması kapalı'}
          color={state.spoiler ? C.green : C.muted}
          bg={state.spoiler ? alpha(C.green, 0.1) : C.card}
          onPress={() => { store.setSpoiler(!state.spoiler); toast(state.spoiler ? 'Spoiler koruması kapatıldı' : 'Spoiler koruması açıldı'); }}
        />
      </View>

      <Muted>{state.name ? `Tekrar hoş geldin, ${state.name}.` : 'Tekrar hoş geldin.'}</Muted>
      <H1 style={{ marginTop: 2, marginBottom: 20 }}>Bir sonraki hikâyen.</H1>

      {hero ? <Hero id={hero.id} /> : (
        <Empty icon="check-circle" title={followed.length ? 'Takip ettiğin rotalarda her şey tamam.' : 'Yeni bir hikâyeye başla.'}
          text="Keşfedecek başka evrenler var." action="Evrenleri keşfet" onAction={() => router.push('/universes')} />
      )}

      {cw.length > 1 && (
        <>
          <SectionHead title="Devam ettiklerin" note={`${cw.length} dizi`} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }} style={{ marginHorizontal: -pad }} >
            <View style={{ width: pad - 14 }} />
            {cw.map((t) => <PosterCard key={t.id} t={t} width={railW} />)}
            <View style={{ width: pad - 14 }} />
          </ScrollView>
        </>
      )}

      <SectionHead title="Evrenlerine dön" action="Tümünü gör" onAction={() => router.push('/universes')} />
      {followed.length ? (
        tablet ? (
          <Grid items={followed} cols={width >= 1200 ? 3 : 2} keyOf={(u) => u.id} render={(u) => <UniverseCard u={u} state={state} />} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }} style={{ marginHorizontal: -pad }}>
            <View style={{ width: pad - 12 }} />
            {followed.map((u) => <UniverseCard key={u.id} u={u} state={state} style={{ width: cardW }} />)}
            <View style={{ width: pad - 12 }} />
          </ScrollView>
        )
      ) : <Muted>Henüz bir evren takip etmiyorsun.</Muted>}

      <View style={{ flexDirection: tablet ? 'row' : 'column', gap: tablet ? 18 : 0 }}>
        {big && (
          <View style={{ flex: 1 }}>
            <SectionHead title="Büyük hikâyeye hazırlan" />
            <BigStory id={big.id} />
          </View>
        )}
        {night && (
          <View style={{ flex: 1 }}>
            <SectionHead title="Bu akşam için" note={duration(night.ep ? (night.t.ep[night.ep - 1]?.[2] || night.t.minutes) : night.t.minutes)} />
            <Press accessibilityRole="button" onPress={() => router.push(`/title/${night.t.id}`)}>
              <Panel style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                <Art t={night.t} compact size="w185" style={{ width: 62 }} />
                <View style={{ flex: 1 }}>
                  <H3 numberOfLines={2}>{night.t.title}</H3>
                  <Small style={{ marginTop: 3 }}>{night.ep ? `Sıradaki: ${episodeLabel(night.t, night.ep)}` : `${night.t.year} · ${TYPE_TR[night.t.type]}`}</Small>
                  <Small style={{ marginTop: 8, color: C.accentSoft }}>{night.ep ? 'Bir bölüm, kaldığın yerden.' : 'Tek oturuşta biter.'}</Small>
                </View>
                <Feather name="chevron-right" size={20} color={C.dim} />
              </Panel>
            </Press>
          </View>
        )}
      </View>

      {list.length > 0 && (
        <>
          <SectionHead title="Listendekiler" note={`${list.length} yapım`} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }} style={{ marginHorizontal: -pad }}>
            <View style={{ width: pad - 14 }} />
            {list.map((t) => <PosterCard key={t.id} t={t} width={railW} />)}
            <View style={{ width: pad - 14 }} />
          </ScrollView>
        </>
      )}

      <View style={{ marginTop: 38, flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <Small>Sen izle. WatchVerse kaldığın yeri hatırlar.</Small>
        <Small>İlerlemen bu cihazda saklanır.</Small>
      </View>
    </Screen>
  );
}

function Hero({ id }: { id: string }) {
  const store = useStore();
  const { state } = store;
  const { tablet } = useLayout();
  const toast = useToast();
  const t = TBY[id];
  const u = UBY[t.u];
  const p = universeProgress(state, t.u);
  const ep = nextEpisode(state, t);
  const r = readiness(state, t.id);
  const bd = backdropUrl(t);
  return (
    <View style={{ borderRadius: R.xl, overflow: 'hidden', backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, minHeight: tablet ? 360 : 0 }}>
      {bd ? <Image source={{ uri: bd }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} /> : (
        <LinearGradient colors={[alpha(u.color, 0.42), alpha(u.color, 0.08), C.card]} start={{ x: 1, y: 0 }} end={{ x: 0.1, y: 1 }} style={StyleSheet.absoluteFill} />
      )}
      <LinearGradient colors={['rgba(11,13,18,0.15)', 'rgba(11,13,18,0.82)', C.card]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <View style={{ flexDirection: 'row', padding: tablet ? 30 : 20, gap: 22, alignItems: 'flex-end' }}>
        <View style={{ flex: 1, paddingTop: tablet ? 40 : 70 }}>
          <View style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: alpha('#FFFFFF', 0.25), backgroundColor: 'rgba(0,0,0,0.25)' }}>
            <Text style={{ fontFamily: F.medium, fontSize: 11.5, color: C.text, letterSpacing: 0.4 }}>{t.phase}</Text>
          </View>
          <Eyebrow style={{ marginTop: 18 }}>{ep && ep > 1 ? 'Kaldığın yerden devam' : 'Senin için sıradaki'}</Eyebrow>
          <Text style={{ fontFamily: F.bold, fontSize: tablet ? 40 : 30, lineHeight: tablet ? 46 : 35, color: C.text, letterSpacing: -1, marginTop: 8 }} numberOfLines={3}>{t.title}</Text>
          <Small style={{ marginTop: 8, color: '#D4D6DE' }}>
            {t.year} · {TYPE_TR[t.type]} · {t.episodes ? (ep ? `Sıradaki ${episodeLabel(t, ep)}` : `${t.episodes} bölüm`) : duration(t.minutes)}
          </Small>
          {t.summary && !tablet && <Muted numberOfLines={2} style={{ marginTop: 10, color: '#C9CCD6' }}>{t.summary}</Muted>}
          {t.summary && tablet && <Muted numberOfLines={3} style={{ marginTop: 12, color: '#C9CCD6', maxWidth: 560 }}>{t.summary}</Muted>}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
            <Btn icon="play" label={t.episodes ? 'Bölümlere git' : 'Ayrıntılar'} onPress={() => router.push(`/title/${t.id}`)} />
            <Btn icon="check" kind="secondary" label={t.episodes && ep ? `${episodeLabel(t, ep)} izledim` : 'İzledim'}
              onPress={() => {
                if (t.episodes && ep) { store.toggleEpisode(t.id, ep); tap('success'); toast(`${episodeLabel(t, ep)} kaydedildi`); }
                else { store.toggleWatched(t.id, true); tap('success'); toast('İzlendi olarak kaydedildi'); }
              }} />
          </View>
          <Small style={{ marginTop: 14, color: r.pct === 100 ? C.green : C.muted }}>
            {r.deps.length === 0 ? `${u.name} · ${p.done} / ${p.total} yapım tamamlandı` : r.pct === 100 ? '✓ Ön koşullar tamam. Hikâyeye hazırsın.' : `Öncesinde önerilen ${r.deps.length - r.done} yapım var.`}
          </Small>
        </View>
        {tablet && (
          <View style={{ alignItems: 'flex-end' }}>
            <Art t={t} style={{ width: 170 }} />
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 14 }}>
              <Text style={{ fontFamily: F.bold, fontSize: 44, color: C.text, letterSpacing: -2 }}>{p.pct}</Text>
              <Small style={{ marginBottom: 9 }}>% {u.name}</Small>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function BigStory({ id }: { id: string }) {
  const { state } = useStore();
  const t = TBY[id];
  const r = readiness(state, id);
  return (
    <Press accessibilityRole="button" onPress={() => router.push(`/title/${id}`)}>
      <Panel style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <Ring pct={r.pct} size={78} color={UBY[t.u].color} />
        <View style={{ flex: 1 }}>
          <Eyebrow lang="en" style={{ color: UBY[t.u].color }}>{UBY[t.u].name}</Eyebrow>
          <H3 numberOfLines={2} style={{ marginTop: 4 }}>{t.title}</H3>
          <Small style={{ marginTop: 3 }}>{r.done} / {r.deps.length} ön koşul · {duration(r.left)} kaldı</Small>
          <Text style={{ fontFamily: F.medium, fontSize: 13.5, color: C.accentSoft, marginTop: 8 }}>Hazırlık rotasını gör</Text>
        </View>
      </Panel>
    </Press>
  );
}
