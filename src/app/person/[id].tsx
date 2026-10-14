import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { Backdrop } from '@/components/home';
import { MediaCard } from '@/components/media';
import { usePreview } from '@/components/preview';
import { Row, TItemTile, useTileW } from '@/components/rows';
import { BackLink, Empty, Grid, Press, Screen, Small, useLayout, SkeletonRows } from '@/components/ui';
import { C, F, R } from '@/lib/theme';
import { img, person, type PersonDetail } from '@/lib/tmdb';

const AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const dateTr = (d: string) => `${Number(d.slice(8, 10))} ${AY[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
const age = (born: string, until?: string | null) => {
  const a = new Date(born), b = until ? new Date(until) : new Date();
  return b.getFullYear() - a.getFullYear() - (b.getMonth() < a.getMonth() || (b.getMonth() === a.getMonth() && b.getDate() < a.getDate()) ? 1 : 0);
};

/** Oyuncu / yönetmen sayfası */
export default function PersonPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { open } = usePreview();
  const { posterCols } = useLayout();
  const tw = useTileW();
  const [d, setD] = useState<PersonDetail | null>(null);
  const [err, setErr] = useState(false);
  const [more, setMore] = useState(false);
  const [all, setAll] = useState(false);
  useEffect(() => { setD(null); setErr(false); person(Number(id)).then(setD, () => setErr(true)); }, [id]);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/explore'));

  if (err) return <Screen><BackLink label="Geri" onPress={back} /><Empty icon="wifi-off" title="Kişi bilgisi alınamadı." text="İnternet bağlantını kontrol edip tekrar dene." /></Screen>;
  if (!d) return <Screen><BackLink label="Geri" onPress={back} /><SkeletonRows n={5} /></Screen>;

  const uri = img(d.p, 'w342');
  const facts = [d.dept, d.born ? `${dateTr(d.born)}${d.died ? '' : ` (${age(d.born)} yaşında)`}` : null, d.died && d.born ? `Ölüm: ${dateTr(d.died)} (${age(d.born, d.died)})` : null, d.place].filter(Boolean) as string[];
  const known = d.acting.slice(0, 15);
  const byDate = [...d.acting].sort((a, b) => (b.date || '0').localeCompare(a.date || '0'));
  const shown = all ? byDate : byDate.slice(0, posterCols * 4);

  return (
    <Screen>
      <Backdrop />
      <BackLink label="Geri" onPress={back} />
      <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
        <View style={{ width: 112, height: 112, borderRadius: 56, overflow: 'hidden', backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }}>
          {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : <Feather name="user" size={40} color={C.dim} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={{ fontFamily: F.heavy, fontSize: 26, lineHeight: 31, color: C.text, letterSpacing: -0.6 }}>{d.name}</Text>
          {facts.map((f) => <Small key={f} style={{ marginTop: 3 }}>{f}</Small>)}
        </View>
      </View>

      {!!d.bio && (
        <Press accessibilityRole="button" accessibilityLabel={more ? 'Biyografiyi kısalt' : 'Biyografinin devamı'} onPress={() => setMore((v) => !v)} scaleTo={1}
          style={{ marginTop: 18, padding: 16, borderRadius: R.lg, backgroundColor: C.card }}>
          <Text numberOfLines={more ? undefined : 5} style={{ fontFamily: F.regular, fontSize: 14.5, lineHeight: 22, color: '#D8D8DE' }}>{d.bio}</Text>
          <Text style={{ marginTop: 8, fontFamily: F.semibold, fontSize: 13, color: C.accent }}>{more ? 'Daha az' : 'Devamı'}</Text>
        </Press>
      )}

      {known.length > 0 && (
        <Row title="En bilinen yapımları">
          {known.map((x, i) => <TItemTile key={x.key} x={x} width={tw} index={i} />)}
        </Row>
      )}
      {d.directing.length > 0 && (
        <Row title="Yönettikleri" note={`${d.directing.length} yapım`}>
          {d.directing.slice(0, 20).map((x, i) => <TItemTile key={x.key} x={x} width={tw} index={i} />)}
        </Row>
      )}

      {byDate.length > 0 && (
        <View style={{ marginTop: 28 }}>
          <Text accessibilityRole="header" style={{ fontFamily: F.bold, fontSize: 19, color: C.text, marginBottom: 12 }}>Tüm yapımları <Text style={{ fontFamily: F.regular, color: C.muted }}>{byDate.length}</Text></Text>
          <Grid items={shown} cols={posterCols} gap={14} rowGap={22} keyOf={(x) => x.key}
            render={(x, cw) => <MediaCard uri={img(x.p, 'w342')} title={x.title} sub={[x.year, x.role].filter(Boolean).join(' · ')} width={cw} onPress={() => open(x)} />} />
          {!all && byDate.length > shown.length && (
            <Press accessibilityRole="button" onPress={() => setAll(true)} style={{ marginTop: 18, height: 46, borderRadius: R.md, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: F.semibold, fontSize: 14.5, color: C.text }}>Hepsini göster ({byDate.length})</Text>
            </Press>
          )}
        </View>
      )}
      {!byDate.length && !d.directing.length && <Empty icon="film" title="Yapım bilgisi yok." />}
    </Screen>
  );
}
