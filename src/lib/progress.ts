import { CATALOG, TBY, UBY, UNIVERSES, sortTitles, depClosure, universeTitles, viewTitles } from './catalog';
import type { State, Title } from './types';

export const watchedEps = (s: State, id: string) => s.episodes[id]?.length || 0;

/** Yüzde: her şey bitmeden 100 göstermez, bir şey başladıysa 0 göstermez */
export function pctOf(sum: number, total: number, done: number) {
  if (!total) return 0;
  if (done === total) return 100;
  const p = Math.round((sum / total) * 100);
  return Math.max(sum > 0 ? 1 : 0, Math.min(99, p));
}

export function isDone(s: State, t: Title) {
  return t.episodes ? watchedEps(s, t.id) === t.episodes : !!s.watched[t.id];
}
export function fraction(s: State, t: Title) {
  return t.episodes ? watchedEps(s, t.id) / t.episodes : s.watched[t.id] ? 1 : 0;
}
export function isStarted(s: State, t: Title) {
  return t.episodes ? watchedEps(s, t.id) > 0 && !isDone(s, t) : false;
}
/** Kalan izleme süresi (dakika) */
export function remaining(s: State, t: Title) {
  if (t.episodes) {
    const seen = new Set(s.episodes[t.id] || []);
    if (t.ep.length) return t.ep.reduce((n, e, i) => n + (seen.has(i + 1) ? 0 : e[2] || t.minutes), 0);
    return t.minutes * (t.episodes - seen.size);
  }
  return isDone(s, t) ? 0 : t.minutes;
}
export function totalMinutes(t: Title) {
  if (t.episodes) return t.ep.length ? t.ep.reduce((n, e) => n + (e[2] || t.minutes), 0) : t.minutes * t.episodes;
  return t.minutes;
}

export const branchOf = (s: State, u: string) => s.branches[u] || UBY[u]?.defaultBranch || 'all';

/** Seçili rotanın ana hikâyesi. Görünüm yalnızca sıralamayı değiştirir. */
export const route = (s: State, u: string) => sortTitles(viewTitles(u, branchOf(s, u), 'main'), s.view === 'chrono' ? 'chrono' : 'release');

export function universeProgress(s: State, u: string) {
  const list = route(s, u);
  const sum = list.reduce((n, t) => n + fraction(s, t), 0);
  return {
    total: list.length,
    done: list.filter((t) => isDone(s, t)).length,
    pct: pctOf(sum, list.length, list.filter((t) => isDone(s, t)).length),
    left: list.reduce((n, t) => n + remaining(s, t), 0),
  };
}

/** Sıradaki yapım: önerilen sırada ön koşulları tamamlanmış ilk yapım */
export function nextUp(s: State, u: string): Title | null {
  const list = route(s, u).filter((t) => !isDone(s, t));
  if (!list.length) return null;
  const started = list.find((t) => isStarted(s, t));
  if (started) return started;
  if (s.view !== 'chrono') return list.find((t) => t.deps.every((d) => !TBY[d] || isDone(s, TBY[d]))) || list[0];
  return list[0];
}

/** Bir dizide sıradaki bölüm (1'den başlar) */
export function nextEpisode(s: State, t: Title) {
  if (!t.episodes) return null;
  const seen = new Set(s.episodes[t.id] || []);
  for (let i = 1; i <= t.episodes; i++) if (!seen.has(i)) return i;
  return null;
}

export function episodeLabel(t: Title, n: number) {
  const e = t.ep[n - 1];
  return e ? `S${String(e[0]).padStart(2, '0')} · B${String(e[1]).padStart(2, '0')}` : `Bölüm ${n}`;
}

/** Yarıda kalan diziler, en son dokunulandan başlayarak */
export function continueWatching(s: State): Title[] {
  return Object.keys(s.episodes)
    .map((id) => TBY[id])
    .filter((t) => t && isStarted(s, t))
    .sort((a, b) => (s.touched[b.id] || 0) - (s.touched[a.id] || 0));
}

export function readiness(s: State, id: string) {
  const deps = depClosure(id);
  const sum = deps.reduce((n, t) => n + fraction(s, t), 0);
  return {
    deps,
    done: deps.filter((t) => isDone(s, t)).length,
    pct: deps.length ? pctOf(sum, deps.length, deps.filter((t) => isDone(s, t)).length) : 100,
    left: deps.reduce((n, t) => n + remaining(s, t), 0),
  };
}

/** Takip edilen evrenlerde en uzun ön koşul zincirine sahip, henüz izlenmemiş ana yapım */
export function bigStory(s: State): Title | null {
  let best: Title | null = null;
  let bestLen = 2;
  for (const u of s.follow) {
    for (const t of route(s, u)) {
      if (t.tier !== 0 || isDone(s, t)) continue;
      const r = readiness(s, t.id);
      if (r.pct === 100) continue;
      if (r.deps.length > bestLen || (r.deps.length === bestLen && best && t.release > best.release)) { best = t; bestLen = r.deps.length; }
    }
  }
  return best;
}

/** "Bu akşam için": yarıda kalan dizinin sıradaki bölümü ya da iki saatin altındaki sıradaki film */
export function tonight(s: State): { t: Title; ep: number | null } | null {
  const cw = continueWatching(s)[0];
  if (cw) return { t: cw, ep: nextEpisode(s, cw) };
  const cands = s.follow.map((u) => nextUp(s, u)).filter((t): t is Title => !!t && !t.episodes && t.minutes > 0 && t.minutes <= 125);
  return cands.length ? { t: cands.sort((a, b) => a.minutes - b.minutes)[0], ep: null } : null;
}

export function stats(s: State) {
  let films = 0, eps = 0, minutes = 0, series = 0;
  for (const id of Object.keys(s.watched)) { const t = TBY[id]; if (t) { films++; minutes += t.minutes; } }
  for (const [id, arr] of Object.entries(s.episodes)) {
    const t = TBY[id];
    if (!t) continue;
    eps += arr.length;
    for (const n of arr) minutes += t.ep[n - 1]?.[2] || t.minutes;
    if (arr.length === t.episodes) series++;
  }
  const completed = UNIVERSES.filter((u) => { const p = universeProgress(s, u.id); return p.total > 0 && p.pct === 100; });
  const started = UNIVERSES.filter((u) => universeTitles(u.id).some((t) => fraction(s, t) > 0));
  return { films, eps, series, hours: Math.round(minutes / 60), minutes, completed, started };
}

/** İzleme geçmişi: filmler ve son dokunulan diziler, yeniden eskiye */
export function history(s: State, limit = 40) {
  const items: { t: Title; at: number }[] = [];
  for (const [id, at] of Object.entries(s.watched)) if (TBY[id]) items.push({ t: TBY[id], at });
  for (const id of Object.keys(s.episodes)) if (TBY[id]) items.push({ t: TBY[id], at: s.touched[id] || 0 });
  return items.sort((a, b) => b.at - a.at).slice(0, limit);
}

export const CATALOG_SIZE = CATALOG.length;
