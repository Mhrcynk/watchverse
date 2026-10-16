import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, useFonts } from '@expo-google-fonts/inter';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ConfirmProvider, ToastProvider, useToast } from '@/components/ui';
import { PreviewProvider } from '@/components/preview';
import { TrailerProvider } from '@/components/trailer';
import { StackTabBar } from '@/components/glass-tabbar';
import { ListPickerProvider } from '@/components/lists';
import { SharedListsSync } from '@/components/share';
import { FriendsSync } from '@/components/friends-sync';
import { refreshLibrary } from '@/lib/library';
import { syncCatalog } from '@/lib/remote';
import { hasSyncApi, syncDevice } from '@/lib/sync';
import { checkpoint } from '@/lib/checkpoint';
import { StoreProvider, useStore } from '@/lib/store';
import { AccountProvider } from '@/lib/account';
import { installErrorTracking, reportError } from '@/lib/errors';
import { AppState, Text, View } from 'react-native';
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
  const { setState } = useStore();
  useEffect(() => {
    let last = 0;
    const run = async () => {
      if (Date.now() - last < 30 * 60 * 1000) return;
      last = Date.now();
      const r = await syncCatalog();
      if (r) { setState(s=>s); onChange(); if (r.added) toast(`Katalog güncellendi · ${r.added} yeni yapım`); }
    };
    run();
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') run(); });
    return () => listener.remove();
  }, [onChange, toast, setState]);
  return null;
}

// Kütüphanedeki dizileri tazeler ve bildirim için cihazı ara sunucuya kaydeder
function LibrarySync() {
  const store = useStore();
  const { state } = store;
  const getState = store.getState;
  useEffect(() => {
    let last = 0;
    const run = () => {
      if (Date.now() - last < 15 * 60 * 1000) return;
      last = Date.now();
      refreshLibrary(getState(), store.libSave).catch(() => {});
    };
    run();
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') run(); });
    return () => listener.remove();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Takip listesi değişince (birkaç saniye sonra) sunucuya bildir
  const sig = state.follow.join(',') + '|' + Object.keys(state.lib).join(',') + '|' + Object.keys(state.episodes).length;
  useEffect(() => {
    if (!hasSyncApi()) return;
    const h = setTimeout(() => syncDevice(getState(), store.ensureDevice()).catch(() => {}), 3000);
    return () => clearTimeout(h);
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function Gate({ fontsReady }: { fontsReady: boolean }) {
  const { ready, storageError } = useStore();
  const [catVersion, setCatVersion] = useState(0);
  const bump = useCallback(() => setCatVersion((v) => v + 1), []);
  const go = ready && fontsReady;
  useEffect(() => { if (go || storageError) SplashScreen.hide(); }, [go, storageError]);
  if (storageError && !ready) return <View style={{ flex: 1, backgroundColor: C.bg, padding: 32, justifyContent: 'center' }}>
    <Text style={{ color: C.text }}>Yerel kayıt okunamadı veya değişiklikler telefona kaydedilemedi. Uygulamayı silmeyin.</Text>
    <Text style={{ color: C.text }}>Uygulamayı kapatıp yeniden açarak tekrar deneyin.</Text>
  </View>;
  if (!go) return null;
  return (
    <ThemeProvider value={theme}>
      {storageError && <View style={{ backgroundColor: C.bg, padding: 24 }}>
        <Text style={{ color: C.text }}>Değişiklikler telefona kaydedilemedi. Uygulamayı silmeyin.</Text>
        <Text accessibilityRole="button" onPress={() => { void checkpoint.flush().catch(() => {}); }} style={{ color: C.accent, paddingVertical: 12 }}>Kaydetmeyi yeniden dene</Text>
      </View>}
      <AccountProvider><ToastProvider><ConfirmProvider><ListPickerProvider><TrailerProvider><PreviewProvider>
        <StatusBar style="light" />
        <CatalogSync onChange={bump} />
        <LibrarySync />
        <SharedListsSync />
        <FriendsSync />
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
          <Stack.Screen name="lists/[id]" />
          <Stack.Screen name="l/[slug]" />
          <Stack.Screen name="stats" />
          <Stack.Screen name="import" />
          <Stack.Screen name="friends" />
          <Stack.Screen name="history" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="person/[id]" />
          <Stack.Screen name="calendar" />
          <Stack.Screen name="davet/[code]" />
        </Stack>
        <StackTabBar />
      </PreviewProvider></TrailerProvider></ListPickerProvider></ConfirmProvider></ToastProvider></AccountProvider>
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
      <Text accessibilityRole="button" onPress={() => retry()} style={{ marginTop: 22, paddingHorizontal: 22, paddingVertical: 13, borderRadius: 12, overflow: 'hidden', backgroundColor: C.accent, color: C.onAccent, fontSize: 15, fontWeight: '600' }}>Tekrar dene</Text>
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
