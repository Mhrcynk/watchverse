import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { libFromDetail, libFromItem, routeOf } from '@/lib/library';
import { EASE_OUT, ND } from '@/lib/motion';
import { useStore } from '@/lib/store';
import { C, F, M, R } from '@/lib/theme';
import { detail, img, type TDetail, type TItem } from '@/lib/tmdb';
import { Btn, Small, tap, useToast } from './ui';
import { itemFromTItem, useListPicker } from './lists';

type Ctx = { open: (x: TItem) => void };
const PreviewCtx = createContext<Ctx>({ open: (x) => router.push(routeOf(x.key)) });
export const usePreview = () => useContext(PreviewCtx);

export const scoreText = (v: number, votes: number) => (v > 0 && votes >= 15 ? `★ ${v.toFixed(1)}` : null);

/** Karta dokununca alttan açılan kısa önizleme (Netflix mobildeki gibi) */
export function PreviewProvider({ children }: { children: ReactNode }) {
  const [x, setX] = useState<TItem | null>(null);
  const [d, setD] = useState<TDetail | null>(null);
  const a = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const store = useStore();
  const toast = useToast();
  const { pick } = useListPicker();

  const open = useCallback((it: TItem) => {
    const r = routeOf(it.key);
    // Evren kataloğundakiler doğrudan kendi sayfasına
    if (r.startsWith('/title/')) { router.push(r); return; }
    setD(null); setX(it);
    detail(it.m, it.id).then(setD).catch(() => {});
  }, []);
  useEffect(() => { if (x) { a.setValue(0); Animated.timing(a, { toValue: 1, duration: M.base, easing: EASE_OUT, useNativeDriver: ND }).start(); } }, [x]); // eslint-disable-line react-hooks/exhaustive-deps
  const close = (then?: () => void) => Animated.timing(a, { toValue: 0, duration: M.fast, useNativeDriver: ND }).start(() => { setX(null); then?.(); });

  const key = x?.key || '';
  const inLib = !!(x && store.state.lib[key]);
  const watched = !!(x && store.state.watched[key]);
  const meta = x ? [x.year, x.m === 'movie' ? 'Film' : 'Dizi', d && x.m === 'movie' && d.runtime ? `${Math.floor(d.runtime / 60)} sa ${d.runtime % 60} dk` : null, d && x.m === 'tv' ? `${d.seasons.length} sezon` : null].filter(Boolean).join(' · ') : '';
  const score = x ? scoreText(x.vote, x.votes) : null;

  return (
    <PreviewCtx.Provider value={{ open }}>
      {children}
      <Modal transparent visible={!!x} animationType="none" onRequestClose={() => close()}>
        <Animated.View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', opacity: a, justifyContent: 'flex-end' }}>
          <Pressable accessibilityLabel="Kapat" style={StyleSheet.absoluteFill} onPress={() => close()} />
          {x && (
            <Animated.View accessibilityViewIsModal style={{ alignSelf: 'center', width: '100%', maxWidth: 560, backgroundColor: C.raised, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, overflow: 'hidden', paddingBottom: 18 + insets.bottom, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) }] }}>
              <View style={{ flexDirection: 'row', gap: 14, padding: 16 }}>
                <View style={{ width: 96, aspectRatio: 2 / 3, borderRadius: R.sm, overflow: 'hidden', backgroundColor: C.card }}>
                  {x.p && <Image source={{ uri: img(x.p, 'w342')! }} style={StyleSheet.absoluteFill} contentFit="cover" />}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <Text numberOfLines={2} style={{ flex: 1, fontFamily: F.bold, fontSize: 19, lineHeight: 24, color: C.text }}>{x.title}</Text>
                    <Pressable accessibilityRole="button" accessibilityLabel="Kapat" hitSlop={10} onPress={() => close()} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
                      <Feather name="x" size={18} color={C.text} />
                    </Pressable>
                  </View>
                  <Small style={{ marginTop: 4 }}>{meta}{score ? `  ${score}` : ''}</Small>
                  {!!d?.genres.length && <Small style={{ marginTop: 2, color: C.muted }}>{d.genres.slice(0, 3).join(' · ')}</Small>}
                  <Text numberOfLines={4} style={{ marginTop: 8, fontFamily: F.regular, fontSize: 14, lineHeight: 20, color: '#D8D8DE' }}>{x.overview || d?.overview || 'Konu bilgisi yok.'}</Text>
                  {!!d?.pl.length && <Small style={{ marginTop: 6, color: C.accentSoft }}>{d.pl.slice(0, 3).join(' · ')}</Small>}
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16 }}>
                <Btn style={{ flex: 1 }} icon={inLib ? 'check' : 'plus'} kind={inLib ? 'success' : 'primary'} label={inLib ? 'Listemde' : 'Listeme ekle'}
                  onPress={() => { if (inLib) { store.libRemove(key); toast('Kütüphaneden çıkarıldı'); } else { store.libSave(key, d ? libFromDetail(d) : libFromItem(x)); tap('success'); toast('Kütüphanene eklendi'); } }} />
                {x.m === 'movie' && (
                  <Btn kind="secondary" icon="check-circle" label={watched ? 'İzlendi' : 'İzledim'}
                    onPress={() => { if (!inLib) store.libSave(key, d ? libFromDetail(d) : libFromItem(x)); store.watchKey(key, !watched); tap(watched ? 'light' : 'success'); }} />
                )}
                {!!d?.yt && <Btn kind="secondary" icon="play" label="" accessibilityLabel="Fragmanı izle" onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${d.yt}`)} />}
                <Btn kind="secondary" icon="list" label="" accessibilityLabel="Listeye ekle" onPress={() => { const it = itemFromTItem(x); close(() => pick(it)); }} />
              </View>
              <Pressable accessibilityRole="button" onPress={() => close(() => router.push(`/show/${key}`))}
                style={{ marginTop: 14, marginHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Feather name="info" size={18} color={C.muted} />
                <Text style={{ flex: 1, fontFamily: F.semibold, fontSize: 15, color: C.text }}>{x.m === 'tv' ? 'Bölümler ve ayrıntılar' : 'Ayrıntılar'}</Text>
                <Feather name="chevron-right" size={18} color={C.dim} />
              </Pressable>
              <LinearGradient pointerEvents="none" colors={['rgba(227,38,47,0.18)', 'transparent']} style={[StyleSheet.absoluteFill, { height: 120 }]} />
            </Animated.View>
          )}
        </Animated.View>
      </Modal>
    </PreviewCtx.Provider>
  );
}
