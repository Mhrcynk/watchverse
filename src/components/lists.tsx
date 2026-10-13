import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EASE_OUT, ND } from '@/lib/motion';
import { useStore } from '@/lib/store';
import { C, F, M, R, alpha } from '@/lib/theme';
import { img, type TDetail, type TItem } from '@/lib/tmdb';
import type { ListItem, Title, UList } from '@/lib/types';
import { Btn, Press, Small, tap, useToast } from './ui';

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

/* ---------- "Listeye ekle" sayfası ---------- */
type Ctx = { pick: (item: ListItem) => void };
const PickerCtx = createContext<Ctx>({ pick: () => {} });
export const useListPicker = () => useContext(PickerCtx);

export function ListPickerProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<ListItem | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const a = useRef(new Animated.Value(0)).current;

  const pick = useCallback((it: ListItem) => { setItem(it); setName(''); setCreating(false); }, []);
  useEffect(() => { if (item) { a.setValue(0); Animated.timing(a, { toValue: 1, duration: M.base, easing: EASE_OUT, useNativeDriver: ND }).start(); } }, [item]); // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => Animated.timing(a, { toValue: 0, duration: M.fast, useNativeDriver: ND }).start(() => setItem(null));

  const lists = Object.values(store.state.lists).sort((x, y) => y.updated - x.updated);
  const create = () => {
    if (!item || !name.trim()) return;
    store.listCreate(name, item);
    tap('success');
    toast(`"${name.trim()}" listesi oluşturuldu`);
    close();
  };

  return (
    <PickerCtx.Provider value={{ pick }}>
      {children}
      <Modal transparent visible={!!item} animationType="none" onRequestClose={close}>
        <Animated.View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', opacity: a, justifyContent: 'flex-end' }}>
          <Pressable accessibilityLabel="Kapat" style={StyleSheet.absoluteFill} onPress={close} />
          {item && (
            <Animated.View accessibilityViewIsModal style={{ alignSelf: 'center', width: '100%', maxWidth: 560, maxHeight: '80%', backgroundColor: C.raised, borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl, paddingBottom: 16 + insets.bottom, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) }] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 8, gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: F.bold, fontSize: 18, color: C.text }}>Listeye ekle</Text>
                  <Small numberOfLines={1}>{item.t}</Small>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Kapat" hitSlop={10} onPress={close} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="x" size={18} color={C.text} />
                </Pressable>
              </View>
              <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 8 }}>
                {lists.map((l) => {
                  const on = l.items.some((x) => x.k === item.k);
                  return (
                    <Press key={l.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={l.name} scaleTo={0.99}
                      onPress={() => { const v = store.listToggle(l.id, item); tap(v ? 'success' : 'light'); toast(v ? `"${l.name}" listesine eklendi` : `"${l.name}" listesinden çıkarıldı`); }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: R.md }}>
                      <ListCover l={l} size={34} />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontFamily: F.semibold, fontSize: 15, color: C.text }}>{l.name}</Text>
                        <Small>{l.items.length} yapım</Small>
                      </View>
                      <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: on ? C.accent : C.dim, backgroundColor: on ? C.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                        {on && <Feather name="check" size={14} color="#fff" />}
                      </View>
                    </Press>
                  );
                })}
              </ScrollView>
              <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                {creating || !lists.length ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput value={name} onChangeText={setName} autoFocus placeholder="Liste adı, örn. Hafta sonu" placeholderTextColor={C.dim} maxLength={60}
                      accessibilityLabel="Yeni liste adı" onSubmitEditing={create} returnKeyType="done"
                      style={{ flex: 1, height: 46, borderRadius: R.md, backgroundColor: C.card, color: C.text, paddingHorizontal: 14, fontFamily: F.regular, fontSize: 15, outlineStyle: 'none' } as never} />
                    <Btn label="Oluştur" onPress={create} disabled={!name.trim()} />
                  </View>
                ) : (
                  <Press accessibilityRole="button" onPress={() => setCreating(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, paddingHorizontal: 12, borderRadius: R.md, backgroundColor: alpha(C.accent, 0.12) }}>
                    <Feather name="plus" size={18} color={C.accentSoft} />
                    <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.accentSoft }}>Yeni liste</Text>
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
