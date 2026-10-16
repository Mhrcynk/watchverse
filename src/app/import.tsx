import { pickDataFile } from '@/lib/backup-file';
import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { BackLink, Bar, Btn, H3, Muted, Panel, Screen, SectionHead, Small, useToast } from '@/components/ui';
import { matchAll, readFiles, unpack, type Matched, type Raw, type Source } from '@/lib/importer';
import { useStore } from '@/lib/store';
import { C, F } from '@/lib/theme';
import { Backdrop, PageHeader } from '@/components/home';
import { hasApi } from '@/lib/tmdb';

type Step = { s: 'pick' } | { s: 'busy'; label: string; done: number; total: number } | { s: 'review'; source: Source; ok: Matched[]; miss: Raw[] } | { s: 'done'; n: number };
const SOURCE_TR: Record<Source, string> = { letterboxd: 'Letterboxd', tvtime: 'TV Time', csv: 'CSV dosyası' };

const pickFile = () => pickDataFile(['application/zip', 'text/csv', 'text/comma-separated-values']);

const HOW: { title: string; steps: string }[] = [
  { title: 'Letterboxd', steps: 'Letterboxd\'da Settings → Data → Export your data. İnen zip dosyasını burada seç. İzlediğin filmler, puanların ve izleme listen aktarılır.' },
  { title: 'TV Time', steps: 'TV Time\'dan kişisel verilerinin kopyasını iste (uygulamanın destek ya da gizlilik bölümünden). Gelen zip dosyasını burada seç. İzlediğin bölümler ve filmler aktarılır.' },
  { title: 'Kendi listen', steps: 'İlk satırında "ad", "yıl" ve "tür" (film ya da dizi) yazan bir CSV dosyası. İstersen "puan" sütunu da ekleyebilirsin.' },
];

