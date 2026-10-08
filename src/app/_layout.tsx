import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, useFonts } from '@expo-google-fonts/inter';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '@/components/ui';
import { StoreProvider, useStore } from '@/lib/store';
import { C } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 300, fade: true });

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: C.bg, card: C.bg, text: C.text, border: C.line, primary: C.accent },
};

function Gate({ fontsReady }: { fontsReady: boolean }) {
  const { ready } = useStore();
  const go = ready && fontsReady;
  useEffect(() => { if (go) SplashScreen.hide(); }, [go]);
  if (!go) return null;
  return (
    <ThemeProvider value={theme}>
      <ToastProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, freezeOnBlur: true, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="universe/[id]" />
          <Stack.Screen name="title/[id]" />
          <Stack.Screen name="credits" />
        </Stack>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  return (
    <SafeAreaProvider style={{ backgroundColor: C.bg }}>
      <StoreProvider>
        <Gate fontsReady={loaded || !!error} />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
