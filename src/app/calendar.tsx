import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Backdrop, PageHeader } from '@/components/home';
import { usePreview } from '@/components/preview';
import { BackLink, Empty, Press, Screen, Small } from '@/components/ui';
import { episodesBetween, weekStart, ymd, type CalEp } from '@/lib/calendar';
import { isEn } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { C, F, R, alpha } from '@/lib/theme';
import { hasApi, img, today } from '@/lib/tmdb';

const GUN = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const AY = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const pad2 = (n: number) => String(n).padStart(2, '0');

/** Yayın takvimi: takip ettiğin dizilerin bu haftaki (ve seçilen haftadaki) bölümleri */
export default function Calendar() {
  const { state } = useStore();
  const { openKey } = usePreview();
  const [off, setOff] = useState(0);
  const [eps, setEps] = useState<CalEp[] | null>(null);
  const [err, setErr] = useState(false);
  const start = useMemo(() => weekStart(off), [off]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; }), [start]);
  const from = ymd(days[0]), to = ymd(days[6]);
  // izleme işaretleri değiştikçe yeniden çekmeye gerek yok; yalnızca hafta ve takip edilenler
  const trackKey = Object.keys(state.lib).join() + Object.keys(state.episodes).join() + state.list.join() + JSON.stringify(state.dropped);
  useEffect(() => {
    let alive = true; setEps(null); setErr(false);
    if (!hasApi()) { setEps([]); return; }
    episodesBetween(state, from, to).then((x) => alive && setEps(x), () => alive && setErr(true));
    return () => { alive = false; };
  }, [from, to, trackKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const t0 = today();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const label = off === 0 ? 'Bu hafta' : off === 1 ? 'Gelecek hafta' : off === -1 ? 'Geçen hafta' : `${days[0].getDate()} ${AY[days[0].getMonth()]} haftası`;
  const range = `${days[0].getDate()} ${AY[days[0].getMonth()]} – ${days[6].getDate()} ${AY[days[6].getMonth()]}`;

  return (
    <Screen>
      <Backdrop />
      <BackLink label="Geri" onPress={back} />
      <PageHeader bold={isEn ? 'Release calendar' : 'Yayın'} light={isEn ? undefined : 'takvimi'} sub="Takip ettiğin dizilerin yeni bölümleri, gün gün." />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, padding: 6, borderRadius: R.lg, backgroundColor: C.card }}>
        <Press accessibilityRole="button" accessibilityLabel="Önceki hafta" onPress={() => setOff((v) => v - 1)} style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: C.raised }}>
          <Feather name="chevron-left" size={20} color={C.text} />
        </Press>
        <Press accessibilityRole="button" accessibilityLabel="Bu haftaya dön" onPress={() => setOff(0)} scaleTo={1} style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.text }}>{label}</Text>
          <Small>{range}</Small>
        </Press>
        <Press accessibilityRole="button" accessibilityLabel="Sonraki hafta" onPress={() => setOff((v) => v + 1)} style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: C.raised }}>
          <Feather name="chevron-right" size={20} color={C.text} />
        </Press>
      </View>

      {err ? <Empty icon="wifi-off" title="Takvim yüklenemedi." text="İnternet bağlantını kontrol edip tekrar dene." />
        : eps === null ? <View style={{ paddingVertical: 60, alignItems: 'center' }}><ActivityIndicator color={C.accentSoft} /><Small style={{ marginTop: 12 }}>Dizilerin taranıyor…</Small></View>
        : !eps.length ? <Empty icon="calendar" title={off === 0 ? 'Bu hafta yeni bölüm yok.' : 'Bu hafta için bölüm yok.'} text="Bir dizinin bölümünü işaretlediğinde ya da diziyi kaydettiğinde yeni bölümleri burada görürsün." action="Keşfet'e git" onAction={() => router.push('/explore')} />
        : days.map((d, i) => {
          const key = ymd(d);
          const list = eps.filter((x) => x.date === key);
          if (!list.length) return null;
          const isToday = key === t0;
          return (
            <View key={key} style={{ marginTop: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Text accessibilityRole="header" style={{ fontFamily: F.bold, fontSize: 17, color: isToday ? C.accent : C.text }}>{isToday ? 'Bugün' : GUN[i]}</Text>
                <Text style={{ fontFamily: F.regular, fontSize: 14, color: C.muted }}>{d.getDate()} {AY[d.getMonth()]}</Text>
              </View>
              <View style={{ borderRadius: R.lg, backgroundColor: C.card, overflow: 'hidden' }}>
                {list.map((x, n) => {
                  const uri = img(x.p, 'w185');
                  const future = x.date > t0;
                  return (
                    <Press key={`${x.key}-${x.s}-${x.e}`} accessibilityRole="button" accessibilityLabel={`${x.title}, ${x.s}. sezon ${x.e}. bölüm${x.seen ? ', izlendi' : ''}`}
                      onPress={() => openKey(x.key, { title: x.title, year: x.year, p: x.p })} scaleTo={0.99}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: n ? StyleSheet.hairlineWidth : 0, borderTopColor: C.line }}>
                      <View style={{ width: 44, aspectRatio: 2 / 3, borderRadius: 8, overflow: 'hidden', backgroundColor: C.raised }}>
                        {uri && <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontFamily: F.semibold, fontSize: 15, color: C.text }}>{x.title}</Text>
                        <Text numberOfLines={1} style={{ marginTop: 3, fontFamily: F.regular, fontSize: 13, color: C.muted }}>S{pad2(x.s)} · B{pad2(x.e)}{x.name && !/^\d+\. bölüm$|^Episode \d+$|^Bölüm \d+$/i.test(x.name) ? ` · ${x.name}` : ''}</Text>
                      </View>
                      {x.seen ? <Feather name="check-circle" size={19} color={C.green} />
                        : future ? <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99, backgroundColor: C.raised }}><Text style={{ fontFamily: F.semibold, fontSize: 11.5, color: C.muted }}>Yakında</Text></View>
                        : <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99, backgroundColor: alpha(C.accent, 0.18) }}><Text style={{ fontFamily: F.bold, fontSize: 11.5, color: C.accent }}>Yeni</Text></View>}
                    </Press>
                  );
                })}
              </View>
            </View>
          );
        })}
    </Screen>
  );
}
