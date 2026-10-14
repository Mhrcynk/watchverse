import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Animated, Pressable, View } from 'react-native';
import { EASE_OUT, ND, useReducedMotion } from '@/lib/motion';
import { C, M } from '@/lib/theme';
import { useAccount } from '@/lib/account';
import { useStore } from '@/lib/store';
import { tap, useLayout } from './ui';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
export const TAB_ICONS: Record<string, [IconName, IconName]> = {
  index: ['home', 'home-outline'],
  universes: ['planet', 'planet-outline'],
  explore: ['compass', 'compass-outline'],
  library: ['bookmark', 'bookmark-outline'],
  profile: ['person', 'person-outline'],
};
/** Alt menünün kapladığı yükseklik (içerik bu kadar boşluk bırakır) */
export const TABBAR_SPACE = 84;

/** Sade alt menü: ince çizgili simgeler, seçilende dolu simge ve altında küçük nokta */
/** En son açık olan sekme: yapım sayfalarında alt menüde bu sekme seçili görünür */
let lastTab = 'index';
const TAB_LIST: { name: string; title: string; href: '/' | '/explore' | '/library' | '/universes' }[] = [
  { name: 'index', title: 'Ana Sayfa', href: '/' }, { name: 'explore', title: 'Keşfet', href: '/explore' },
  { name: 'library', title: 'Kütüphanem', href: '/library' }, { name: 'universes', title: 'Evrenler', href: '/universes' },
];

export function GlassTabBar({ state, descriptors, navigation, insets }: any) {
  const routes = state.routes as { key: string; name: string }[];
  lastTab = routes[state.index]?.name || lastTab;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      <LinearGradient pointerEvents="none" colors={['rgba(21,23,29,0)', 'rgba(21,23,29,0.96)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 }} />
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', height: 64, marginBottom: Math.max(insets.bottom - 6, 6), alignSelf: 'center', width: '100%', maxWidth: 520, paddingHorizontal: 12 }}>
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
  const { tablet } = useLayout();
  const { state } = useStore();
  const acc = useAccount();
  const tabRoot = ['/', '/explore', '/library', '/universes'].includes(path);
  const hidden = tabRoot || /^\/(welcome|onboarding|account)/.test(path) || !state.onboarded || (!acc.user && !acc.guest);
  if (hidden) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      <LinearGradient pointerEvents="none" colors={['rgba(21,23,29,0)', 'rgba(21,23,29,0.96)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 }} />
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', height: 64, marginBottom: Math.max(insets.bottom - 6, 6), alignSelf: 'center', width: '100%', maxWidth: 520, paddingHorizontal: 12 }}>
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
  const s = useRef(new Animated.Value(1)).current;
  const dot = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) dot.setValue(focused ? 1 : 0);
    else Animated.timing(dot, { toValue: focused ? 1 : 0, duration: M.base, easing: EASE_OUT, useNativeDriver: ND }).start();
  }, [focused, reduced]); // eslint-disable-line react-hooks/exhaustive-deps
  const to = (v: number) => Animated.timing(s, { toValue: v, duration: v < 1 ? M.press : M.fast, easing: EASE_OUT, useNativeDriver: ND }).start();
  return (
    <Pressable accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: focused }} onPress={onPress} onLongPress={onLongPress}
      onPressIn={() => to(0.86)} onPressOut={() => to(1)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ transform: [{ scale: s }] }}>
        <Ionicons name={icon} size={24} color={focused ? C.text : C.dim} />
      </Animated.View>
      <Animated.View style={{ width: 5, height: 5, borderRadius: 3, marginTop: 6, backgroundColor: C.text, opacity: dot, transform: [{ scale: dot }] }} />
    </Pressable>
  );
}
