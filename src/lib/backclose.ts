import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Pencere açıkken tarayıcının / Android'in geri hareketi önce pencereyi kapatır, sayfayı değiştirmez.
 * Açılışta geçmişe sahte bir kayıt eklenir; geri gelince bu kayıt yutulur ve pencere kapanır.
 * Pencere düğmeyle kapanırsa sahte kayıt geri alınır; ardından yapılacak sayfa geçişi bu işlem bitince çalışır.
 */
const web = Platform.OS === 'web' && typeof window !== 'undefined' && typeof history !== 'undefined';
type Entry = { id: number; back: () => void };
const stack: Entry[] = [];
const pending: (() => void)[] = [];
let seq = 0;

if (web) {
  // Yönlendiricinin dinleyicisinden önce çalışsın diye yakalama aşamasında
  window.addEventListener('popstate', (e) => {
    if (pending.length) {
      e.stopImmediatePropagation();
      const f = pending.shift()!;
      setTimeout(f, 0);
      return;
    }
    const top = stack.pop();
    if (top) { e.stopImmediatePropagation(); top.back(); }
  }, true);
}

export function useBackClose(open: boolean, onBack: () => void) {
  const cb = useRef(onBack);
  cb.current = onBack;
  const me = useRef<number | null>(null);

  /** Düğmeyle kapanırken çağrılır; then, geçmiş kaydı temizlendikten sonra çalışır */
  const release = useCallback((then?: () => void) => {
    const id = me.current;
    me.current = null;
    const i = id == null ? -1 : stack.findIndex((x) => x.id === id);
    if (!web || i < 0) { then?.(); return; }
    stack.splice(i, 1);
    // Bu arada başka sayfaya geçildiyse kayıt üstte değildir; geri gitmeyiz
    if ((history.state as any)?.__wv !== id) { then?.(); return; }
    pending.push(then || (() => {}));
    history.back();
  }, []);

  useEffect(() => {
    if (!web) return;
    if (open && me.current == null) {
      const id = ++seq;
      me.current = id;
      stack.push({ id, back: () => { me.current = null; cb.current(); } });
      history.pushState({ ...(history.state || {}), __wv: id }, '');
    } else if (!open && me.current != null) release();
  }, [open, release]);

  // Bileşen kaybolursa kaydı bırak
  useEffect(() => () => { if (me.current != null) release(); }, [release]);
  return release;
}
