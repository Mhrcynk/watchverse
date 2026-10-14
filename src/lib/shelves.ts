import { GROUPS, UBY, sortTitles, universeTitles } from './catalog';
import type { Title } from './types';

/** group: rota adı; title: rafın kendi adı (bölünmüş rotada tür, bölünmemişte rota adı) */
export type Shelf = { key: string; group: string; title: string; split: boolean; items: Title[] };

/**
 * Evren sayfasındaki raflar: her rota kendi satırında; büyük rotalar türe göre bölünür
 * (ana hikâye, diziler, filmler, animasyon, kısa ve özel). Sıra: çıkış ya da kronolojik.
 */
export function shelvesOf(uid: string, order: 'release' | 'chrono'): Shelf[] {
  const u = UBY[uid];
  const all = universeTitles(uid);
  const byBranch = new Map<string, Title[]>();
  for (const t of all) byBranch.set(t.branch, [...(byBranch.get(t.branch) || []), t]);
  // Ana rota önce; sonra ana hikâye yapımı çok olan, sonra eskiden yeniye
  const branches = [...byBranch.entries()].sort(([a, x], [b, y]) => {
    if (u?.defaultBranch === a) return -1;
    if (u?.defaultBranch === b) return 1;
    const m = (l: Title[]) => l.filter((t) => t.tier === 0).length;
    return m(y) - m(x) || Math.min(...x.map((t) => t.release)) - Math.min(...y.map((t) => t.release));
  });
  // Küçük evren: tek raf (sayfada ızgara olarak gösterilir)
  if (all.length <= 8) return [{ key: 'all', group: u?.name || '', title: 'Tüm yapımlar', split: false, items: sortTitles(all, order) }];
  const out: Shelf[] = [];
  for (const [b, list] of branches) {
    const name = GROUPS[b] || u?.name || '';
    const sorted = sortTitles(list, order);
    if (list.length <= 16) { out.push({ key: b, group: name, title: name, split: false, items: sorted }); continue; }
    // Büyük rota: türlere böl. Rota zaten çoğunlukla animasyonsa animasyonu ayrıca ayırma
    const mostlyAnim = list.filter((t) => t.animated).length / list.length > 0.6;
    const parts: [string, string, (t: Title) => boolean][] = [
      ['main', 'Ana hikâye', (t) => t.tier === 0],
      ['series', 'Diziler', (t) => t.type === 'Dizi' && (mostlyAnim || !t.animated)],
      ['films', 'Filmler', (t) => t.type === 'Film' && (mostlyAnim || !t.animated)],
      ['anim', 'Animasyon', (t) => !mostlyAnim && t.animated],
      ['short', 'Kısa ve özel yapımlar', (t) => t.type === 'Special'],
    ];
    const used = new Set<string>();
    const sub: Shelf[] = [];
    for (const [k, label, fn] of parts) {
      const items = sorted.filter((t) => !used.has(t.id) && fn(t));
      if (!items.length) continue;
      items.forEach((t) => used.add(t.id));
      sub.push({ key: `${b}:${k}`, group: name, title: label, split: true, items });
    }
    // tek yapımlık alt raflar ve kalanlar "Diğer" rafında toplanır
    const small = sub.filter((x) => x.items.length < 2);
    const rest = sortTitles([...sorted.filter((t) => !used.has(t.id)), ...small.flatMap((x) => x.items)], order);
    out.push(...sub.filter((x) => x.items.length >= 2));
    if (rest.length) out.push({ key: `${b}:other`, group: name, title: 'Diğer', split: true, items: rest });
  }
  // birden fazla tek yapımlık rota varsa bunları sonda tek rafta topla
  const singles = out.filter((s) => !s.split && s.items.length === 1);
  if (singles.length < 2) return out;
  return [...out.filter((s) => !singles.includes(s)), { key: 'singles', group: 'Diğer yapımlar', title: 'Diğer yapımlar', split: false, items: sortTitles(singles.flatMap((s) => s.items), order) }];
}
