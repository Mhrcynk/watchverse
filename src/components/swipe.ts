import { useRef } from 'react';
import { Animated, PanResponder } from 'react-native';
import { ND } from '@/lib/motion';

/** Alttan açılan pencereyi parmakla aşağı çekince kapatır */
export function useSwipeDown(onDismiss: () => void) {
  const drag = useRef(new Animated.Value(0)).current;
  const cb = useRef(onDismiss);
  cb.current = onDismiss;
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx) * 1.4,
    onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
    onPanResponderRelease: (_, g) => {
      if (g.dy > 110 || (g.dy > 30 && g.vy > 0.8)) Animated.timing(drag, { toValue: 700, duration: 170, useNativeDriver: ND }).start(() => cb.current());
      else Animated.spring(drag, { toValue: 0, friction: 8, tension: 120, useNativeDriver: ND }).start();
    },
    onPanResponderTerminate: () => Animated.spring(drag, { toValue: 0, friction: 8, useNativeDriver: ND }).start(),
  })).current;
  return { drag, handlers: pan.panHandlers, reset: () => drag.setValue(0) };
}
