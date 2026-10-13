import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { EASE_OUT, ND, useReducedMotion } from '@/lib/motion';
import { C, M } from '@/lib/theme';
import { tap } from './ui';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
export const TAB_ICONS: Record<string, [IconName, IconName]> = {
  index: ['home', 'home-outline'],
  universes: ['planet', 'planet-outline'],
  explore: ['search', 'search-outline'],
  library: ['bookmark', 'bookmark-outline'],
  profile: ['person-circle', 'person-circle-outline'],
};
/** Alt menünün kapladığı yükseklik (içerik bu kadar boşluk bırakır) */
export const TABBAR_SPACE = 84;

/** Instagram sadeliğinde, Apple cam görünümünde yüzen alt menü */
export function GlassTabBar({ state, descriptors, navigation, insets }: any) {
  const routes = state.routes as { key: string; name: string }[];
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(state.index)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) x.setValue(state.index);
    else Animated.spring(x, { toValue: state.index, friction: 9, tension: 140, useNativeDriver: ND }).start();
  }, [state.index, reduced]); // eslint-disable-line react-hooks/exhaustive-deps
  const itemW = w / routes.length;
  const glass = Platform.OS === 'web' ? ({ backdropFilter: 'blur(22px) saturate(180%)', WebkitBackdropFilter: 'blur(22px) saturate(180%)' } as any) : null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom - 10, 12), alignItems: 'center' }}>
      <View accessibilityRole="tablist" onLayout={(e) => setW(e.nativeEvent.layout.width)}
        style={[{ width: '90%', maxWidth: 420, height: 60, borderRadius: 30, flexDirection: 'row', overflow: 'hidden', backgroundColor: 'rgba(26,29,38,0.62)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.16)', shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 12 }, glass]}>
        {/* camın üst kenarındaki ışık */}
        <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']} style={[StyleSheet.absoluteFill, { height: 30 }]} />
        {itemW > 0 && (
          <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 7, bottom: 7, left: 7, width: itemW - 14, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.13)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.18)', transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, itemW] }) }] }} />
        )}
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
  const to = (v: number) => Animated.timing(s, { toValue: v, duration: v < 1 ? M.press : M.fast, easing: EASE_OUT, useNativeDriver: ND }).start();
  return (
    <Pressable accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: focused }} onPress={onPress} onLongPress={onLongPress}
      onPressIn={() => to(0.86)} onPressOut={() => to(1)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ transform: [{ scale: s }] }}>
        <Ionicons name={icon} size={25} color={focused ? C.text : 'rgba(246,247,251,0.6)'} />
      </Animated.View>
    </Pressable>
  );
}
