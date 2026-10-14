import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TBY, TIER_TR, UBY } from '@/lib/catalog';
import { catalogOf, libFromDetail, libFromItem } from '@/lib/library';
import { EASE_OUT, ND } from '@/lib/motion';
import { useStore } from '@/lib/store';
import { C, F, M, R, alpha } from '@/lib/theme';
import { detail, img, type TDetail, type TItem } from '@/lib/tmdb';
import type { Title } from '@/lib/types';
import { Btn, Small, tap, useToast } from './ui';
import { isSaved, itemFromTitle, itemFromTItem, useListPicker } from './lists';
import { useTrailer } from './trailer';

type IconName = React.ComponentProps<typeof Feather>['name'];
type Lite = { title: string; year: number | null; p: string | null };
type Ctx = { open: (x: TItem) => void; openTitle: (t: Title) => void; openKey: (k: string, f: Lite) => void };
const PreviewCtx = createContext<Ctx>({ open: () => {}, openTitle: (t) => router.push(`/title/${t.id}`), openKey: () => {} });
export const usePreview = () => useContext(PreviewCtx);

export const scoreText = (v: number, votes: number) => (v > 0 && votes >= 15 ? `★ ${v.toFixed(1)}` : null);

/** Evren kataloğundaki bir yapımı önizleme için TMDB biçimine çevirir */
const fromTitle = (t: Title): TItem => ({
  key: t.tmdb ? `${t.tmdb.m || (t.type === 'Dizi' ? 'tv' : 'movie')}:${t.tmdb.id}` : t.id, m: t.tmdb?.m || (t.type === 'Dizi' ? 'tv' : 'movie'), id: t.tmdb?.id || 0,
  title: t.trTitle || t.title, orig: t.title, year: t.year, date: null, p: t.tmdb?.p || null, b: t.tmdb?.b || null, overview: t.summary || '', vote: 0, votes: 0, lang: 'en',
});

/**
 * Bir yapıma dokununca her yerde aynı pencere açılır.
 * Evren kataloğundaki yapımlarda kayıtlar katalog kimliğiyle, diğerlerinde TMDB anahtarıyla tutulur;
 * kullanıcı bu farkı görmez: düğmeler ve adları aynıdır.
 */
