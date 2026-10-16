import Feather from '@expo/vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Backdrop, PageHeader } from '@/components/home';
import { isSaved, itemFromTItem, useListPicker } from '@/components/lists';
import { scoreText } from '@/components/preview';
import { useTrailer } from '@/components/trailer';
import { BackLink, Btn, Empty, FadeIn, Press, Screen, Small, tap } from '@/components/ui';
import { catalogOf, routeOf } from '@/lib/library';
import { useStore } from '@/lib/store';
import { C, F, R, alpha } from '@/lib/theme';
import { detail, discover, hasApi, img, platforms, type Media, type TDetail, type TItem } from '@/lib/tmdb';
import { CATALOG } from '@/lib/catalog';
import { savedSuggestions } from '@/lib/saved-suggestions';
import type { State } from '@/lib/types';

type Kind = 'all' | Media;
type Time = 'short' | 'mid' | 'any';
type Plat = { id: number; name: string; at: string };
type Choice = { source: 'discover' | 'mine'; kind: Kind; time: Time; mood: string; plats: number[] };

/** Ruh hâli → TMDB türleri ("|" ya da demek) */
const MOODS: { id: string; label: string; movie?: string; tv?: string }[] = [
  { id: 'any', label: 'Fark etmez' },
  { id: 'fun', label: 'Gülmek istiyorum', movie: '35', tv: '35' },
  { id: 'action', label: 'Heyecan ve aksiyon', movie: '28|12', tv: '10759' },
  { id: 'tense', label: 'Gerilim ve suç', movie: '53|80', tv: '80|9648' },
  { id: 'drama', label: 'Duygusal', movie: '18', tv: '18' },
  { id: 'love', label: 'Romantik', movie: '10749' },
  { id: 'worlds', label: 'Başka dünyalar', movie: '878|14', tv: '10765' },
  { id: 'family', label: 'Aileyle', movie: '10751|16', tv: '10751' },
  { id: 'real', label: 'Gerçek hayattan', movie: '99', tv: '99' },
];
const KEY = 'watchverse:pick';
const DEF: Choice = { source: 'discover', kind: 'all', time: 'any', mood: 'any', plats: [] };

const seenIt = (s: State, k: string) => { const id = catalogOf(k)?.id || k; return !!s.watched[k] || !!s.watched[id] || !!s.episodes[k]?.length || !!s.episodes[id]?.length || isSaved(s, k); };

