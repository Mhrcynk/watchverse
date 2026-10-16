import { useCallback, useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';
/** Android back closes the top active overlay. Native Modal uses onRequestClose. */
export function useBackClose(open: boolean, onBack: () => void) {
  const callback = useRef(onBack);
  useEffect(() => { callback.current = onBack; }, [onBack]);
  useEffect(() => {
    if (!open) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { callback.current(); return true; });
    return () => listener.remove();
  }, [open]);
  return useCallback((then?: () => void) => then?.(), []);
}
