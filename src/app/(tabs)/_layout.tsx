import Feather from '@expo/vector-icons/Feather';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/tabs';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLayout } from '@/components/ui';
import { useStore } from '@/lib/store';
import { C, F } from '@/lib/theme';

const TABS = [
  { name: 'index', title: 'Ana Sayfa', icon: 'home' },
  { name: 'universes', title: 'Evrenler', icon: 'globe' },
  { name: 'explore', title: 'Keşfet', icon: 'search' },
  { name: 'profile', title: 'Profil', icon: 'user' },
] as const;

export default function TabsLayout() {
  const { state } = useStore();
  const { tablet } = useLayout();
  const insets = useSafeAreaInsets();
  if (!state.onboarded) return <Redirect href="/onboarding" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        tabBarPosition: tablet ? 'left' : 'bottom',
        tabBarVariant: tablet ? 'material' : 'uikit',
        tabBarActiveTintColor: C.text,
        tabBarInactiveTintColor: C.dim,
        tabBarLabelStyle: { fontFamily: F.medium, fontSize: tablet ? 13 : 11 },
        tabBarStyle: tablet
          ? { backgroundColor: C.bg, borderRightColor: C.line, borderRightWidth: 1, width: 208, minWidth: 208, maxWidth: 208, paddingTop: insets.top + 24 }
          : { backgroundColor: '#0E1017', borderTopColor: C.line, height: 62 + insets.bottom, paddingTop: 6 },
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
            tabBarIcon: ({ color, focused }) => (
              <View style={{ alignItems: 'center' }}>
                <Feather name={t.icon} size={21} color={focused ? C.accentSoft : color} />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
