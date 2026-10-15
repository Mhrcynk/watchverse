import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { BackLink, H1, H3, Muted, Panel, Press, Screen, SectionHead, Small, useLayout } from '@/components/ui';
import { routeOf } from '@/lib/library';
import { fullStats, hoursText } from '@/lib/stats';
import { useStore } from '@/lib/store';
import { Backdrop, PageHeader } from '@/components/home';
import { C, F, R, alpha } from '@/lib/theme';

type Metric = 'minutes' | 'eps' | 'films';
const METRIC_TR: Record<Metric, string> = { minutes: 'Saat', eps: 'Bölüm', films: 'Film' };

function Tile({ value, label, wide }: { value: string; label: string; wide: boolean }) {
  return (
    <Panel style={{ flexGrow: 1, flexBasis: wide ? '22%' : '45%', padding: 16 }}>
      <Text style={{ fontFamily: F.bold, fontSize: 26, color: C.text, letterSpacing: -0.8 }}>{value}</Text>
      <Small style={{ marginTop: 2 }}>{label}</Small>
    </Panel>
  );
}

/** Son 12 ayın sütun grafiği */
function Months({ data, metric }: { data: ReturnType<typeof fullStats>['months']; metric: Metric }) {
  const val = (d: (typeof data)[number]) => (metric === 'minutes' ? d.minutes / 60 : metric === 'eps' ? d.eps : d.films);
  const max = Math.max(1, ...data.map(val));
  const H = 140;
  const fmt = (v: number) => (metric === 'minutes' ? (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10) : Math.round(v)).toLocaleString('tr-TR');
  const last = data.length - 1;
  return (
    <View>
      <View style={{ height: H + 22, flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
        {data.map((d, i) => {
          const v = val(d);
          const h = v > 0 ? Math.max(4, (v / max) * H) : 2;
          return (
            <View key={d.key} accessible accessibilityLabel={`${d.label}: ${fmt(v)} ${METRIC_TR[metric].toLocaleLowerCase('tr')}`} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
              {v > 0 && <Text style={{ fontFamily: F.semibold, fontSize: 10, color: i === last ? C.text : C.muted, marginBottom: 4 }}>{fmt(v)}</Text>}
              <View style={{ width: '100%', maxWidth: 26, height: h, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: v > 0 ? (i === last ? C.accent : alpha(C.accent, 0.55)) : C.line }} />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
        {data.map((d, i) => <Text key={d.key} style={{ flex: 1, textAlign: 'center', fontFamily: F.medium, fontSize: 10.5, color: i === last ? C.text : C.dim }}>{d.label}</Text>)}
      </View>
    </View>
  );
}

function Bars({ items }: { items: { label: string; n: number; color?: string; onPress?: () => void }[] }) {
  const max = Math.max(1, ...items.map((x) => x.n));
  return (
    <View style={{ gap: 12 }}>
      {items.map((x) => (
        <Press key={x.label} accessibilityRole={x.onPress ? 'button' : undefined} disabled={!x.onPress} onPress={x.onPress} scaleTo={x.onPress ? 0.98 : 1}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.medium, fontSize: 14, color: C.text }}>{x.label}</Text>
            <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.muted }}>{x.n.toLocaleString('tr-TR')}</Text>
          </View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: C.line, overflow: 'hidden' }}>
            <View style={{ width: `${(x.n / max) * 100}%`, height: '100%', borderRadius: 3, backgroundColor: x.color || C.accent }} />
          </View>
        </Press>
      ))}
    </View>
  );
}

export default function Stats() {
  const { state } = useStore();
  const { tablet } = useLayout();
  const s = useMemo(() => fullStats(state), [state]);
  const [metric, setMetric] = useState<Metric>('minutes');
  const year = new Date().getFullYear();
  const days = Math.floor(s.minutes / 60 / 24);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

  return (
    <Screen><Backdrop />
      <BackLink label="Profil" onPress={back} />
      <PageHeader bold="İstatistiklerin" />
      <Muted style={{ marginTop: 6 }}>{s.minutes ? `Toplam ${hoursText(s.minutes)} izledin${days >= 1 ? `; bu ${days} tam güne denk geliyor` : ''}.` : 'İzlediklerini işaretledikçe burası dolacak.'}</Muted>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 }}>
        <Tile wide={tablet} value={hoursText(s.minutes)} label="Toplam izleme" />
        <Tile wide={tablet} value={s.films.toLocaleString('tr-TR')} label="Film" />
        <Tile wide={tablet} value={s.eps.toLocaleString('tr-TR')} label="Bölüm" />
        <Tile wide={tablet} value={s.seriesDone.toLocaleString('tr-TR')} label="Bitirilen dizi" />
      </View>

      <SectionHead title={`${year} yılı`} note={s.year.minutes ? hoursText(s.year.minutes) : undefined} />
      <Panel>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 10 }}>
          <H3>Son 12 ay</H3>
          <View style={{ flexDirection: 'row', gap: 4, padding: 3, borderRadius: R.md, backgroundColor: C.bg }}>
            {(Object.keys(METRIC_TR) as Metric[]).map((m) => (
              <Press key={m} accessibilityRole="button" accessibilityState={{ selected: metric === m }} aria-selected={metric === m} onPress={() => setMetric(m)} scaleTo={0.96}
                style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.sm, backgroundColor: metric === m ? C.raised : 'transparent' }}>
                <Text style={{ fontFamily: F.semibold, fontSize: 12.5, color: metric === m ? C.text : C.dim }}>{METRIC_TR[m]}</Text>
              </Press>
            ))}
          </View>
        </View>
        <Months data={s.months} metric={metric} />
        <Small style={{ marginTop: 14 }}>Bu yıl {s.year.films} film ve {s.year.eps} bölüm. Aylık grafik, izlediklerini işaretlediğin tarihe göre bu sürümden itibaren dolar; daha önceki işaretler toplamlarda var ama aylara dağıtılamıyor.</Small>
      </Panel>

      {s.genres.length > 0 && (
        <>
          <SectionHead title="En çok izlediğin türler" />
          <Panel><Bars items={s.genres.map((g) => ({ label: g.name, n: g.n }))} /></Panel>
          <Small style={{ marginTop: 6 }}>Kütüphanene eklediğin yapımlardan hesaplanır.</Small>
        </>
      )}

      {s.universes.length > 0 && (
        <>
          <SectionHead title="En çok izlediğin evrenler" note="yapım sayısı" />
          <Panel><Bars items={s.universes.map((u) => ({ label: u.name, n: u.n, color: u.color, onPress: () => router.push(`/universe/${u.id}`) }))} /></Panel>
        </>
      )}

      {s.topSeries.length > 0 && (
        <>
          <SectionHead title="En çok bölümünü izlediğin diziler" />
          <Panel><Bars items={s.topSeries.map((x) => ({ label: x.title, n: x.eps, onPress: () => router.push((x.key.includes(':') ? routeOf(x.key) : `/title/${x.key}`) as never) }))} /></Panel>
        </>
      )}

      {s.rated > 0 && (
        <>
          <SectionHead title="Puanların" />
          <Panel>
            <Text style={{ fontFamily: F.bold, fontSize: 26, color: C.amber }}>★ {s.avgRating!.toFixed(1).replace('.', ',')}</Text>
            <Small style={{ marginTop: 2 }}>{s.rated} yapıma verdiğin puanların ortalaması</Small>
          </Panel>
        </>
      )}
    </Screen>
  );
}
