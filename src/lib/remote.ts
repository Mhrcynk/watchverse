import { catalogCompatible } from './catalog-compat';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CATALOG, META, applyCatalog, type RawCatalog } from './catalog';

const CACHE = 'watchverse:catalog';
/** Yayın sırasında ayarlanır (GitHub Actions). Ayarlı değilse uygulama yalnızca kendi kataloğunu kullanır. */
const URL_ = process.env.EXPO_PUBLIC_API_URL ? `${process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '')}/catalog.json` : '';

const valid = (d: unknown): d is RawCatalog =>
  !!d && typeof d === 'object' && Array.isArray((d as RawCatalog).catalog) && Array.isArray((d as RawCatalog).universes) && (d as RawCatalog).catalog.length > 100;
const revOf = (d: RawCatalog) => d.rev || d.updated || '';

/** Daha önce indirilmiş katalog uygulamayla gelenden yeniyse onu kullan */
export async function loadCachedCatalog() {
  try {
    const txt = await AsyncStorage.getItem(CACHE);
    if (!txt) return;
    const d = JSON.parse(txt);
    if (valid(d) && revOf(d) > META.rev && catalogCompatible(CATALOG, d.catalog)) applyCatalog(d);
  } catch {}
}

/** Sunucudaki kataloğu kontrol et; yeniyse uygula ve kaç yapım eklendiğini döndür */
export async function syncCatalog(): Promise<{ added: number } | null> {
  if (!URL_) return null;
  try {
    const res = await fetch(`${URL_}?t=${Date.now()}`, { headers: { 'cache-control': 'no-cache' } });
    if (!res.ok) return null;
    const d = await res.json();
    if (!valid(d) || revOf(d) <= META.rev || !catalogCompatible(CATALOG, d.catalog)) return null;
    const before = CATALOG.length;
    applyCatalog(d);
    await AsyncStorage.setItem(CACHE, JSON.stringify(d)).catch(() => {});
    return { added: Math.max(0, CATALOG.length - before) };
  } catch {
    return null;
  }
}
