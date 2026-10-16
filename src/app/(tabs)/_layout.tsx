import Feather from '@expo/vector-icons/Feather';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/tabs';
import { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';
import { ND, useReducedMotion } from '@/lib/motion';
import { alpha } from '@/lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLayout } from '@/components/ui';
import { GlassTabBar } from '@/components/glass-tabbar';
import { useStore } from '@/lib/store';
import { useAccount } from '@/lib/account';
import { ActivityIndicator } from 'react-native';
import { C, F } from '@/lib/theme';

const TABS = [
  { name: 'index', title: 'Ana Sayfa', icon: 'home' },
  { name: 'explore', title: 'Keşfet', icon: 'search' },
  { name: 'library', title: 'Kütüphanem', icon: 'bookmark' },
  { name: 'collections', title: 'Koleksiyonlar', icon: 'layers' },
  { name: 'universes', title: 'Evrenler', icon: 'globe' },
] as const;

export default function TabsLayout() {
  const { state, setState } = useStore();
  const { tablet } = useLayout();
  const insets = useSafeAreaInsets();
  const acc = useAccount();
  // Yeni kullanıcı: evren seçimi ekranı yok; doğrudan ana sayfa ve orada "Başlarken" kartı
  const fresh = acc.ready && (acc.user ? acc.firstSync : acc.guest) && !state.onboarded;
  useEffect(() => { if (fresh) setState((s) => (s.onboarded ? s : { ...s, onboarded: true, starter: true })); }, [fresh, setState]);
  // Açılış: önce tanıtım ve giriş, sonra evren seçimi
  if (!acc.ready) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  if (!acc.user && !acc.guest) return <Redirect href="/welcome" />;
  if (!state.onboarded && acc.user && !acc.firstSync) {
    // Hesabın başka cihazdaki kaydı gelirken bekle
    return <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.accent} /></View>;
  }
  if (!state.onboarded) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  return (
    <Tabs
      tabBar={tablet ? undefined : (props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        tabBarPosition: tablet ? 'left' : 'bottom',
        tabBarVariant: tablet ? 'material' : 'uikit',
        tabBarActiveTintColor: C.text,
        tabBarInactiveTintColor: C.dim,
        tabBarLabelStyle: tablet ? { fontFamily: F.medium, fontSize: 14, flexShrink: 0 } : { fontFamily: F.medium, fontSize: 11 },
        tabBarStyle: tablet
          ? { backgroundColor: C.bg, borderRightColor: C.line, borderRightWidth: 1, width: 208, minWidth: 208, maxWidth: 208, paddingTop: insets.top + 24 }
          : { backgroundColor: '#0A0A0C', borderTopColor: C.lineSoft, height: 64 + insets.bottom, paddingTop: 8 },
        tabBarActiveBackgroundColor: tablet ? C.raised : 'transparent',
        tabBarItemStyle: tablet ? { borderRadius: 12, marginHorizontal: 12, marginVertical: 2, height: 46, justifyContent: 'flex-start' } : undefined,
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarAccessibilityLabel: t.title,
            tabBarIcon: ({ color, focused }) => <TabIcon name={t.icon} color={color} focused={focused} pill={!tablet} />,
          }}
        />
      ))}
    </Tabs>
  );
}

/** Seçili sekmede ikonun arkasında beliren yumuşak kapsül */
function TabIcon({ name, color, focused, pill }: { name: React.ComponentProps<typeof Feather>['name']; color: any; focused: boolean; pill: boolean }) {
  const [a] = useState(() => new Animated.Value(focused ? 1 : 0));
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) a.setValue(focused ? 1 : 0);
    else Animated.spring(a, { toValue: focused ? 1 : 0, friction: 7, tension: 160, useNativeDriver: ND }).start();
  }, [focused, reduced]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={{ width: pill ? 56 : 28, height: 30, alignItems: 'center', justifyContent: 'center' }}>
      {pill && <Animated.View style={{ position: 'absolute', width: 56, height: 30, borderRadius: 15, backgroundColor: alpha(C.accent, 0.2), opacity: a, transform: [{ scaleX: a.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }} />}
      <Feather name={name} size={21} color={focused ? C.accentSoft : color} />
    </View>
  );
}