/** Bugün ne izlesem? Birkaç seçim, tek öneri */
export default function Pick() {
  const store = useStore();
  const { pick } = useListPicker();
  const { play } = useTrailer();
  const [ch, setCh] = useState<Choice>(DEF);
  const [plats, setPlats] = useState<Plat[]>([]);
  const [step, setStep] = useState<'choose' | 'result'>('choose');
  const [cur, setCur] = useState<TItem | null>(null);
  const [d, setD] = useState<TDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [none, setNone] = useState(false);
  const pool = useRef<TItem[]>([]);
  const currentKey = useRef<string | null>(null);
  const shown = useRef(new Set<string>());
  const page = useRef(1);
  const api = hasApi();

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v) setCh({ ...DEF, ...JSON.parse(v) }); }).catch(() => {});
    if (api) platforms().then(setPlats).catch(() => {});
  }, [api]);
  const set = (p: Partial<Choice>) => setCh((c) => { const n = { ...c, ...p }; AsyncStorage.setItem(KEY, JSON.stringify(n)).catch(() => {}); return n; });
  const moods = MOODS.filter((m) => m.id === 'any' || ch.kind === 'all' || m[ch.kind]);
  const mood = MOODS.find((m) => m.id === ch.mood) || MOODS[0];

  /** Seçimlere uyan bir sayfa yapım getirir */
  const fetchPage = async (n: number) => {
    if (ch.source === 'mine') return savedSuggestions(store.state, CATALOG, ch.kind, shown.current);
    const ids = (ch.plats.length ? ch.plats : plats.map((p) => p.id)).join('|');
    const base: Record<string, string | number> = { sort_by: 'popularity.desc', page: n, ...(ids ? { with_watch_providers: ids, with_watch_monetization_types: 'flatrate' } : {}) };
    const q = (m: Media) => {
      const g = mood.id === 'any' ? undefined : mood[m];
      if (mood.id !== 'any' && !g) return Promise.resolve([] as TItem[]);
      const rt = ch.time === 'short' ? (m === 'movie' ? 100 : 30) : ch.time === 'mid' ? (m === 'movie' ? 130 : 50) : 0;
      return discover(m, {
        ...base, 'vote_average.gte': m === 'movie' ? 6.6 : 7, 'vote_count.gte': m === 'movie' ? 250 : 120,
        ...(g ? { with_genres: g } : {}), ...(rt ? { 'with_runtime.lte': rt, 'with_runtime.gte': m === 'movie' ? 60 : 15 } : {}),
      });
    };
    const [a, b] = await Promise.all([ch.kind !== 'tv' ? q('movie') : Promise.resolve([]), ch.kind !== 'movie' ? q('tv') : Promise.resolve([])]);
    return [...a, ...b].filter((x) => x.p && x.overview && !seenIt(store.state, x.key) && !shown.current.has(x.key));
  };

  /** Havuzdan rastgele ama puanı yüksek olanı daha sık seçer */
  const draw = (): TItem | null => {
    const list = pool.current.filter((x) => !shown.current.has(x.key));
    if (!list.length) return null;
    const w = list.map((x) => Math.max(0.2, x.vote - 6) ** 2);
    let r = Math.random() * w.reduce((s, v) => s + v, 0);
    for (let i = 0; i < list.length; i++) { r -= w[i]; if (r <= 0) return list[i]; }
    return list[list.length - 1];
  };

  const next = async (fresh = false) => {
    currentKey.current = null; setBusy(true); setNone(false); tap();
    try {
      if (fresh) { pool.current = []; page.current = 1 + Math.floor(Math.random() * 2); }
      let x = draw();
      for (let tries = 0; !x && tries < 3; tries++) {
        const got = await fetchPage(page.current);
        page.current = page.current >= 5 ? 1 : page.current + 1;
        pool.current = [...pool.current, ...got];
        x = draw();
      }
      if (!x) { setNone(true); setStep('result'); setCur(null); return; }
      shown.current.add(x.key);
      currentKey.current = x.key; setD(null); setCur(x); setStep('result');
      const selectedKey = x.key;
      detail(x.m, x.id).then((v) => { if (currentKey.current === selectedKey) setD(v); }).catch(() => {});
    } catch { setNone(true); setStep('result'); setCur(null); } finally { setBusy(false); }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  if (!api) return <Screen><Backdrop /><BackLink label="Geri" onPress={back} /><Empty icon="shuffle" title="Bu araç ara sunucu kurulunca açılır." /></Screen>;

  const platName = (id: number) => plats.find((p) => p.id === id)?.name || '';
  const summary = [ch.kind === 'movie' ? 'Film' : ch.kind === 'tv' ? 'Dizi' : 'Film ya da dizi', ch.source === 'mine' ? 'Kendi listemden' : ch.plats.length ? ch.plats.map(platName).filter(Boolean).join(', ') : 'Tüm platformlar', ch.time === 'short' ? 'Kısa' : ch.time === 'mid' ? 'Normal süre' : null, mood.id !== 'any' ? mood.label : null].filter(Boolean).join(' · ');

  return (
    <Screen>
      <Backdrop />
      <BackLink label="Geri" onPress={back} />
      <PageHeader bold="Bugün ne izlesem?" sub={step === 'choose' ? (ch.source === 'mine' ? 'Kaydettiğin ve henüz başlamadığın yapımlardan birini seçelim.' : 'Birkaç seçim yap, sana tek bir öneri çıkaralım. İzlediklerin ve kaydettiklerin önerilmez.') : summary} />

      {step === 'choose' ? (
        <>
          <Group title="Nereden önerelim?">
            <Opt label="Yeni bir şey keşfet" on={ch.source === 'discover'} onPress={() => set({ source: 'discover' })} />
            <Opt label="Kendi listemden öner" on={ch.source === 'mine'} onPress={() => set({ source: 'mine', time: 'any', mood: 'any', plats: [] })} />
          </Group>
          <Group title="Ne izlemek istersin?">
            {([['all', 'Fark etmez'], ['movie', 'Film'], ['tv', 'Dizi']] as const).map(([id, l]) => (
              <Opt key={id} label={l} on={ch.kind === id} onPress={() => set({ kind: id, mood: id === 'all' || MOODS.find((m) => m.id === ch.mood)?.[id] ? ch.mood : 'any' })} />
            ))}
          </Group>
          {ch.source === 'discover' && <>
          <Group title="Hangi platformlarda?" note={ch.plats.length ? `${ch.plats.length} seçili` : 'Seçmezsen hepsinde arar'}>
            {plats.map((p) => {
              const on = ch.plats.includes(p.id);
              return <Opt key={p.id} label={p.name} on={on} multi onPress={() => set({ plats: on ? ch.plats.filter((x) => x !== p.id) : [...ch.plats, p.id] })} />;
            })}
            {!plats.length && <Small>Platformlar yükleniyor…</Small>}
          </Group>
          <Group title="Ne kadar vaktin var?">
            {([['short', 'Az', ch.kind === 'tv' ? '30 dk altı bölüm' : ch.kind === 'movie' ? '100 dk altı' : 'Kısa film, kısa bölüm'], ['mid', 'Bir akşam', ch.kind === 'tv' ? '50 dk altı bölüm' : ch.kind === 'movie' ? '130 dk altı' : 'Orta uzunluk'], ['any', 'Fark etmez', undefined]] as const).map(([id, l, sub]) => (
              <Opt key={id} label={l} sub={sub} on={ch.time === id} onPress={() => set({ time: id })} />
            ))}
          </Group>
          <Group title="Havan nasıl?">
            {moods.map((m) => <Opt key={m.id} label={m.label} on={ch.mood === m.id} onPress={() => set({ mood: m.id })} />)}
          </Group>
          </>}
          <Btn icon="shuffle" label={busy ? 'Aranıyor…' : 'Bana bir şey öner'} disabled={busy} style={{ marginTop: 28 }} onPress={() => { shown.current.clear(); next(true); }} />
        </>
      ) : none || !cur ? (
        <View style={{ marginTop: 10 }}>
          <Empty icon="search" title="Bu seçimlere uyan yeni bir yapım kalmadı." text={ch.source === 'mine' ? 'Listene yeni yapımlar ekle ya da tür seçimini değiştir.' : 'Bir platform ya da tür daha ekleyip tekrar dene.'} action="Seçimleri değiştir" onAction={() => setStep('choose')} />
        </View>
      ) : (
        <Result key={cur.key} x={cur} d={d} busy={busy}
          onSave={() => pick(itemFromTItem(cur))} saved={isSaved(store.state, cur.key)}
          onTrailer={d?.yt ? () => play(d.yt!, cur.title) : undefined}
          onMore={() => router.push(routeOf(cur.key) as never)}
          onNext={() => next()} onChange={() => setStep('choose')} chosen={ch.plats} ownList={ch.source === 'mine'} />
      )}
    </Screen>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 26 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text accessibilityRole="header" style={{ fontFamily: F.bold, fontSize: 17, color: C.text }}>{title}</Text>
        {!!note && <Small>{note}</Small>}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
    </View>
  );
}

