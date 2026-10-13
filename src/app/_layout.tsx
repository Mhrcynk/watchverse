import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, useFonts } from '@expo-google-fonts/inter';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ConfirmProvider, ToastProvider, useToast } from '@/components/ui';
import { PreviewProvider } from '@/components/preview';
import { refreshLibrary } from '@/lib/library';
import { syncCatalog } from '@/lib/remote';
import { hasSyncApi, syncDevice } from '@/lib/sync';
import { StoreProvider, useStore } from '@/lib/store';
import { AccountProvider } from '@/lib/account';
import { installErrorTracking, reportError } from '@/lib/errors';
import { Text, View } from 'react-native';
import type { ErrorBoundaryProps } from 'expo-router';
import { C } from '@/lib/theme';

installErrorTracking();
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

// Kütüphanedeki dizileri tazeler ve bildirim için cihazı ara sunucuya kaydeder
function LibrarySync() {
  const store = useStore();
  const { state } = store;
  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    let last = 0;
    const run = () => {
      if (Date.now() - last < 15 * 60 * 1000) return;
      last = Date.now();
      refreshLibrary(stateRef.current, store.libSave).catch(() => {});
    };
    run();
    const onVis = () => { if (typeof document !== 'undefined' && document.visibilityState === 'visible') run(); };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis);
    return () => { if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Takip listesi değişince (birkaç saniye sonra) sunucuya bildir
  const sig = state.follow.join(',') + '|' + Object.keys(state.lib).join(',') + '|' + Object.keys(state.episodes).length;
  useEffect(() => {
    if (!hasSyncApi()) return;
    const h = setTimeout(() => syncDevice(stateRef.current, store.ensureDevice()).catch(() => {}), 3000);
    return () => clearTimeout(h);
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
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
      <AccountProvider><ToastProvider><ConfirmProvider><PreviewProvider>
        <StatusBar style="light" />
        <CatalogSync onChange={bump} />
        <LibrarySync />
        <Stack key={catVersion} screenOptions={{ headerShown: false, freezeOnBlur: true, contentStyle: { backgroundColor: C.bg }, animation: 'slide_from_right' }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="welcome" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="universe/[id]" />
          <Stack.Screen name="title/[id]" />
          <Stack.Screen name="show/[key]" />
          <Stack.Screen name="genre/[id]" />
          <Stack.Screen name="credits" />
          <Stack.Screen name="account" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="legal/[doc]" />
        </Stack>
      </PreviewProvider></ConfirmProvider></ToastProvider></AccountProvider>
    </ThemeProvider>
  );
}

/** Beklenmeyen bir hata olursa: kaydı gönder, sade bir ekran göster */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => { reportError(error, 'ekran'); }, [error]);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: C.text, textAlign: 'center' }}>Bir şeyler ters gitti</Text>
      <Text style={{ marginTop: 10, fontSize: 15, lineHeight: 22, color: C.muted, textAlign: 'center', maxWidth: 340 }}>Kayıtların güvende; sorun kaydedildi. Tekrar denemek için aşağıdaki düğmeye dokun.</Text>
      <Text accessibilityRole="button" onPress={() => retry()} style={{ marginTop: 22, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 12, overflow: 'hidden', backgroundColor: C.accent, color: '#fff', fontSize: 15, fontWeight: '600' }}>Tekrar dene</Text>
    </View>
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
