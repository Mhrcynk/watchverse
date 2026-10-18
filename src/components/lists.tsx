import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EASE_OUT, ND } from '@/lib/motion';
import { TBY } from '@/lib/catalog';
import { confirm } from '@/lib/confirm';
import { catalogOf } from '@/lib/library';
import { useStore } from '@/lib/store';
import { C, F, M, R, alpha } from '@/lib/theme';
import { img, type TDetail, type TItem } from '@/lib/tmdb';
import type { ListItem, State, Title, UList } from '@/lib/types';
import { Btn, Press, Small, tap, useToast } from './ui';
import { useSwipeDown } from './swipe';
import { useBackClose } from '@/lib/backclose';

/* ---------- yapım → liste kaydı ---------- */
export const itemFromTitle = (t: Title): ListItem => ({ k: t.id, t: t.trTitle || t.title, p: t.tmdb?.p || null, y: t.year, at: Date.now() });
export const itemFromTItem = (x: TItem): ListItem => ({ k: x.key, t: x.title, p: x.p, y: x.year, at: Date.now() });
export const itemFromDetail = (d: TDetail): ListItem => ({ k: `${d.m}:${d.id}`, t: d.title, p: d.p, y: d.year, at: Date.now() });

/* ---------- liste kapağı: ilk dört afiş ---------- */
export function ListCover({ l, size }: { l: UList; size: number }) {
  const ps = l.items.filter((x) => x.p).slice(0, 4);
  const cell = size / 2;
  return (
    <View style={{ width: size, height: size * 1.5, borderRadius: R.sm, overflow: 'hidden', backgroundColor: C.card, flexDirection: 'row', flexWrap: 'wrap' }}>
      {ps.length ? ps.map((x) => (
        <View key={x.k} style={{ width: ps.length === 1 ? size : cell, height: ps.length <= 2 ? size * 1.5 : size * 0.75, backgroundColor: C.raised }}>
          <Image source={{ uri: img(x.p, 'w185')! }} style={StyleSheet.absoluteFill} contentFit="cover" />
        </View>
      )) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Feather name="list" size={size * 0.24} color={C.dim} />
        </View>
      )}
    </View>
  );
}

/* ---------- kütüphane = kaydedilenlerin hepsi; listeler onun içindeki klasörler ---------- */
const catalogId = (k: string) => (TBY[k] ? k : catalogOf(k)?.id || null);
export const sameItem = (a: string, b: string) => a === b || (!!catalogId(a) && catalogId(a) === catalogId(b));
export function isSaved(s: State, k: string) {
  const c = catalogId(k);
  return c ? s.list.includes(c) || !!s.lib[k] : !!s.lib[k];
}

type Ctx = { pick: (item: ListItem) => void };
const PickerCtx = createContext<Ctx>({ pick: () => {} });
/** Kaydet penceresi: kütüphane ve listeler bir arada */
export const useListPicker = () => useContext(PickerCtx);