/** Seçenek: parmakla rahat dokunulacak boyutta (en az 44 px) */
function Opt({ label, sub, on, multi, onPress }: { label: string; sub?: string; on: boolean; multi?: boolean; onPress: () => void }) {
  return (
    <Press accessibilityRole={multi ? 'checkbox' : 'radio'} accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={sub ? `${label}, ${sub}` : label} onPress={() => { tap(); onPress(); }} scaleTo={0.96}
      style={{ minHeight: 44, paddingHorizontal: 16, paddingVertical: sub ? 7 : 0, borderRadius: R.md, justifyContent: 'center', backgroundColor: on ? alpha(C.accent, 0.2) : C.card, borderWidth: 1, borderColor: on ? C.accent : 'transparent' }}>
      <Text style={{ fontFamily: F.semibold, fontSize: 14.5, color: on ? C.text : '#D5D8E0' }}>{label}</Text>
      {!!sub && <Text style={{ fontFamily: F.regular, fontSize: 12, color: C.muted, marginTop: 1 }}>{sub}</Text>}
    </Press>
  );
}

function Result({ x, d, busy, saved, chosen, ownList, onSave, onTrailer, onMore, onNext, onChange }: {
  x: TItem; d: TDetail | null; busy: boolean; saved: boolean; chosen: number[]; ownList: boolean;
  onSave: () => void; onTrailer?: () => void; onMore: () => void; onNext: () => void; onChange: () => void;
}) {
  const rt = d?.runtime;
  const meta = [x.year, x.m === 'movie' ? 'Film' : 'Dizi', x.m === 'movie' && rt ? `${Math.floor(rt / 60)} sa ${rt % 60} dk` : null, x.m === 'tv' && d ? `${d.seasons.length} sezon` : null, scoreText(d?.vote ?? x.vote, d?.votes ?? x.votes)].filter(Boolean).join(' · ');
  const where = d?.pl.length ? d.pl.slice(0, 3).join(', ') : null;
  return (
    <FadeIn>
      <View style={{ marginTop: 20, borderRadius: R.lg, overflow: 'hidden', backgroundColor: C.card }}>
        <Press accessibilityRole="button" accessibilityLabel={`${x.title} ayrıntıları`} onPress={onMore} scaleTo={0.99}>
          <View style={{ aspectRatio: 16 / 9, justifyContent: 'flex-end' }}>
            <Image source={{ uri: img(x.b || x.p, 'w780')! }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />
            <LinearGradient colors={['rgba(21,23,29,0)', 'rgba(21,23,29,0.5)', C.card]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14, padding: 16, paddingBottom: 4 }}>
              <View style={{ width: 78, aspectRatio: 2 / 3, borderRadius: R.sm, overflow: 'hidden', backgroundColor: C.raised, marginBottom: -30 }}>
                {x.p && <Image source={{ uri: img(x.p, 'w342')! }} style={StyleSheet.absoluteFill} contentFit="cover" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={2} style={{ fontFamily: F.heavy, fontSize: 23, lineHeight: 28, letterSpacing: -0.4, color: C.text }}>{x.title}</Text>
              </View>
            </View>
          </View>
        </Press>
        <View style={{ padding: 16, paddingTop: 10, paddingLeft: 108 }}>
          <Small>{meta}</Small>
          {!!where && <Small style={{ marginTop: 2, color: C.accentSoft }}>{where}</Small>}
        </View>
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <Text numberOfLines={5} style={{ fontFamily: F.regular, fontSize: 14.5, lineHeight: 21, color: '#D8D8DE' }}>{d?.overview || x.overview}</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <Btn icon="bookmark" kind={saved ? 'success' : 'primary'} label={saved ? 'Kütüphanende' : 'Kaydet'} style={{ flex: 1 }} onPress={onSave} />
            {onTrailer && <Btn icon="play" kind="secondary" label="Fragman" onPress={onTrailer} />}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Btn icon="shuffle" kind="secondary" label={busy ? 'Aranıyor…' : 'Başka öner'} disabled={busy} style={{ flex: 1 }} onPress={onNext} />
            <Btn icon="info" kind="secondary" label="Ayrıntılar" style={{ flex: 1 }} onPress={onMore} />
          </View>
        </View>
      </View>
      <Press accessibilityRole="button" onPress={onChange} style={{ marginTop: 16, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 }}>
        <Feather name="sliders" size={16} color={C.accentSoft} />
        <Text style={{ fontFamily: F.semibold, fontSize: 14.5, color: C.accentSoft }}>Seçimleri değiştir</Text>
      </Press>
      {!ownList && chosen.length === 0 && <Small style={{ marginTop: 4 }}>Öneriler Türkiye&apos;deki abonelik platformlarında izlenebilen yapımlardan seçilir.</Small>}
    </FadeIn>
  );
}
