import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StoryCard, UniverseLogo } from '@/components/media';
import { TicketCard } from '@/components/home';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { backdropOf } from '@/lib/logos';
import { BackLink, Btn, Empty, Eyebrow, H1, H3, Muted, Panel, Pills, Press, Ring, Screen, Segmented, Small, useLayout, useToast } from '@/components/ui';
import { CATEGORY_TR, GROUPS, TYPE_TR, UBY, VIEWS, VIEW_HELP, VIEW_TR, branchesOf, phaseOf, posterUrl, viewTitles } from '@/lib/catalog';
import { duration } from '@/lib/format';
import { fraction, isDone, isStarted, pctOf, remaining } from '@/lib/progress';
import { useStore } from '@/lib/store';
import { C, F, R, alpha } from '@/lib/theme';
import type { ListView, Title } from '@/lib/types';
import { confirm } from '@/lib/confirm';

const PAGE = 60;

export default function UniverseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const u = UBY[id || ''];
  const store = useStore();
  const { state } = store;
  const toast = useToast();
  const { tablet, pad, width } = useLayout();
  const insets = useSafeAreaInsets();
  const bd = u ? backdropOf(u.id) : null;
  const [unseen, setUnseen] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  // Evren sayfası açılışta tüm rotaları gösterir; seçilen rota hatırlanır
  const branches = useMemo(() => (u ? branchesOf(u.id) : []), [u]);
  const view = state.view;
  // Bu görünümde yapımı olan rotalar; ana rota başta
  const visibleBranches = useMemo(() => (u ? branches.filter((b) => viewTitles(u.id, b.id, view).length).sort((a, b) => (a.id === u.defaultBranch ? -1 : b.id === u.defaultBranch ? 1 : 0)) : []), [u, branches, view]);
  const saved = u ? state.branches[u.id] || 'all' : 'all';
  const branch = saved !== 'all' && !visibleBranches.some((b) => b.id === saved) ? 'all' : saved;
  const all = useMemo(() => {
    if (!u) return [];
    if (branch !== 'all' || visibleBranches.length < 2) return viewTitles(u.id, branch, view);
    // Tüm rotalar: her rota kendi bölümünde; ana rota en üstte
    return visibleBranches.flatMap((b) => viewTitles(u.id, b.id, view));
  }, [u, branch, visibleBranches, view]);
  if (!u) return <Screen><BackLink label="Evrenler" onPress={() => router.back()} /><Empty title="Bu evren bulunamadı." action="Evrenlere dön" onAction={() => router.replace('/universes')} /></Screen>;

  // İlerleme ve "sıradaki" ekrandaki listeye göre
  const doneN = all.filter((t) => isDone(state, t)).length;
  const p = { done: doneN, total: all.length, pct: pctOf(all.reduce((x, t) => x + fraction(state, t), 0), all.length, doneN), left: all.reduce((x, t) => x + remaining(state, t), 0) };
  const n = all.find((t) => isStarted(state, t)) || all.find((t) => !isDone(state, t)) || null;
  const following = state.follow.includes(u.id);
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
  // Bölüm başlıkları: tüm rotalarda rota adı, MCU'da faz
  const sections: { key: string; title: string; items: typeof shown }[] = [];
  for (const x of shown.slice(0, limit)) {
    const multi = branch === 'all' && visibleBranches.length > 1;
    const ph = view !== 'chrono' ? phaseOf(x.t) : null;
    const title = [multi ? GROUPS[x.t.branch] || '' : '', ph || ''].filter(Boolean).join(' · ');
    const last = sections[sections.length - 1];
    if (last && last.title === title) last.items.push(x);
    else sections.push({ key: `${title}-${sections.length}`, title, items: [x] });
  }

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
          <Small>{CATEGORY_TR[u.category]} · {all.length} yapım · {duration(p.left)} kaldı</Small>
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
            <H3 style={{ flex: 1 }}>Bu rotadaki yolculuğunu tamamladın.</H3>
          </Panel>
        )}
      </View>

      <View style={{ marginTop: 22 }}>
        <Segmented<ListView> label="Liste görünümü" value={view} onChange={(v) => { store.setView(v); setLimit(PAGE); }}
          options={VIEWS.map((v) => ({ id: v, label: VIEW_TR[v] }))} />
        <Small style={{ marginTop: 8 }}>{VIEW_HELP[view]}</Small>
      </View>

      {visibleBranches.length > 1 && (
        <View style={{ marginTop: 14 }}>
          <Pills value={branch} onChange={(b) => { store.setBranch(u.id, b); setLimit(PAGE); }}
            options={[{ id: 'all', label: 'Tüm rotalar' }, ...visibleBranches.map((b) => ({ id: b.id, label: b.name }))]} />
        </View>
      )}

      <Press accessibilityRole="switch" accessibilityState={{ checked: unseen }} onPress={() => { setUnseen((x) => !x); setLimit(PAGE); }}
        style={{ marginTop: 16, marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: unseen ? C.accent : 'transparent', borderWidth: unseen ? 0 : 1.5, borderColor: C.line }}>
          {unseen && <Feather name="check" size={14} color={C.onAccent} />}
        </View>
        <Text style={{ flex: 1, fontFamily: F.medium, fontSize: 14, color: C.text }}>Sadece izlemediklerim</Text>
        <Small>{shown.length} yapım</Small>
      </Press>
      <Small style={{ marginBottom: 4 }}>İpucu: bir yapıma uzun basarak oraya kadar olanların hepsini izlendi işaretleyebilirsin.</Small>

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
      )) : <Empty title={unseen ? 'Bu listede izlemediğin yapım kalmadı.' : 'Bu görünümde yapım yok.'} text={unseen ? undefined : 'Tümü görünümünü dene.'} />}
      {shown.length > limit && <Btn kind="secondary" label={`Daha fazla göster (${shown.length - limit})`} style={{ marginTop: 6 }} onPress={() => setLimit((l) => l + PAGE)} />}
    </Screen>
  );
}