export function ListPickerProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<ListItem | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [a] = useState(() => new Animated.Value(0));
  const s = store.state;

  /** Kütüphaneye ekler; yoksa ekleyip pencereyi açar, varsa yalnızca açar */
  const pick = useCallback((it: ListItem) => {
    const c = catalogId(it.k);
    if (!isSaved(store.state, it.k)) {
      if (c) store.toggleList(c);
      else { const [m, n] = it.k.split(':'); store.libSave(it.k, { m: m as 'movie' | 'tv', id: Number(n), title: it.t, year: it.y, p: it.p, b: null, added: Date.now() }); }
      tap('success');
    }
    setItem(it); setName(''); setCreating(false);
  }, [store]);
  const shown = !!item;
  const release = useBackClose(shown, () => close());
  function close() { return Animated.timing(a, { toValue: 0, duration: M.fast, useNativeDriver: ND }).start(() => { setItem(null); release(); }); }
  const swipe = useSwipeDown(() => close());
  useEffect(() => { if (shown) { a.setValue(0); swipe.reset(); Animated.timing(a, { toValue: 1, duration: M.base, easing: EASE_OUT, useNativeDriver: ND }).start(); } }, [shown]); // eslint-disable-line react-hooks/exhaustive-deps

  const lists = Object.values(s.lists).sort((x, y) => y.updated - x.updated);
  const saved = !!item && isSaved(s, item.k);
  const inList = (l: UList) => !!item && l.items.some((x) => sameItem(x.k, item.k));

  const unsave = () => {
    if (!item) return;
    const c = catalogId(item.k);
    const go = () => {
      for (const l of lists) for (const x of l.items) if (sameItem(x.k, item.k)) store.listToggle(l.id, x);
      if (c && s.list.includes(c)) store.toggleList(c);
      if (s.lib[item.k]) store.libRemove(item.k);
      toast('Kütüphanenden çıkarıldı');
      close();
    };
    const progress = !c && (s.watched[item.k] || s.episodes[item.k]?.length);
    if (progress) confirm('Kütüphanenden çıkarılsın mı?', 'Bu yapım için işaretlediğin izleme kayıtları da silinir.', 'Çıkar', go);
    else go();
  };
  const toggleIn = (l: UList) => {
    if (!item) return;
    const own = l.items.find((x) => sameItem(x.k, item.k));
    const v = store.listToggle(l.id, own || item);
    tap(v ? 'success' : 'light');
  };
  const create = () => {
    if (!item || !name.trim()) return;
    store.listCreate(name, item);
    tap('success');
    toast(`"${name.trim()}" listesi oluşturuldu`);
    setCreating(false); setName('');
  };

  return (
    <PickerCtx.Provider value={{ pick }}>
      {children}
      <Modal transparent visible={!!item} animationType="none" onRequestClose={close}>
        <Animated.View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', opacity: a, justifyContent: 'flex-end' }}>
          <Pressable accessibilityLabel="Kapat" style={StyleSheet.absoluteFill} onPress={close} />
          {item && (
            <Animated.View accessibilityViewIsModal style={{ alignSelf: 'center', width: '100%', maxWidth: 560, maxHeight: '80%', backgroundColor: C.raised, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, paddingBottom: 16 + insets.bottom, transform: [{ translateY: Animated.add(a.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }), swipe.drag) }] }}>
              <View {...swipe.handlers}>
              <View style={{ alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: C.line, marginTop: 10 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 12, paddingBottom: 8, gap: 12 }}>
                <View style={{ width: 40, aspectRatio: 2 / 3, borderRadius: 6, overflow: 'hidden', backgroundColor: C.card }}>
                  {item.p && <Image source={{ uri: img(item.p, 'w185')! }} style={StyleSheet.absoluteFill} contentFit="cover" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.bold, fontSize: 18, color: C.text }}>{saved ? 'Kütüphanende' : 'Kaydet'}</Text>
                  <Small numberOfLines={1}>{item.t}</Small>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Tamam" hitSlop={10} onPress={close} style={{ paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.onAccent }}>Tamam</Text>
                </Pressable>
              </View>
              </View>
              <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 8 }}>
                <Press accessibilityRole="checkbox" accessibilityState={{ checked: saved }} aria-checked={saved} accessibilityLabel="Kütüphanem" scaleTo={0.99}
                  onPress={() => (saved ? unsave() : pick(item))} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: R.md }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: alpha(C.accent, 0.16), alignItems: 'center', justifyContent: 'center' }}>
                    <Feather name="bookmark" size={17} color={C.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.text }}>Kütüphanem</Text>
                    <Small>İzleyeceklerin ve izlediklerin</Small>
                  </View>
                  <Check on={saved} />
                </Press>
                <Text style={{ fontFamily: F.semibold, fontSize: 13, color: C.muted, marginTop: 10, marginBottom: 2, marginLeft: 10 }}>Listelerin</Text>
                {lists.map((l) => {
                  const on = inList(l);
                  return (
                    <Press key={l.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={l.name} scaleTo={0.99} onPress={() => toggleIn(l)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: R.md }}>
                      <ListCover l={l} size={34} />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontFamily: F.semibold, fontSize: 15, color: C.text }}>{l.name}</Text>
                        <Small>{l.items.length} yapım</Small>
                      </View>
                      <Check on={on} />
                    </Press>
                  );
                })}
                {!lists.length && <Small style={{ marginLeft: 10, marginBottom: 6 }}>Henüz listen yok. &quot;Hafta sonu&quot; gibi bir liste açıp kütüphaneni gruplayabilirsin.</Small>}
              </ScrollView>
              <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                {creating ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput value={name} onChangeText={setName} autoFocus placeholder="Liste adı, örn. Hafta sonu" placeholderTextColor={C.dim} maxLength={60}
                      accessibilityLabel="Yeni liste adı" onSubmitEditing={create} returnKeyType="done"
                      style={{ flex: 1, height: 46, borderRadius: R.md, backgroundColor: C.card, color: C.text, paddingHorizontal: 14, fontFamily: F.regular, fontSize: 16 } as never} />
                    <Btn label="Oluştur" onPress={create} disabled={!name.trim()} />
                  </View>
                ) : (
                  <Press accessibilityRole="button" accessibilityLabel="Yeni liste" onPress={() => setCreating(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, paddingHorizontal: 12, borderRadius: R.md, backgroundColor: alpha('#FFFFFF', 0.06) }}>
                    <Feather name="plus" size={18} color={C.text} />
                    <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.text }}>Yeni liste</Text>
                  </Press>
                )}
              </View>
            </Animated.View>
          )}
        </Animated.View>
      </Modal>
    </PickerCtx.Provider>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: on ? C.accent : C.dim, backgroundColor: on ? C.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      {on && <Feather name="check" size={14} color={C.onAccent} />}
    </View>
  );
}
