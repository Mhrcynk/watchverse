import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { EASE_OUT, ND, useReducedMotion } from '@/lib/motion';
import { C, M } from '@/lib/theme';
import { tap } from './ui';

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
export function GlassTabBar({ state, descriptors, navigation, insets }: any) {
  const routes = state.routes as { key: string; name: string }[];
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
