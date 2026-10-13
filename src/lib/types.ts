export type Universe = {
  id: string;
  name: string;
  short: string;
  color: string;
  category: string;
  desc: string;
  badge: string;
  defaultBranch: string;
};

export type TitleType = 'Film' | 'Dizi' | 'Special';

/** [sezon, bölüm, dakika | null] */
export type Episode = [number, number, number | null];

export type Title = {
  id: string;
  u: string;
  title: string;
  trTitle: string | null;
  year: number;
  type: TitleType;
  minutes: number;
  episodes: number;
  ep: Episode[];
  branch: string;
  phase: string;
  release: number;
  chrono: number | null;
  tier: 0 | 1 | 2;
  deps: string[];
  source: string | null;
  animated: boolean;
  seasons: number;
  summary: string | null;
  media: 'movie' | 'tv';
  /** TMDB eşleşmesi: scripts/resolve-tmdb.mjs doldurur */
  tmdb?: { id: number; m?: 'movie' | 'tv'; p?: string | null; b?: string | null };
  summarySource?: 'tmdb';
  /** Türkiye'de abonelikle izlenebildiği platformlar (TMDB / JustWatch) */
  pl?: string[];
  /** "Neden?" açıklaması */
  why?: string;
};

export type Mode = 'essential' | 'recommended' | 'complete';
export type ListView = 'main' | 'release' | 'chrono' | 'all';
export type Order = 'recommended' | 'release' | 'chrono';

export type State = {
  v: 2;
  onboarded: boolean;
  name: string;
  follow: string[];
  /** film ve özel yapımlar: izlenme zamanı (ms) */
  watched: Record<string, number>;
  /** diziler: izlenen bölüm sıra numaraları (1'den başlar) */
  episodes: Record<string, number[]>;
  /** son etkileşim zamanı — "devam ettiklerin" sırası için */
  touched: Record<string, number>;
  list: string[];
  /** eski ayarlar, artık kullanılmıyor */
  mode: Mode;
  order: Order;
  /** evren listelerinin görünümü */
  view: ListView;
  branches: Record<string, string>;
  spoiler: boolean;
  /** varsayılan ayar sürümü (eski kayıtları yeni varsayılanlara taşımak için) */
  dv?: number;
};
