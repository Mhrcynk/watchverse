import Ionicons from '@expo/vector-icons/Ionicons';
import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Animated, Pressable, Text, View } from 'react-native';
import { EASE_OUT, ND, useReducedMotion } from '@/lib/motion';
import { alpha, C, F, M } from '@/lib/theme';
import { useAccount } from '@/lib/account';
import { useStore } from '@/lib/store';
import { tap } from './ui';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
export const TAB_ICONS: Record<string, [IconName, IconName]> = {
  index: ['home', 'home-outline'],
  universes: ['planet', 'planet-outline'],
  explore: ['compass', 'compass-outline'],
  library: ['bookmark', 'bookmark-outline'],
  collections: ['albums', 'albums-outline'],
  profile: ['person', 'person-outline'],
};
/** Alt menünün kapladığı yükseklik (içerik bu kadar boşluk bırakır) */
export const TABBAR_SPACE = 84;
/** Alt menünün düz zemini: içerik altından okunur kalmasın diye saydam değil */
const BAR_BG = '#0F1014';

/** Alt menü: simge + yazı; seçili sekmede dolu simge ve arkasında yumuşak kapsül */
/** En son açık olan sekme: yapım sayfalarında alt menüde bu sekme seçili görünür */
let lastTab = 'index';
const TAB_LIST: { name: string; title: string; href: '/' | '/explore' | '/library' | '/collections' | '/universes' }[] = [
  { name: 'index', title: 'Ana Sayfa', href: '/' }, { name: 'explore', title: 'Keşfet', href: '/explore' },
  { name: 'library', title: 'Kütüphanem', href: '/library' },
  { name: 'collections', title: 'Koleksiyonlar', href: '/collections' },
  { name: 'universes', title: 'Evrenler', href: '/universes' },
];

export function GlassTabBar({ state, descriptors, navigation, insets }: any) {
  const routes = state.routes as { key: string; name: string }[];
  const activeTab = routes[state.index]?.name;
  useEffect(() => { if (activeTab) lastTab = activeTab; }, [activeTab]);
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 64 + Math.max(insets.bottom - 6, 6), backgroundColor: BAR_BG, borderTopWidth: 1, borderTopColor: C.lineSoft }} />
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', height: 64, marginBottom: Math.max(insets.bottom - 6, 6), alignSelf: 'center', width: '100%', maxWidth: 560, paddingHorizontal: 4 }}>
        {routes.map((r, i) => {
          const focused = state.index === i;
          const label = descriptors[r.key]?.options?.title || r.name;
          const [on, off] = TAB_ICONS[r.name] || ['ellipse', 'ellipse-outline'];
          return (
            <TabButton key={r.key} focused={focused} label={label} icon={focused ? on : off}
              onPress={() => {
                const ev = navigation.emit({ type: 'tabPress', target: r.key, canPreventDefault: true });
                if (!focused && !ev.defaultPrevented) { tap(); navigation.navigate(r.name); }
              }}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: r.key })} />
          );
        })}
      </View>
    </View>
  );
}

/** Sekmelerin dışındaki sayfalarda (yapım, evren, liste…) aynı alt menü */
export function StackTabBar() {
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const { state } = useStore();
  const acc = useAccount();
  const tabRoot = ['/', '/explore', '/library', '/collections', '/universes'].includes(path);
  const hidden = tabRoot || /^\/(welcome|onboarding|account)/.test(path) || !state.onboarded || (!acc.user && !acc.guest);
  if (hidden) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 64 + Math.max(insets.bottom - 6, 6), backgroundColor: BAR_BG, borderTopWidth: 1, borderTopColor: C.lineSoft }} />
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', height: 64, marginBottom: Math.max(insets.bottom - 6, 6), alignSelf: 'center', width: '100%', maxWidth: 560, paddingHorizontal: 4 }}>
        {TAB_LIST.map((t) => {
          const focused = lastTab === t.name;
          const [on, off] = TAB_ICONS[t.name];
          // Sekmeye dön: aradaki sayfaları kapatır (seçili sekmeye dokunmak da o sekmenin başına götürür)
          return <TabButton key={t.name} focused={focused} label={t.title} icon={focused ? on : off} onPress={() => { tap(); lastTab = t.name; router.dismissTo(t.href); }} onLongPress={() => {}} />;
        })}
      </View>
    </View>
  );
}

function TabButton({ focused, label, icon, onPress, onLongPress }: { focused: boolean; label: string; icon: IconName; onPress: () => void; onLongPress: () => void }) {
  const [s] = useState(() => new Animated.Value(1));
  const [dot] = useState(() => new Animated.Value(focused ? 1 : 0));
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) dot.setValue(focused ? 1 : 0);
    else Animated.timing(dot, { toValue: focused ? 1 : 0, duration: M.base, easing: EASE_OUT, useNativeDriver: ND }).start();
  }, [focused, reduced]); // eslint-disable-line react-hooks/exhaustive-deps
  const to = (v: number) => Animated.timing(s, { toValue: v, duration: v < 1 ? M.press : M.fast, easing: EASE_OUT, useNativeDriver: ND }).start();
  return (
    <Pressable accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: focused }} aria-selected={focused} onPress={onPress} onLongPress={onLongPress}
      onPressIn={() => to(0.86)} onPressOut={() => to(1)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ alignItems: 'center', transform: [{ scale: s }] }}>
        <Animated.View style={{ position: 'absolute', top: -4, width: 52, height: 30, borderRadius: 15, backgroundColor: alpha(C.accent, 0.16), opacity: dot }} />
        <Ionicons name={icon} size={22} color={focused ? C.accent : C.muted} />
        <Text numberOfLines={1} maxFontSizeMultiplier={1.3}
          style={{ marginTop: 5, fontFamily: focused ? F.semibold : F.medium, fontSize: 10.5, letterSpacing: 0, color: focused ? C.accent : C.muted }}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}
