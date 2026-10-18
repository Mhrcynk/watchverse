import { router } from 'expo-router';
import { useMemo } from 'react';
import { Backdrop, ContinueItem, Greeting, NextUpHero, WeekCard } from '@/components/home';
import { UniverseCard } from '@/components/media';
import { Row, TItemTile, useTileW } from '@/components/rows';
import { StarterCard } from '@/components/starter';
import { useForYou } from '@/components/discover-feed';
import { Empty, Screen, useLayout, useToast } from '@/components/ui';
import { TBY, UBY, daysUntil, posterPath, upcomingFor } from '@/lib/catalog';
import { continueRow, type ContItem } from '@/lib/continue-row';
import { routeOf } from '@/lib/library';
import { episodeLabel, nextEpisode, universeProgress } from '@/lib/progress';
import { useStore } from '@/lib/store';
import { img } from '@/lib/tmdb';
import type { State } from '@/lib/types';
import { SaveStatus } from '@/components/save-status';

const DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const pad2 = (n?: number) => String(n || 0).padStart(2, '0');
const whenOf = (date: string) => {
  const d = daysUntil(date);
  return d <= 0 ? 'Bugün' : d === 1 ? 'Yarın' : DAYS[new Date(`${date}T12:00:00`).getDay()];
};

/** Kütüphanedeki (katalog dışı) dizide sıradaki bölüm: numarası ve S/B etiketi */
function libNext(s: State, key: string): { n: number; label: string } | null {
  const li = s.lib[key];
  if (!li || li.m !== 'tv') return null;
  const seen = new Set(s.episodes[key] || []);
  let n = 0;
  for (let i = 1; i <= (li.aired || 0); i++) if (!seen.has(i)) { n = i; break; }
  if (!n) return null;
  let left = n;
  for (const se of li.seasons || []) {
    if (left <= se.count) return { n, label: `S${pad2(se.n)} · B${pad2(left)}` };
    left -= se.count;
  }
  return { n, label: `Bölüm ${n}` };
}

/** Sıradaki kartı için geniş görsel ve "S01 · B14 · 3 bölüm kaldı" yazısı */
function heroOf(s: State, x: ContItem): { image: string | null; sub: string } {
  const t = TBY[x.key];
  if (t) {
    const n = t.episodes ? nextEpisode(s, t) : null;
    const image = t.tmdb?.b ? img(t.tmdb.b, 'w780') : x.poster;
    return { image, sub: [n ? episodeLabel(t, n) : null, x.sub].filter(Boolean).join(' · ') || 'Film' };
  }
  const li = s.lib[x.key];
  const nx = libNext(s, x.key);
  return { image: li?.b ? img(li.b, 'w780') : x.poster, sub: [nx?.label, x.sub].filter(Boolean).join(' · ') };
}

type WeekRow = { key: string; date: string; title: string; what: string; route: string; image: string | null };
/** Önümüzdeki 7 gün: takip ettiğin evrenlerde ve kütüphanendeki dizilerde çıkacaklar */
function thisWeek(s: State): WeekRow[] {
  const out = new Map<string, WeekRow>();
  for (const x of upcomingFor(s.follow, 40)) {
    if (daysUntil(x.date) > 7) continue;
    const what = x.kind === 'episode' ? `S${pad2(x.season)} · B${pad2(x.episode)}` : x.kind === 'season' ? `${x.season}. sezon` : x.kind === 'film' ? 'Yeni film' : 'Yeni dizi';
    const t = x.id ? TBY[x.id] : null;
    out.set(x.k + x.date, { key: x.k + x.date, date: x.date, title: x.title, what, route: x.id ? `/title/${x.id}` : routeOf(x.k), image: t?.tmdb?.b ? img(t.tmdb.b, 'w342') : posterPath(x.p, 'w342') });
  }
  for (const [key, li] of Object.entries(s.lib)) {
    const n = li?.next;
    if (!n?.date || s.dropped?.[key] > 0) continue;
    const d = daysUntil(n.date);
    if (d < 0 || d > 7) continue;
    out.set(key + n.date, { key: key + n.date, date: n.date, title: li.title, what: `S${pad2(n.s)} · B${pad2(n.e)}`, route: routeOf(key), image: img(li.b || li.p, 'w342') });
  }
  return [...out.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10);
}

