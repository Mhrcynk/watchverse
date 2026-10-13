import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform } from 'react-native';
import { M } from './theme';

export const ND = Platform.OS !== 'web';
export const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);

/** Cihazda "hareketi azalt" açıksa true */
export function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setR(!!v)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => setR(!!v));
    return () => { alive = false; sub?.remove?.(); };
  }, []);
  return r;
}

/** Bir kez oynayan giriş değeri (0 → 1); index ile kısa aralıklarla sıralanır */
export function useEnter(index = 0, enabled = true) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(enabled ? 0 : 1)).current;
  useEffect(() => {
    if (!enabled) return;
    if (reduced) { v.setValue(1); return; }
    Animated.timing(v, { toValue: 1, duration: M.enter, delay: Math.min(index, 8) * M.stagger, easing: EASE_OUT, useNativeDriver: ND }).start();
  }, [reduced, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}
