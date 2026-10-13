import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, useFonts } from '@expo-google-fonts/inter';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider, useToast } from '@/components/ui';
import { syncCatalog } from '@/lib/remote';
import { StoreProvider, useStore } from '@/lib/store';
import { C } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 300, fade: true });

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: C.bg, card: C.bg, text: C.text, border: C.line, primary: C.accent },
};

// Uygulama açılınca ve her öne gelişte güncel kataloğu kontrol eder
function CatalogSync({ onChange }: { onChange: () => void }) {
  const toast = useToast();
  useEffect(() => {
    let last = 0;
    const run = async () => {
      if (Date.now() - last < 30 * 60 * 1000) return;
      last = Date.now();
      const r = await syncCatalog();
      if (r) { onChange(); if (r.added) toast(`Katalog güncellendi · ${r.added} yeni yapım`); }
    };
    run();
    const onVis = () => { if (typeof document !== 'undefined' && document.visibilityState === 'visible') run(); };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
    return () => { if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis); };
  }, [onChange, toast]);
  return null;
}

function Gate({ fontsReady }: { fontsReady: boolean }) {
  const { ready } = useStore();
  const [catVersion, setCatVersion] = useState(0);
  const bump = useCallback(() => setCatVersion((v) => v + 1), []);
  const go = ready && fontsReady;
  useEffect(() => { if (go) SplashScreen.hide(); }, [go]);
  if (!go) return null;
  return (
    <ThemeProvider value={theme}>
      <ToastProvider>
        <StatusBar style="light" />
        <CatalogSync onChange={bump} />
        <Stack key={catVersion} screenOptions={{ headerShown: false, freezeOnBlur: true, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
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