export function PreviewProvider({ children }: { children: ReactNode }) {
  const [x, setX] = useState<TItem | null>(null);
  const [cat, setCat] = useState<Title | null>(null);
  const [d, setD] = useState<TDetail | null>(null);
  const a = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const store = useStore();
  const toast = useToast();
  const { pick } = useListPicker();
  const { play } = useTrailer();

  const show = useCallback((it: TItem, t: Title | null) => {
    setD(null); setCat(t); setX(it);
    if (it.id) detail(it.m, it.id).then(setD).catch(() => {});
  }, []);
  const open = useCallback((it: TItem) => {
    const t = catalogOf(it.key);
    show(t && !it.overview && t.summary ? { ...it, overview: t.summary } : it, t);
  }, [show]);
  const openTitle = useCallback((t: Title) => show(fromTitle(t), t), [show]);
  /** Kütüphane ve liste kayıtları: katalog kimliği ya da "movie:123" anahtarı */
  const openKey = useCallback((k: string, f: Lite) => {
    if (TBY[k]) return openTitle(TBY[k]);
    const [m, n] = k.split(':');
    open({ key: k, m: m as TItem['m'], id: Number(n), title: f.title, orig: f.title, year: f.year, date: null, p: f.p, b: null, overview: '', vote: 0, votes: 0, lang: '' });
  }, [open, openTitle]);
  useEffect(() => { if (x) { a.setValue(0); Animated.timing(a, { toValue: 1, duration: M.base, easing: EASE_OUT, useNativeDriver: ND }).start(); } }, [x]); // eslint-disable-line react-hooks/exhaustive-deps
  const close = (then?: () => void) => Animated.timing(a, { toValue: 0, duration: M.fast, useNativeDriver: ND }).start(() => { setX(null); setCat(null); then?.(); });

  const s = store.state;
  const key = x?.key || '';
  const inLib = !!x && (cat ? isSaved(s, cat.id) : isSaved(s, key));
  const watched = cat ? !!s.watched[cat.id] : !!(x && s.watched[key]);
  const isMovie = cat ? cat.type !== 'Dizi' && !cat.episodes : x?.m === 'movie';
  const runtime = cat && !cat.episodes ? cat.minutes : d?.runtime;
  const meta = x ? [x.year, x.m === 'movie' ? 'Film' : 'Dizi', isMovie && runtime ? `${Math.floor(runtime / 60)} sa ${runtime % 60} dk` : null, d && x.m === 'tv' ? `${d.seasons.length} sezon` : null].filter(Boolean).join(' · ') : '';
  const score = x ? scoreText(d?.vote ?? x.vote, d?.votes ?? x.votes) : null;
  const u = cat ? UBY[cat.u] : null;
  const yt = cat?.yt || d?.yt;

  const saveOpen = () => {
    if (!x) return;
    // TMDB yapımında ayrıntı varsa önce zengin kaydı yaz (sezonlar, süre)
    if (!cat && !inLib) store.libSave(key, d ? libFromDetail(d) : libFromItem(x));
    const it = cat ? itemFromTitle(cat) : itemFromTItem(x);
    close(() => pick(it));
  };
  const toggleWatched = () => {
    if (!x) return;
    if (cat) { const v = store.toggleWatched(cat.id); tap(v ? 'success' : 'light'); return; }
    if (!inLib) store.libSave(key, d ? libFromDetail(d) : libFromItem(x));
    store.watchKey(key, !watched); tap(watched ? 'light' : 'success');
  };
  const goDetail = () => close(() => router.push(cat ? `/title/${cat.id}` : `/show/${key}`));

  return (
    <PreviewCtx.Provider value={{ open, openTitle, openKey }}>
      {children}
      <Modal transparent visible={!!x} animationType="none" onRequestClose={() => close()}>
        <Animated.View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', opacity: a, justifyContent: 'flex-end' }}>
          <Pressable accessibilityLabel="Kapat" style={StyleSheet.absoluteFill} onPress={() => close()} />
          {x && (
            <Animated.View accessibilityViewIsModal style={{ alignSelf: 'center', width: '100%', maxWidth: 560, backgroundColor: C.raised, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, overflow: 'hidden', paddingBottom: 18 + insets.bottom, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) }] }}>
              <View style={{ alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: C.line, marginTop: 10 }} />
              <View style={{ flexDirection: 'row', gap: 14, padding: 16, paddingTop: 12 }}>
                <Pressable accessibilityRole="button" accessibilityLabel={`${x.title} ayrıntıları`} onPress={goDetail}
                  style={{ width: 96, aspectRatio: 2 / 3, borderRadius: R.sm, overflow: 'hidden', backgroundColor: C.card }}>
                  {x.p && <Image source={{ uri: img(x.p, 'w342')! }} style={StyleSheet.absoluteFill} contentFit="cover" />}
                </Pressable>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      {u && <Text numberOfLines={1} style={{ fontFamily: F.semibold, fontSize: 12.5, color: C.accent, marginBottom: 3 }}>{u.name} · {TIER_TR[cat!.tier]}</Text>}
                      <Text numberOfLines={2} style={{ fontFamily: F.bold, fontSize: 19, lineHeight: 24, color: C.text }}>{x.title}</Text>
                    </View>
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

              <View style={{ paddingHorizontal: 16 }}>
                <Btn icon="bookmark" kind={inLib ? 'success' : 'primary'} label={inLib ? 'Kütüphanende' : 'Kaydet'}
                  accessibilityLabel={inLib ? 'Kütüphanende; listeleri düzenle' : 'Kütüphaneme kaydet'} onPress={saveOpen} />
                {(isMovie || !!yt) && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    {isMovie && <Action icon="check-circle" label={watched ? 'İzlendi' : 'İzledim'} on={watched} onPress={toggleWatched} />}
                    {!!yt && <Action icon="play" label="Fragman" onPress={() => play(yt, x.title)} />}
                  </View>
                )}
              </View>

              <Pressable accessibilityRole="button" onPress={goDetail}
                style={{ marginTop: 14, marginHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Feather name="info" size={18} color={C.muted} />
                <Text style={{ flex: 1, fontFamily: F.semibold, fontSize: 15, color: C.text }}>{cat ? (cat.episodes ? 'Bölümler, evren ve ayrıntılar' : 'Evrendeki yeri ve ayrıntılar') : x.m === 'tv' ? 'Bölümler ve ayrıntılar' : 'Ayrıntılar'}</Text>
                <Feather name="chevron-right" size={18} color={C.dim} />
              </Pressable>
            </Animated.View>
          )}
        </Animated.View>
      </Modal>
    </PreviewCtx.Provider>
  );
}

/** Simge + yazı: her düğmenin ne yaptığı yazıyla belli */
function Action({ icon, label, onPress, on }: { icon: IconName; label: string; onPress: () => void; on?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={on != null ? { checked: on } : undefined} onPress={onPress}
      style={({ pressed }) => ({ flex: 1, height: 46, borderRadius: R.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: on ? alpha(C.green, 0.16) : alpha('#FFFFFF', pressed ? 0.1 : 0.06) })}>
      <Feather name={icon} size={16} color={on ? C.green : C.text} />
      <Text numberOfLines={1} style={{ fontFamily: F.semibold, fontSize: 13.5, color: on ? C.green : C.text }}>{label}</Text>
    </Pressable>
  );
}
