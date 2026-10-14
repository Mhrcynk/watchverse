import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PosterCard, StoryCard, UniverseLogo } from '@/components/media';
import { Row, useTileW } from '@/components/rows';
import { TicketCard } from '@/components/home';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { backdropOf } from '@/lib/logos';
import { BackLink, Btn, Chip, Empty, Grid, H1, H3, Muted, Panel, Press, Ring, Screen, Small, useLayout, useToast } from '@/components/ui';
import { CATEGORY_TR, TYPE_TR, UBY, phaseOf, posterUrl } from '@/lib/catalog';
import { shelvesOf } from '@/lib/shelves';
import { duration } from '@/lib/format';
import { isDone, nextUp, universeProgress } from '@/lib/progress';
import { useStore } from '@/lib/store';
import { C, F, R, alpha } from '@/lib/theme';
import type { Title } from '@/lib/types';
import { confirm } from '@/lib/confirm';

const PAGE = 60;

export default function UniverseDetail() {
  const { id, shelf } = useLocalSearchParams<{ id: string; shelf?: string }>();
  const u = UBY[id || ''];
  if (!u) return <Screen><BackLink label="Evrenler" onPress={() => router.back()} /><Empty title="Bu evren bulunamadı." action="Evrenlere dön" onAction={() => router.replace('/universes')} /></Screen>;
  return shelf ? <ShelfList uid={u.id} shelfKey={shelf} /> : <Shelves uid={u.id} />;
}

