import Feather from '@expo/vector-icons/Feather';
import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { EASE_OUT, ND } from '@/lib/motion';
import { C, F, M, R } from '@/lib/theme';
import { useLayout } from './ui';

type Ctx = { play: (yt: string, title?: string) => void };
const TrailerCtx = createContext<Ctx>({ play: (yt) => Linking.openURL(`https://www.youtube.com/watch?v=${yt}`) });
/** Fragmanı uygulamanın içinde oynatır (YouTube'a gitmeden) */
export const useTrailer = () => useContext(TrailerCtx);

export function TrailerProvider({ children }: { children: ReactNode }) {
  const [v, setV] = useState<{ yt: string; title?: string } | null>(null);
  const a = useRef(new Animated.Value(0)).current;
  const { width, height } = useLayout();

  const play = useCallback((yt: string, title?: string) => {
    // Web dışında gömülü oynatıcı yok; orada YouTube açılır
    if (Platform.OS !== 'web') { Linking.openURL(`https://www.youtube.com/watch?v=${yt}`); return; }
    setV({ yt, title });
  }, []);
  useEffect(() => { if (v) { a.setValue(0); Animated.timing(a, { toValue: 1, duration: M.base, easing: EASE_OUT, useNativeDriver: ND }).start(); } }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => Animated.timing(a, { toValue: 0, duration: M.fast, useNativeDriver: ND }).start(() => setV(null));

  // Yatayda ekranı doldurur, dikeyde tam genişlik
  const w = Math.min(width - 24, (height - 140) * (16 / 9), 1100);
  const src = v ? `https://www.youtube-nocookie.com/embed/${v.yt}?autoplay=1&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3` : '';

  return (
    <TrailerCtx.Provider value={{ play }}>
      {children}
      <Modal transparent visible={!!v} animationType="none" onRequestClose={close}>
        <Animated.View style={{ flex: 1, backgroundColor: 'rgba(8,9,12,0.94)', opacity: a, alignItems: 'center', justifyContent: 'center' }}>
          <Pressable accessibilityLabel="Kapat" style={StyleSheet.absoluteFill} onPress={close} />
          {v && (
            <Animated.View style={{ width: w, transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <Text numberOfLines={1} style={{ flex: 1, fontFamily: F.semibold, fontSize: 16, color: C.text }}>{v.title ? `${v.title} · Fragman` : 'Fragman'}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Fragmanı kapat" hitSlop={10} onPress={close}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.raised, alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="x" size={19} color={C.text} />
                </Pressable>
              </View>
              <View style={{ width: w, aspectRatio: 16 / 9, borderRadius: R.md, overflow: 'hidden', backgroundColor: '#000' }}>
                {createElement('iframe', {
                  src, title: v.title ? `${v.title} fragmanı` : 'Fragman', allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowFullScreen: true,
                  style: { border: 0, width: '100%', height: '100%', display: 'block' },
                })}
              </View>
            </Animated.View>
          )}
        </Animated.View>
      </Modal>
    </TrailerCtx.Provider>
  );
}
