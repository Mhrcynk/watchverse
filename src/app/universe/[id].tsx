import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Wordmark, TitleRow } from '@/components/media';
import { BackLink, Btn, Empty, Eyebrow, H1, H3, Muted, Panel, Pills, Ring, Screen, Segmented, Small, useLayout, useToast } from '@/components/ui';
import { CATEGORY_TR, MODE_HELP, MODE_TR, ORDER_TR, UBY, branchesOf, inMode, routeTitles } from '@/lib/catalog';
import { duration } from '@/lib/format';
import { nextUp, universeProgress } from '@/lib/progress';
import { useStore } from '@/lib/store';
import { C, F, R, alpha } from '@/lib/theme';
import type { Mode, Order } from '@/lib/types';

const PAGE = 60;

export default function UniverseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const { state } = store;
  const toast = useToast();
  const { tablet } = useLayout();
  const [type, setType] = useState<'all' | 'Film' | 'Dizi' | 'Special'>('all');
  const [limit, setLimit] = useState(PAGE);
  const u = UBY[id || ''];

  // Evren sayfası açılışta tüm rotaları gösterir; seçilen rota hatırlanır
  const branch = u ? state.branches[u.id] || 'all' : 'all';
  const branches = useMemo(() => (u ? branchesOf(u.id) : []), [u]);
  const all = useMemo(() => (u ? routeTitles(u.id, branch, state.mode, state.order) : []), [u, branch, state.mode, state.order]);
  if (!u) return <Screen><BackLink label="Evrenler" onPress={() => router.back()} /><Empty title="Bu evren bulunamadı." action="Evrenlere dön" onAction={() => router.replace('/universes')} /></Screen>;

  const p = universeProgress(state, u.id);
  const n = nextUp(state, u.id);
  const following = state.follow.includes(u.id);
  const shown = all.filter((t) => type === 'all' || t.type === type);
  const types = (['Film', 'Dizi', 'Special'] as const).filter((k) => all.some((t) => t.type === k));

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
            <Small style={{ marginTop: 8 }}>{CATEGORY_TR[u.category]} · {all.length} yapım bu rotada · {duration(p.left)} kaldı</Small>
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

      {branches.length > 1 && (
        <View style={{ marginTop: 24 }}>
          <Text style={labelStyle}>İzleme rotası</Text>
          <Pills value={branch} onChange={(b) => { store.setBranch(u.id, b); setLimit(PAGE); }}
            options={[{ id: 'all', label: `Tüm rotalar · ${routeTitles(u.id, 'all', null, 'release').length}` }, ...branches.map((b) => ({ id: b.id, label: `${b.name} · ${b.count}` }))]} />
        </View>
      )}

      <View style={{ marginTop: 20, gap: 14, flexDirection: tablet ? 'row' : 'column' }}>
        <View style={{ flex: 1 }}>
          <Text style={labelStyle}>İzleme sırası</Text>
          <Segmented<Order> label="İzleme sırası" value={state.order} onChange={store.setOrder}
            options={(['recommended', 'release', 'chrono'] as Order[]).map((o) => ({ id: o, label: ORDER_TR[o] }))} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={labelStyle}>İzleme modu</Text>
          <Segmented<Mode> label="İzleme modu" value={state.mode} onChange={store.setMode}
            options={(['essential', 'recommended', 'complete'] as Mode[]).map((m) => ({ id: m, label: MODE_TR[m] }))} />
        </View>
      </View>
      <Small style={{ marginTop: 10 }}>
        {MODE_HELP[state.mode]} {state.order === 'chrono' ? 'Evren içindeki zamanı belli olan yapımlar önce gelir; belirsiz olanlar yayın sırasıyla sona eklenir.' : state.order === 'recommended' ? 'Önerilen sırada, sıradaki öneri ön koşulları gözetir.' : ''}
      </Small>

      {types.length > 1 && (
        <View style={{ marginTop: 20 }}>
          <Pills value={type} onChange={(v) => { setType(v); setLimit(PAGE); }}
            options={[{ id: 'all' as const, label: 'Tümü' }, ...types.map((k) => ({ id: k, label: k === 'Film' ? 'Filmler' : k === 'Dizi' ? 'Diziler' : 'Özel yapımlar' }))]} />
        </View>
      )}

      <View style={{ marginTop: 10 }}>
        {shown.length ? shown.slice(0, limit).map((t, i) => (
          <View key={t.id} style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.lineSoft }}>
            <TitleRow t={t} index={i + 1} dim={!inMode(t, state.mode)} />
          </View>
        )) : <Empty title="Bu filtrede yapım yok." text="Başka bir rota ya da tür seç." />}
      </View>
      {shown.length > limit && <Btn kind="secondary" label={`Daha fazla göster (${shown.length - limit})`} style={{ marginTop: 18 }} onPress={() => setLimit((l) => l + PAGE)} />}

      <Small style={{ marginTop: 22 }}>Farklı süreklilikler ayrı rotalarda yer alır. Soluk görünen yapımlar seçili modun dışında; ilerleme yüzdesine katılmaz.</Small>
    </Screen>
  );
}

const labelStyle = { fontFamily: F.medium, fontSize: 13, color: C.muted, marginBottom: 8 } as const;