export default function Import() {
  const store = useStore();
  const toast = useToast();
  const [step, setStep] = useState<Step>({ s: 'pick' });
  const [withPlan, setWithPlan] = useState(true);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

  async function start() {
    let f;
    try { f = await pickFile(); } catch { toast('Dosya okunamadı veya çok büyük.'); return; }
    if (!f) return;
    setStep({ s: 'busy', label: 'Dosya okunuyor…', done: 0, total: 0 });
    let parsed;
    try { parsed = readFiles(unpack(f.name, f.data)); } catch { toast('Dosya açılamadı. Zip ya da CSV dosyası seçtiğinden emin ol.'); setStep({ s: 'pick' }); return; }
    if (!parsed.items.length) { toast('Dosyada aktarılacak bir kayıt bulunamadı.'); setStep({ s: 'pick' }); return; }
    setStep({ s: 'busy', label: 'Yapımlar eşleştiriliyor…', done: 0, total: parsed.items.length });
    const r = await matchAll(parsed.items, (done, total) => setStep({ s: 'busy', label: 'Yapımlar eşleştiriliyor…', done, total }));
    setStep({ s: 'review', source: parsed.source, ...r });
  }

  function apply(ok: Matched[]) {
    const items = ok
      .filter((m) => withPlan || !m.raw.plan)
      .map((m) => m.raw.kind === 'movie'
        ? { key: m.key, lib: m.lib, watchedAt: m.raw.plan ? undefined : m.raw.at || Date.now(), dated: !!m.raw.at, rating: m.raw.rating || undefined, plan: m.raw.plan }
        : { key: m.key, lib: m.lib, eps: m.eps, plan: m.raw.plan });
    const n = store.importMany(items);
    setStep({ s: 'done', n });
  }

  if (!hasApi()) {
    return <Screen><Backdrop /><BackLink label="Profil" onPress={back} /><PageHeader bold="İçe aktar" /><Panel style={{ marginTop: 20 }}><Muted>İçe aktarma için arama sunucusu gerekiyor; şu an kurulu değil.</Muted></Panel></Screen>;
  }

  return (
    <Screen><Backdrop />
      <BackLink label="Profil" onPress={back} />
      <PageHeader bold="Başka uygulamadan aktar" />
      <Muted style={{ marginTop: 6 }}>Geçmişini tek seferde getir. Var olan kayıtların silinmez; yalnızca eksikler eklenir.</Muted>

      {step.s === 'pick' && (
        <>
          <Btn icon="upload" label="Dosya seç (zip ya da CSV)" style={{ marginTop: 20 }} onPress={start} />
          <SectionHead title="Dosyayı nereden alırım?" />
          <View style={{ gap: 12 }}>
            {HOW.map((h) => <Panel key={h.title}><H3>{h.title}</H3><Small style={{ marginTop: 6, color: C.muted, lineHeight: 19 }}>{h.steps}</Small></Panel>)}
          </View>
        </>
      )}

      {step.s === 'busy' && (
        <Panel style={{ marginTop: 20 }}>
          <H3>{step.label}</H3>
          {step.total > 0 && (
            <>
              <View style={{ marginTop: 14 }}><Bar pct={(step.done / step.total) * 100} /></View>
              <Small style={{ marginTop: 8 }}>{step.done} / {step.total}. Çok kayıt varsa birkaç dakika sürebilir; ekranı kapatma.</Small>
            </>
          )}
        </Panel>
      )}

      {step.s === 'review' && (() => {
        const movies = step.ok.filter((m) => m.raw.kind === 'movie' && !m.raw.plan).length;
        const plan = step.ok.filter((m) => m.raw.plan).length;
        const shows = step.ok.filter((m) => m.raw.kind === 'tv');
        const eps = shows.reduce((n, m) => n + (m.eps?.length || 0), 0);
        return (
          <>
            <Panel style={{ marginTop: 20 }}>
              <Small style={{ color: C.accentSoft }}>{SOURCE_TR[step.source]} dosyası</Small>
              <H3 style={{ marginTop: 6 }}>{step.ok.length} yapım bulundu</H3>
              <View style={{ gap: 6, marginTop: 10 }}>
                {movies > 0 && <Row icon="film" text={`${movies} izlenmiş film`} />}
                {shows.length > 0 && <Row icon="tv" text={`${shows.length} dizi · ${eps} bölüm`} />}
                {plan > 0 && <Row icon="bookmark" text={`${plan} izleme listesinde`} />}
              </View>
              {plan > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 }}>
                  <Small style={{ flex: 1, color: C.text }}>İzleme listesini de ekle</Small>
                  <Switch value={withPlan} onValueChange={setWithPlan} trackColor={{ true: C.accent, false: C.line }} thumbColor="#fff" {...({ activeThumbColor: "#fff" } as object)} accessibilityLabel="İzleme listesini de ekle" />
                </View>
              )}
              <Btn label="İçe aktar" style={{ marginTop: 16 }} disabled={!step.ok.length} onPress={() => apply(step.ok)} />
            </Panel>
            {step.miss.length > 0 && (
              <>
                <SectionHead title="Eşleşmeyenler" note={`${step.miss.length} kayıt`} />
                <Panel>
                  <Small style={{ color: C.muted }}>Bunları bulamadım; istersen Keşfet&apos;te arayıp elle ekleyebilirsin.</Small>
                  <Text style={{ marginTop: 10, fontFamily: F.regular, fontSize: 13.5, lineHeight: 20, color: C.text }}>{step.miss.slice(0, 40).map((r) => r.name + (r.year ? ` (${r.year})` : '')).join(', ')}{step.miss.length > 40 ? ` ve ${step.miss.length - 40} kayıt daha` : ''}</Text>
                </Panel>
              </>
            )}
          </>
        );
      })()}

      {step.s === 'done' && (
        <Panel style={{ marginTop: 20 }}>
          <Feather name="check-circle" size={26} color={C.green} />
          <H3 style={{ marginTop: 10 }}>{step.n} yapım aktarıldı</H3>
          <Small style={{ marginTop: 4 }}>Kütüphanende ve istatistiklerinde görünüyor.</Small>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <Btn label="Kütüphaneme git" onPress={() => router.replace('/library')} />
            <Btn kind="secondary" label="Başka dosya" onPress={() => setStep({ s: 'pick' })} />
          </View>
        </Panel>
      )}
    </Screen>
  );
}

function Row({ icon, text }: { icon: 'film' | 'tv' | 'bookmark'; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Feather name={icon} size={15} color={C.muted} />
      <Text style={{ fontFamily: F.medium, fontSize: 14, color: C.text }}>{text}</Text>
    </View>
  );
}
