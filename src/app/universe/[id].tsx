import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StoryCard, Wordmark } from '@/components/media';
import { BackLink, Btn, Empty, Eyebrow, H1, H3, Muted, Panel, Pills, Press, Ring, Screen, Segmented, Small, useLayout, useToast } from '@/components/ui';
import { CATEGORY_TR, GROUPS, UBY, VIEWS, VIEW_HELP, VIEW_TR, branchesOf, phaseOf, viewTitles } from '@/lib/catalog';
import { duration } from '@/lib/format';
import { fraction, isDone, isStarted, pctOf, remaining } from '@/lib/progress';
import { useStore } from '@/lib/store';
import { C, F, R, alpha } from '@/lib/theme';
import type { ListView } from '@/lib/types';

const PAGE = 60;

export default function UniverseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const { state } = store;
  const toast = useToast();
  const { tablet } = useLayout();
  const [unseen, setUnseen] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const u = UBY[id || ''];

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
      <BackLink label="Evrenler" onPress={() => (router.canGoBack() ? router.back() : router.replace('/universes'))} />

      <View style={{ borderRadius: R.xl, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: alpha(u.color, 0.35), backgroundColor: C.card }}>
        <LinearGradient colors={[alpha(u.color, 0.3), 'transparent']} start={{ x: 1, y: 0 }} end={{ x: 0.2, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={{ padding: tablet ? 28 : 20, flexDirection: 'row', gap: 18, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Wordmark u={u} />
            <H1 style={{ marginTop: 14 }}>{u.name}</H1>
            <Muted style={{ marginTop: 6 }}>{u.desc}</Muted>
            <Small style={{ marginTop: 8 }}>{CATEGORY_TR[u.category]} · {all.length} yapım · {duration(p.left)} kaldı</Small>
            <Btn style={{ marginTop: 16, alignSelf: 'flex-start' }} kind={following ? 'success' : 'secondary'} icon={following ? 'check' : 'plus'}
              label={following ? 'Takip ediliyor' : 'Evreni takip et'}
              onPress={() => { store.toggleFollow(u.id); toast(following ? `${u.name} takipten çıkarıldı` : `${u.name} takip ediliyor`); }} />
          </View>
          <View style={{ alignItems: 'center' }}>
            <Ring pct={p.pct} size={tablet ? 110 : 84} color={u.color} />
            <Small style={{ marginTop: 6 }}>{p.done} / {p.total}</Small>
          </View>
        </View>
      </View>

      <Panel style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ flex: 1 }}>
          <Eyebrow style={{ color: u.color }}>{n ? 'Sıradaki' : 'Rota tamamlandı'}</Eyebrow>
          <H3 style={{ marginTop: 4 }} numberOfLines={2}>{n ? n.title : 'Bu rotadaki yolculuğunu tamamladın.'}</H3>
        </View>
        {n ? <Btn icon="play" label="Devam et" onPress={() => router.push(`/title/${n.id}`)} /> : <Feather name="award" size={26} color={C.green} />}
      </Panel>

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
        <View style={{ width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: unseen ? u.color : 'transparent', borderWidth: unseen ? 0 : 1.5, borderColor: C.line }}>
          {unseen && <Feather name="check" size={14} color={C.bg} />}
        </View>
        <Text style={{ flex: 1, fontFamily: F.medium, fontSize: 14, color: C.text }}>Sadece izlemediklerim</Text>
        <Small>{shown.length} yapım</Small>
      </Press>

      {sections.length ? sections.map((sec) => (
        <View key={sec.key} style={{ marginTop: 18 }}>
          {!!sec.title && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.muted }}>{sec.title}</Text>
              <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: C.line }} />
            </View>
          )}
          {sec.items.map(({ t, n }) => <StoryCard key={t.id} t={t} index={n} />)}
        </View>
      )) : <Empty title={unseen ? 'Bu listede izlemediğin yapım kalmadı.' : 'Bu görünümde yapım yok.'} text={unseen ? undefined : 'Tümü görünümünü dene.'} />}
      {shown.length > limit && <Btn kind="secondary" label={`Daha fazla göster (${shown.length - limit})`} style={{ marginTop: 6 }} onPress={() => setLimit((l) => l + PAGE)} />}
    </Screen>
  );
}

