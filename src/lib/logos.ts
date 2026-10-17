import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { CATALOG } from './catalog';
import type { Title } from './types';

/**
 * Evren logoları TMDB'den gelir: Marvel ve DC için stüdyonun resmî logosu,
 * diğerlerinde evrenin ilk ana yapımının yazı logosu (ör. Star Wars, Jurassic Park).
 */
const API = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
const COMPANY: Record<string, string> = { marvel: 'Marvel Studios', dc: 'DC Studios' };
const KEY = 'watchverse:logos';
const IMG = 'https://image.tmdb.org/t/p/w500';

/** Evrenin vitrin yapımı: ilk ana hikâye yapımı (çıkış sırasıyla) */
export function flagship(u: string): Title | null {
  const list = CATALOG.filter((t) => t.u === u && t.tmdb?.id && t.tmdb.id > 0);
  return list.filter((t) => t.tier === 0).sort((a, b) => a.release - b.release)[0] || list[0] || null;
}
/** Evrenin arka plan görseli: en yeni ana yapımın geniş görseli */
export function backdropOf(u: string): string | null {
  const list = CATALOG.filter((t) => t.u === u && t.tier === 0 && t.tmdb?.b).sort((a, b) => b.release - a.release);
  const t = list[0] || CATALOG.find((x) => x.u === u && x.tmdb?.b);
  return t?.tmdb?.b ? `https://image.tmdb.org/t/p/w780${t.tmdb.b}` : null;
}

let cache: Record<string, string> | null = null;
const waiting: Record<string, Promise<string | null>> = {};
async function load() {
  if (cache) return cache;
  try { cache = JSON.parse((await AsyncStorage.getItem(KEY)) || '{}') || {}; } catch { cache = {}; }
  return cache!;
}
const get = async (p: string) => { const r = await fetch(`${API}/tmdb${p}`); if (!r.ok) throw new Error(String(r.status)); return r.json(); };
const pickLogo = (logos: { file_path: string; iso_639_1: string | null; vote_average: number; aspect_ratio: number }[]) =>
  logos.filter((l) => l.iso_639_1 === 'en' || l.iso_639_1 === null).sort((a, b) => b.vote_average - a.vote_average)[0]?.file_path || null;

async function fetchLogo(u: string): Promise<string> {
  if (COMPANY[u]) {
    const s = await get(`/search/company?query=${encodeURIComponent(COMPANY[u])}`);
    const c = (s.results || []).find((x: { name: string }) => x.name.toLowerCase() === COMPANY[u].toLowerCase()) || s.results?.[0];
    if (c?.logo_path) return IMG + c.logo_path;
  }
  const t = flagship(u);
  if (!t?.tmdb) return '';
  const j = await get(`/${t.tmdb.m || t.media}/${t.tmdb.id}/images?include_image_language=en,null&language=en`);
  const p = pickLogo(j.logos || []);
  return p ? IMG + p : '';
}

/** Evren logosu (yüklenene kadar null, logo yoksa '') */
export function useUniverseLogo(u: string): string | null {
  const [result, setResult] = useState<{ u: string; value: string } | null>(null);
  useEffect(() => {
    let alive = true;
    if (!API) return;
    load().then((c) => {
      if (c[u] !== undefined) { if (alive) setResult({ u, value: c[u] }); return; }
      // ağ hatasında kaydetme; bir sonraki açılışta yeniden denenir
      waiting[u] ||= fetchLogo(u).catch(() => null);
      waiting[u].then((url) => {
        if (url === null) { delete waiting[u]; if (alive) setResult({ u, value: '' }); return; }
        c[u] = url;
        AsyncStorage.setItem(KEY, JSON.stringify(c)).catch(() => {});
        if (alive) setResult({ u, value: url });
      });
    });
    return () => { alive = false; };
  }, [u]);
  return !API ? '' : result?.u === u ? result.value : cache?.[u] ?? null;
}