/** Evren sayfası: üstte görsel ve ilerleme, altında raflar (her rota / tür kendi satırında) */
function Shelves({ uid }: { uid: string }) {
  const u = UBY[uid];
  const store = useStore();
  const { state } = store;
  const toast = useToast();
  const { tablet, pad, width, posterCols } = useLayout();
  const tw = useTileW();
  const insets = useSafeAreaInsets();
  const bd = backdropOf(u.id);
  const order = state.view === 'chrono' ? 'chrono' : 'release';
  const shelves = useMemo(() => shelvesOf(u.id, order), [u.id, order]);
  const p = universeProgress(state, u.id);
  const n = nextUp(state, u.id);
  const following = state.follow.includes(u.id);
  const total = shelves.reduce((x, s) => x + s.items.length, 0);
  const groups = new Set(shelves.map((s) => s.group)).size;

  return (
    <Screen>
      {/* üstte tam genişlik görsel, logo ve ilerleme */}
      <View style={{ marginHorizontal: -pad, marginTop: -(insets.top + (tablet ? 28 : 14)) }}>
        <View style={{ width: '100%', aspectRatio: tablet ? 21 / 9 : 4 / 3.4, backgroundColor: C.card, justifyContent: 'flex-end' }}>
          {bd ? <Image source={{ uri: bd }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} /> : <LinearGradient colors={[alpha(u.color, 0.45), C.bg]} style={StyleSheet.absoluteFill} />}
          <LinearGradient colors={['rgba(21,23,29,0.55)', 'rgba(21,23,29,0.1)', 'rgba(21,23,29,0.55)', C.bg]} locations={[0, 0.3, 0.7, 1]} style={StyleSheet.absoluteFill} />
          <Press accessibilityRole="button" accessibilityLabel="Evrenler sayfasına dön" onPress={() => (router.canGoBack() ? router.back() : router.replace('/universes'))} hitSlop={8}
            style={{ position: 'absolute', top: insets.top + 8, left: pad - 6, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(21,23,29,0.6)', alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="chevron-left" size={24} color="#fff" />
          </Press>
          <View style={{ paddingHorizontal: pad, paddingBottom: 6 }}>
            <UniverseLogo u={u} height={tablet ? 80 : 62} maxWidth={tablet ? 360 : 260} />
          </View>
        </View>
      </View>

      <Muted style={{ marginTop: 12 }}>{u.desc}</Muted>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16 }}>
        <View style={{ flex: 1, gap: 10 }}>
          <Small>{CATEGORY_TR[u.category]} · {total} yapım · ana hikâyede {duration(p.left)} kaldı</Small>
          <Btn style={{ alignSelf: 'flex-start' }} kind={following ? 'success' : 'primary'} icon={following ? 'check' : 'plus'}
            label={following ? 'Takip ediliyor' : 'Evreni takip et'}
            onPress={() => { store.toggleFollow(u.id); toast(following ? `${u.name} takipten çıkarıldı` : `${u.name} takip ediliyor`); }} />
        </View>
        <View style={{ alignItems: 'center' }}>
          <Ring pct={p.pct} size={tablet ? 100 : 78} color={C.accent} />
          <Small style={{ marginTop: 6 }}>{p.done} / {p.total}</Small>
        </View>
      </View>

      <View style={{ marginTop: 22 }}>
        {n ? (
          <TicketCard width={Math.min(width - pad * 2, 560)} title={n.trTitle || n.title} poster={posterUrl(n, 'w342')} sub={`${n.year} · ${TYPE_TR[n.type]}`} badge="Sıradaki" onPress={() => router.push(`/title/${n.id}`)} />
        ) : (
          <Panel style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Feather name="award" size={26} color={C.green} />
            <H3 style={{ flex: 1 }}>Ana hikâyeyi tamamladın.</H3>
          </Panel>
        )}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 22 }}>
        <Small style={{ flex: 1 }}>Sıralama</Small>
        <Chip label="Çıkış sırası" active={order === 'release'} onPress={() => store.setView(state.view === 'chrono' ? 'main' : state.view)} />
        <Chip label="Kronolojik" active={order === 'chrono'} onPress={() => store.setView('chrono')} />
      </View>

      {shelves.length === 1 && (
        <View style={{ marginTop: 22 }}>
          <Grid items={shelves[0].items} cols={posterCols} gap={14} rowGap={22} keyOf={(t) => t.id} render={(t, cw) => <PosterCard t={t} width={cw} />} />
          <Btn kind="secondary" icon="list" label="Sırayla listele" style={{ marginTop: 20, alignSelf: 'flex-start' }} onPress={() => router.push({ pathname: '/universe/[id]', params: { id: u.id, shelf: shelves[0].key } })} />
        </View>
      )}
      {shelves.length > 1 && shelves.map((sh, i) => {
        const groupHead = sh.split && groups > 1 && shelves[i - 1]?.group !== sh.group;
        return (
          <View key={sh.key}>
          {groupHead && (
            <View style={{ marginTop: 34, flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text accessibilityRole="header" numberOfLines={1} style={{ flexShrink: 1, fontFamily: F.heavy, fontSize: 21, color: C.text, letterSpacing: -0.4 }}>{sh.group}</Text>
              <Small>{shelves.filter((x) => x.group === sh.group).reduce((a, x) => a + x.items.length, 0)} yapım</Small>
            </View>
          )}
          <Row title={sh.title} onMore={() => router.push({ pathname: '/universe/[id]', params: { id: u.id, shelf: sh.key } })}>
            {sh.items.slice(0, 20).map((t) => <PosterCard key={t.id} t={t} width={tw} />)}
            {sh.items.length > 20 && (
              <Press accessibilityRole="button" accessibilityLabel={`${sh.title}: tümünü gör`} onPress={() => router.push({ pathname: '/universe/[id]', params: { id: u.id, shelf: sh.key } })}
                style={{ width: tw, aspectRatio: 2 / 3, borderRadius: R.md, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Feather name="arrow-right" size={20} color={C.text} />
                <Small>+{sh.items.length - 20} yapım</Small>
              </Press>
            )}
          </Row>
          </View>
        );
      })}
    </Screen>
  );
}

/** Bir rafın tamamı: sırayla, izlendi işaretli liste */
function ShelfList({ uid, shelfKey }: { uid: string; shelfKey: string }) {
  const u = UBY[uid];
  const store = useStore();
  const { state } = store;
  const toast = useToast();
  const [unseen, setUnseen] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const order = state.view === 'chrono' ? 'chrono' : 'release';
  const sh = useMemo(() => shelvesOf(u.id, order).find((x) => x.key === shelfKey), [u.id, order, shelfKey]);
  const back = () => (router.canGoBack() ? router.back() : router.replace(`/universe/${u.id}`));
  if (!sh) return <Screen><BackLink label={u.name} onPress={back} /><Empty title="Bu bölüm bulunamadı." /></Screen>;

  const all = sh.items;
  const doneN = all.filter((t) => isDone(state, t)).length;
  const markUntil = (t: Title) => {
    const upto = all.slice(0, all.findIndex((x) => x.id === t.id) + 1);
    const left = upto.filter((x) => !isDone(state, x)).length;
    if (!left) { toast('Bunlar zaten izlendi'); return; }
    confirm('Buraya kadar izledim', `“${t.title}” ve öncesi, toplam ${left} yapım izlendi olarak işaretlensin mi?`, 'İşaretle', () => {
      const n = store.markMany(upto.map((x) => x.id));
      toast(`${n} yapım izlendi olarak işaretlendi`);
    });
  };
  const numbered = all.map((t, i) => ({ t, n: i + 1 }));
  const shown = unseen ? numbered.filter((x) => !isDone(state, x.t)) : numbered;
  // MCU'da faz başlıkları
  const sections: { key: string; title: string; items: typeof shown }[] = [];
  for (const x of shown.slice(0, limit)) {
    const title = order !== 'chrono' ? phaseOf(x.t) || '' : '';
    const last = sections[sections.length - 1];
    if (last && last.title === title) last.items.push(x);
    else sections.push({ key: `${title}-${sections.length}`, title, items: [x] });
  }

  return (
    <Screen>
      <BackLink label={u.name} onPress={back} />
      {sh.split && <Small style={{ marginBottom: 4 }}>{sh.group}</Small>}
      <H1>{sh.title}</H1>
      <Small style={{ marginTop: 6 }}>{all.length} yapım · {doneN} izlendi</Small>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 16 }}>
        <Chip label="Çıkış sırası" active={order === 'release'} onPress={() => { store.setView(state.view === 'chrono' ? 'main' : state.view); setLimit(PAGE); }} />
        <Chip label="Kronolojik" active={order === 'chrono'} onPress={() => { store.setView('chrono'); setLimit(PAGE); }} />
        <Chip icon={unseen ? 'check-square' : 'square'} label="Sadece izlemediklerim" active={unseen} onPress={() => { setUnseen((x) => !x); setLimit(PAGE); }} />
      </View>
      <Small style={{ marginTop: 10, marginBottom: 4 }}>İpucu: bir yapıma uzun basarak oraya kadar olanların hepsini izlendi işaretleyebilirsin.</Small>

      {sections.length ? sections.map((sec) => (
        <View key={sec.key} style={{ marginTop: 18 }}>
          {!!sec.title && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.muted }}>{sec.title}</Text>
              <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: C.line }} />
            </View>
          )}
          {sec.items.map(({ t, n }, i) => <StoryCard key={t.id} t={t} index={n} enter={i} onMarkUntil={markUntil} />)}
        </View>
      )) : <Empty title="Bu bölümde izlemediğin yapım kalmadı." />}
      {shown.length > limit && <Btn kind="secondary" label={`Daha fazla göster (${shown.length - limit})`} style={{ marginTop: 6 }} onPress={() => setLimit((l) => l + PAGE)} />}
    </Screen>
  );
}
