import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { BackLink, FadeIn, Muted, Panel, Press, Screen, Small, useToast } from '@/components/ui';
import { useAccount } from '@/lib/account';
import { Backdrop, PageHeader } from '@/components/home';
import { C, F, R, alpha } from '@/lib/theme';

const CONSENT = 'watchverse:consent';

function Check({ value, onChange, children }: { value: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <Press accessibilityRole="checkbox" accessibilityState={{ checked: value }} aria-checked={value} onPress={() => onChange(!value)} scaleTo={1} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: 20 }}>
      <View style={{ width: 22, height: 22, borderRadius: 6, marginTop: 1, borderWidth: 1.5, borderColor: value ? C.accent : C.dim, backgroundColor: value ? C.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {value && <Feather name="check" size={15} color={C.onAccent} />}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Press>
  );
}

/**
 * Giriş: yalnızca Apple ve Google. Mail ve şifre yok; şifre yenileme ya da mail doğrulama gerekmez.
 * Hesap açmak da giriş yapmak da aynı düğmedir: ilk girişte hesap kendiliğinden açılır.
 */
export default function Account() {
  const acc = useAccount();
  const toast = useToast();
  const params = useLocalSearchParams<{ from?: string }>();
  const fromWelcome = params.from === 'welcome';
  const [consent, setConsent] = useState(false);
  const [consentSaved, setConsentSaved] = useState(false);
  const [busy, setBusy] = useState<null | 'apple' | 'google'>(null);
  const [error, setError] = useState<string | null>(null);
  const wasIn = useRef(!!acc.user);

  useEffect(() => { AsyncStorage.getItem(CONSENT).then((v) => { if (v) { setConsent(true); setConsentSaved(true); } }).catch(() => {}); }, []);
  // Giriş tamamlanınca geldiği yere dön
  useEffect(() => {
    if (!acc.user) return;
    if (!wasIn.current) toast('Giriş yapıldı');
    if (fromWelcome || !router.canGoBack()) router.replace('/'); else router.back();
  }, [acc.user]); // eslint-disable-line react-hooks/exhaustive-deps

  const back = () => (router.canGoBack() ? router.back() : router.replace(fromWelcome ? '/welcome' : '/profile'));

  if (!acc.enabled) {
    return (
      <Screen><Backdrop />
        <BackLink label={fromWelcome ? 'Geri' : 'Profil'} onPress={back} />
        <PageHeader bold="Hesap" />
        <Panel style={{ marginTop: 20 }}><Muted>Üyelik henüz açılmadı. O zamana kadar her şey bu cihazda saklanır.</Muted></Panel>
      </Screen>
    );
  }

  async function go(kind: 'apple' | 'google') {
    setError(null);
    if (!consent) { setError('Devam etmek için aydınlatma metnini onaylaman gerekiyor.'); return; }
    if (!consentSaved) AsyncStorage.setItem(CONSENT, String(Date.now())).catch(() => {});
    setBusy(kind);
    const r = kind === 'apple' ? await acc.apple() : await acc.google();
    setBusy(null);
    if (r && r !== 'Giriş iptal edildi.') setError(r);
  }

  const guest = () => { acc.setGuest(true); router.replace('/'); };

  return (
    <Screen><Backdrop />
      <BackLink label={fromWelcome ? 'Geri' : 'Profil'} onPress={back} />
      <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>
        <PageHeader bold="Giriş yap" />
        <Muted style={{ marginTop: 8 }}>
          İzlediklerin, puanların ve listelerin hesabına kaydedilir; telefon değişse de kaybolmaz. Hesabın yoksa ilk girişte kendiliğinden açılır.
        </Muted>

        {acc.appleAvailable && (
          <View style={{ marginTop: 24, opacity: busy === 'google' ? 0.5 : 1 }} pointerEvents={busy ? 'none' : 'auto'}>
            {busy === 'apple' ? (
              <View style={{ height: 50, borderRadius: R.md, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#111" /></View>
            ) : (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={R.md}
                style={{ width: '100%', height: 50 }}
                onPress={() => go('apple')}
              />
            )}
          </View>
        )}

        <Press accessibilityRole="button" accessibilityLabel="Google ile devam et" onPress={() => go('google')} disabled={!!busy}
          style={{ marginTop: acc.appleAvailable ? 12 : 24, height: 50, borderRadius: R.md, backgroundColor: C.raised, borderWidth: 1, borderColor: C.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: busy === 'apple' ? 0.5 : 1 }}>
          {busy === 'google' ? <ActivityIndicator color={C.text} /> : <Ionicons name="logo-google" size={18} color={C.text} />}
          <Text style={{ fontFamily: F.semibold, fontSize: 15.5, color: C.text }}>Google ile devam et</Text>
        </Press>

        {!consentSaved && (
          <Check value={consent} onChange={setConsent}>
            <Small style={{ color: C.text }}>
              <Small style={{ color: C.accentSoft }} onPress={() => router.push('/legal/gizlilik')}>Aydınlatma metnini</Small> ve{' '}
              <Small style={{ color: C.accentSoft }} onPress={() => router.push('/legal/sartlar')}>kullanım şartlarını</Small> okudum. Hesabımın ve kayıtlarımın yurt dışındaki (AB) sunucularda saklanmasına açık rıza veriyorum.
            </Small>
          </Check>
        )}

        {!!error && <FadeIn><View accessibilityRole="alert" style={{ marginTop: 16, padding: 12, borderRadius: R.md, backgroundColor: alpha(C.accent, 0.14) }}><Small style={{ color: C.accentSoft }}>{error}</Small></View></FadeIn>}

        <Press accessibilityRole="button" onPress={guest} hitSlop={8} style={{ alignSelf: 'center', marginTop: 28 }}>
          <Small style={{ color: C.accentSoft, fontFamily: F.semibold }}>Hesap açmadan devam et</Small>
        </Press>
        <Small style={{ marginTop: 10, textAlign: 'center', color: C.dim }}>Hesapsız kullanırsan her şey yalnızca bu cihazda kalır. İstediğin zaman sonradan giriş yapabilirsin.</Small>
      </View>
    </Screen>
  );
}
