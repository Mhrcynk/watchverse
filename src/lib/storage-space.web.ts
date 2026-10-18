/**
 * Web: tarayıcı depolaması (yaklaşık 5 MB) dolunca yalnızca yeniden indirilebilen önbellekleri siler.
 * İzleme kayıtları, eşitleme bilgisi ve oturum anahtarları ASLA silinmez.
 */
const CACHE_PREFIXES = ['wv:tmdb:'];
const CACHE_KEYS = ['watchverse:catalog', 'watchverse:logos', 'watchverse:collections', 'watchverse:lists', 'watchverse:lists2'];

export async function freeCacheSpace(): Promise<boolean> {
  try {
    const remove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (CACHE_KEYS.includes(key) || CACHE_PREFIXES.some((p) => key.startsWith(p)))) remove.push(key);
    }
    remove.forEach((key) => localStorage.removeItem(key));
    return remove.length > 0;
  } catch {
    return false;
  }
}
