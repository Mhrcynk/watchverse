import raw from '@/data/catalog.json';
import type { Mode, Order, Title, Universe } from './types';

type Raw = {
  updated: string;
  groups: Record<string, string>;
  universes: Universe[];
  catalog: Title[];
  scope: string;
  excluded: { title: string; reason: string }[];
};

const D = raw as unknown as Raw;

export const UPDATED = D.updated;
export const SCOPE = D.scope;
export const GROUPS = D.groups;
export const UNIVERSES: Universe[] = D.universes;
export const CATALOG: Title[] = D.catalog;

export const UBY: Record<string, Universe> = Object.fromEntries(UNIVERSES.map((u) => [u.id, u]));
export const TBY: Record<string, Title> = Object.fromEntries(CATALOG.map((t) => [t.id, t]));

const byUniverse: Record<string, Title[]> = {};
for (const t of CATALOG) (byUniverse[t.u] ||= []).push(t);

export const CATEGORY_TR: Record<string, string> = {
  Superhero: 'Süper kahraman',
  'Sci-Fi': 'Bilim kurgu',
  Fantasy: 'Fantastik',
  Action: 'Aksiyon',
  Horror: 'Korku',
  Drama: 'Dram',
};
export const CATEGORIES = ['Superhero', 'Sci-Fi', 'Fantasy', 'Action', 'Horror', 'Drama'].filter((c) =>
  UNIVERSES.some((u) => u.category === c),
);

export const TYPE_TR: Record<string, string> = { Film: 'Film', Dizi: 'Dizi', Special: 'Özel yapım' };
export const MODE_TR: Record<Mode, string> = { essential: 'Ana hikâye', recommended: 'Önerilen', complete: 'Tümü' };
export const MODE_HELP: Record<Mode, string> = {
  essential: 'Yalnızca ana hikâyeyi taşıyan yapımlar.',
  recommended: 'Ana hikâye ve onu zenginleştiren yan yapımlar.',
  complete: 'Katalogdaki her film, dizi ve özel yapım.',
};
export const ORDER_TR: Record<Order, string> = { recommended: 'Önerilen', release: 'Yayın sırası', chrono: 'Kronolojik' };
export const TIER_TR = ['Ana hikâye', 'Tavsiye', 'İsteğe bağlı'] as const;

export function universeTitles(u: string): Title[] {
  return byUniverse[u] || [];
}

/** Bir evrende bulunan rotalar (dallar), yapım sayısına göre */
export function branchesOf(u: string): { id: string; name: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const t of universeTitles(u)) counts[t.branch] = (counts[t.branch] || 0) + 1;
  return Object.entries(counts)
    .map(([id, count]) => ({ id, name: GROUPS[id] || id, count }))
    .sort((a, b) => b.count - a.count);
}

export const inMode = (t: Title, mode: Mode) => t.tier <= (mode === 'essential' ? 0 : mode === 'recommended' ? 1 : 2);

export function sortTitles(list: Title[], order: Order): Title[] {
  const l = list.slice();
  if (order === 'chrono') return l.sort((a, b) => (a.chrono ?? 9999) - (b.chrono ?? 9999) || a.release - b.release);
  return l.sort((a, b) => a.release - b.release);
}

/** Seçili rota, mod ve sıraya göre bir evrenin izleme listesi */
export function routeTitles(u: string, branch: string, mode: Mode | null, order: Order): Title[] {
  const base = universeTitles(u).filter((t) => (branch === 'all' || t.branch === branch) && (!mode || inMode(t, mode)));
  return sortTitles(base, order);
}

/** Bir yapımın tüm ön koşulları (zincir boyunca), eskiden yeniye */
export function depClosure(id: string): Title[] {
  const seen = new Set<string>();
  const stack = [...(TBY[id]?.deps || [])];
  while (stack.length) {
    const d = stack.pop()!;
    if (seen.has(d) || !TBY[d]) continue;
    seen.add(d);
    stack.push(...TBY[d].deps);
  }
  return [...seen].map((i) => TBY[i]).sort((a, b) => a.release - b.release);
}

/** Arama için normalize (Türkçe büyük/küçük harf ve aksanlar) */
export function norm(s: string) {
  return s
    .toLocaleLowerCase('tr')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i');
}

const searchIndex = CATALOG.map((t) => ({
  t,
  key: norm([t.title, t.trTitle || '', UBY[t.u]?.name || '', t.phase, String(t.year)].join(' ')),
}));

export function search(q: string, category: string | null): Title[] {
  const n = norm(q.trim());
  return searchIndex
    .filter((x) => (!category || UBY[x.t.u]?.category === category) && (!n || n.split(/\s+/).every((w) => x.key.includes(w))))
    .map((x) => x.t);
}

export const displayTitle = (t: Title) => t.title;
export const posterUrl = (t: Title, size: 'w185' | 'w342' | 'w500' = 'w342') =>
  t.tmdb?.p ? `https://image.tmdb.org/t/p/${size}${t.tmdb.p}` : null;
export const backdropUrl = (t: Title) => (t.tmdb?.b ? `https://image.tmdb.org/t/p/w780${t.tmdb.b}` : null);
