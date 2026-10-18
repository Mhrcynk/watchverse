import { router } from 'expo-router';
import { useMemo } from 'react';
import { Backdrop, ContinueItem, Greeting, ListHead, WeekItem } from '@/components/home';
import { StarterCard } from '@/components/starter';
import { Empty, Screen, useLayout, useToast } from '@/components/ui';
import { Row } from '@/components/rows';
import { TBY, daysUntil, upcomingFor } from '@/lib/catalog';
import { continueRow, type ContItem } from '@/lib/continue-row';
import { routeOf } from '@/lib/library';
import { episodeLabel, nextEpisode } from '@/lib/progress';
import { useStore } from '@/lib/store';
import type { State } from '@/lib/types';
import { SaveStatus } from '@/components/save-status';

const DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const pad2 = (n?: number) => String(n || 0).padStart(2, '0');
const whenOf = (date: string) => {
  const d = daysUntil(date);
  return d <= 0 ? 'Bugün' : d === 1 ? 'Yarın' : DAYS[new Date(`${date}T12:00:00`).getDay()];
};

type WeekRow = { key: string; date: string; title: string; what: string; route: string };
/** Önümüzdeki 7 gün: takip ettiğin evrenlerdeki ve kütüphanendeki dizilerde çıkacaklar */
function thisWeek(s: State): WeekRow[] {
  const out = new Map<string, WeekRow>();
  for (const x of upcomingFor(s.follow, 40)) {
    if (daysUntil(x.date) > 7) continue;
    const what = x.kind === 'episode' ? `S${pad2(x.season)} · B${pad2(x.episode)}` : x.kind === 'season' ? `${x.season}. sezon` : x.kind === 'film' ? 'Yeni film' : 'Yeni dizi';
    out.set(x.k + x.date, { key: x.k + x.date, date: x.date, title: x.title, what, route: x.id ? `/title/${x.id}` : routeOf(x.k) });
  }
  for (const [key, li] of Object.entries(s.lib)) {
    const n = li?.next;
    if (!n?.date || s.dropped?.[key] > 0) continue;
    const d = daysUntil(n.date);
    if (d < 0 || d > 7) continue;
    out.set(key + n.date, { key: key + n.date, date: n.date, title: li.title, what: `S${pad2(n.s)} · B${pad2(n.e)}`, route: routeOf(key) });
  }
  return [...out.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
}

export default function Home() {
  const store = useStore();
  const { state } = store;
  const toast = useToast();
  const { width, pad, tablet } = useLayout();
  // Telefonda 2,5 kart görünür (yana kaydırıldığı anlaşılsın); geniş ekranda sabit genişlik
  const cardW = tablet ? 168 : Math.round(Math.min(168, (width - pad * 2 - 16) / 2.5));
  const cont = useMemo(() => continueRow(state), [state]);
  const week = useMemo(() => thisWeek(state), [state]);
  const markNext = (x: ContItem) => {
    const t = TBY[x.key];
    if (t && !t.episodes) {
      store.toggleWatched(t.id, true);
      toast('İzlendi olarak kaydedildi', { label: 'Geri al', onPress: () => store.toggleWatched(t.id, false) });
      return;
    }
    const n = t ? nextEpisode(state, t) : Array.from({ length: state.lib[x.key]?.aired || 0 }, (_, i) => i + 1).find(i => !state.episodes[x.key]?.includes(i));
    if (!n) return;
    const set = (value: boolean) => t ? store.setEpisodes(t.id, [n], value) : store.setEpsKey(x.key, [n], value);
    set(true);
    toast(`${t ? episodeLabel(t, n) : `Bölüm ${n}`} izlendi`, { label: 'Geri al', onPress: () => set(false) });
  };
  const canMark = (x: ContItem) => !!TBY[x.key] || (state.lib[x.key]?.aired || 0) > (state.episodes[x.key]?.length || 0);
  return <Screen>
    <Backdrop />
    <Greeting name={state.name} sub="Nerede kaldın? Sıradaki hikâyene dön." />
    <SaveStatus onlyProblems />
    {cont.length ? <Row title="İzlemeye devam et" onMore={() => router.push('/library')}>
      {cont.slice(0, 12).map((x, i) => <ContinueItem key={x.key} index={i} width={cardW} title={x.title} poster={x.poster} sub={x.sub} badge={x.badge} pct={x.pct}
        watchedLabel={x.m === 'tv' ? 'sıradaki bölümü izledim' : 'izledim'}
        onWatched={canMark(x) ? () => markNext(x) : undefined}
        onPress={() => router.push(x.route as never)} />)}
    </Row> :<Empty icon="bookmark" title="İlk hikâyeni seç." text="Bir yapım kaydet veya izlediğin bölümleri işaretle; kaldığın yer burada görünsün." action="Yapım bul" onAction={() => router.push('/explore')} />}
    {week.length > 0 && <>
      <ListHead title="Bu hafta" onMore={() => router.push('/calendar')} />
      {week.map((w) => <WeekItem key={w.key} when={whenOf(w.date)} title={w.title} what={w.what} soon={daysUntil(w.date) <= 1} onPress={() => router.push(w.route as never)} />)}
    </>}
    <StarterCard />
  </Screen>;
}