export default function Home() {
  const store = useStore();
  const { state } = store;
  const toast = useToast();
  const { width, pad, tablet } = useLayout();
  const tileW = useTileW();
  // Telefonda 2,5 kart görünür (yana kaydırıldığı anlaşılsın); geniş ekranda sabit genişlik
  const cardW = tablet ? 168 : Math.round(Math.min(168, (width - pad * 2 - 16) / 2.5));
  const weekW = tablet ? 180 : Math.round(Math.min(180, (width - pad * 2 - 20) / 2.3));
  const cont = useMemo(() => continueRow(state), [state]);
  const week = useMemo(() => thisWeek(state), [state]);
  const forYou = useForYou(state, 'all');
  // Yarıda kalan evrenler önce (en çok ilerlediğin en başta)
  const followed = useMemo(() => state.follow.map((id) => UBY[id]).filter(Boolean)
    .map((u) => ({ u, pct: universeProgress(state, u.id).pct })).sort((a, b) => (b.pct % 100 > 0 ? 1 : 0) - (a.pct % 100 > 0 ? 1 : 0) || b.pct - a.pct).map((x) => x.u), [state]);

  const markNext = (x: ContItem) => {
    const t = TBY[x.key];
    if (t && !t.episodes) {
      store.toggleWatched(t.id, true);
      toast('İzlendi olarak kaydedildi', { label: 'Geri al', onPress: () => store.toggleWatched(t.id, false) });
      return;
    }
    const n = t ? nextEpisode(state, t) : libNext(state, x.key)?.n;
    if (!n) return;
    const set = (value: boolean) => t ? store.setEpisodes(t.id, [n], value) : store.setEpsKey(x.key, [n], value);
    set(true);
    toast(`${t ? episodeLabel(t, n) : libNext(state, x.key)?.label || `Bölüm ${n}`} izlendi`, { label: 'Geri al', onPress: () => set(false) });
  };
  const canMark = (x: ContItem) => !!TBY[x.key] || (state.lib[x.key]?.aired || 0) > (state.episodes[x.key]?.length || 0);

  const [lead, ...rest] = cont;
  const hero = lead ? heroOf(state, lead) : null;

  return <Screen>
    <Backdrop />
    <Greeting name={state.name} sub="Nerede kaldın?" onSearch={() => router.push('/explore')} />
    <SaveStatus onlyProblems />

    {lead && hero ? <NextUpHero title={lead.title} image={hero.image} sub={hero.sub} badge={lead.badge}
      onWatched={canMark(lead) ? () => markNext(lead) : undefined} onOpen={() => router.push(lead.route as never)} />
      : <Empty icon="bookmark" title="İlk hikâyeni seç." text="Bir yapım kaydet veya izlediğin bölümleri işaretle; kaldığın yer burada görünsün." action="Yapım bul" onAction={() => router.push('/explore')} />}

    {rest.length > 0 && <Row title="İzlemeye devam et" onMore={() => router.push('/library')}>
      {rest.slice(0, 12).map((x, i) => <ContinueItem key={x.key} index={i} width={cardW} title={x.title} poster={x.poster} sub={x.sub} badge={x.badge} pct={x.pct}
        watchedLabel={x.m === 'tv' ? 'sıradaki bölümü izledim' : 'izledim'}
        onWatched={canMark(x) ? () => markNext(x) : undefined}
        onPress={() => router.push(x.route as never)} />)}
    </Row>}

    {week.length > 0 && <Row title="Bu hafta yeni bölümler" onMore={() => router.push('/calendar')}>
      {week.map((w, i) => <WeekCard key={w.key} index={i} width={weekW} when={whenOf(w.date)} soon={daysUntil(w.date) <= 1} title={w.title} what={w.what} image={w.image} onPress={() => router.push(w.route as never)} />)}
    </Row>}

    {followed.length > 0 && <Row title="Evrenlerin" onMore={() => router.push('/universes')}>
      {followed.map((u) => <UniverseCard key={u.id} u={u} state={state} style={{ width: Math.min(280, Math.round(width * 0.7)) }} />)}
    </Row>}

    {forYou.length >= 3 && <Row title="Senin için" note="puanlarına göre">
      {forYou.map((x, i) => <TItemTile key={x.key} x={x} width={tileW} index={i} />)}
    </Row>}

    <StarterCard />
  </Screen>;
}
