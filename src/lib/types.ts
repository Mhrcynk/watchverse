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
export type Episode = [number, number, number | null, number?];

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
  /** YouTube fragman kimliği */
  yt?: string;
  /** "Neden?" açıklaması */
  why?: string;
};

export type Mode = 'essential' | 'recommended' | 'complete';
export type ListView = 'main' | 'release' | 'chrono' | 'all';
export type Order = 'recommended' | 'release' | 'chrono';

/** TMDB'den eklenen yapım (kütüphane kaydı) */
export type LibItem = {
  m: 'movie' | 'tv'; id: number; title: string; year: number | null; p: string | null; b: string | null; added: number;
  episodeIds?: Record<string, number>;
  runtime?: number | null; seasons?: { n: number; count: number }[]; aired?: number;
  last?: { s: number; e: number; date: string } | null; next?: { s: number; e: number; date: string } | null; at?: number;
  /** türler (TMDB) */
  g?: string[];
};

/** Kendi listendeki bir yapım: evren kimliği ya da 'movie:123' / 'tv:456' */
export type ListItem = { k: string; t: string; p: string | null; y: number | null; at: number };
export type UList = { id: string; name: string; items: ListItem[]; created: number; updated: number; share?: string };
/** Aylık izleme özeti: f = film, e = bölüm, m = dakika */
export type MonthLog = { f: number; e: number; m: number };

export type State = {
  v: 2;
  replica?: import('./replica').Replica;
  onboarded: boolean;
  /** ana sayfadaki "Başlarken" kartı gösterilsin mi (yeni hesaplarda açık, kapatılınca kapanır) */
  starter?: boolean;
  name: string;
  follow: string[];
  /** film ve özel yapımlar: izlenme zamanı (ms) */
  watched: Record<string, number>;
  /** diziler: izlenen bölüm sıra numaraları (1'den başlar) */
  episodes: Record<string, number[]>;
  /** Durable IDs; numeric episodes above are only the current UI projection. */
  episodeMarks?: Record<string, string[]>;
  episodeAliases?: Record<string, Record<string,string>>;
  episodeLayouts?: Record<string, import('./episode-identity').EpisodeLayout>;
  unresolvedEpisodes?: Record<string, number[]>;
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
  /** 1-5 puanların */
  ratings: Record<string, number>;
  /** kısa notların */
  notes: Record<string, string>;
  /** TMDB'den eklediğin film ve diziler: 'movie:123' / 'tv:456' */
  lib: Record<string, LibItem>;
  /** kendi oluşturduğun listeler */
  lists: Record<string, UList>;
  /** aylık izleme özeti ('2026-10' → sayılar) */
  log: Record<string, MonthLog>;
  /** yarıda bırakılanlar: +zaman = bıraktı, −zaman = yeniden başladı (eşitlemede büyük olan kazanır) */
  dropped: Record<string, number>;
  /** filmlerde ilk izlemeden sonraki ek izleme sayısı */
  rewatch: Record<string, number>;
  /** bu cihazın kimliği (bildirim ve eşitleme için) */
  device?: string;
  /** son yedek zamanı (ms) */
  lastBackup?: number;
  /** varsayılan ayar sürümü (eski kayıtları yeni varsayılanlara taşımak için) */
  dv?: number;
};
