import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View, type TextInputProps } from 'react-native';
import { BackLink, Btn, FadeIn, H1, Muted, Panel, Press, Screen, Small, useToast } from '@/components/ui';
import { useAccount } from '@/lib/account';
import { C, F, R, alpha } from '@/lib/theme';

type Mode = 'signin' | 'signup' | 'reset' | 'newpass';
const CONSENT = 'watchverse:consent';
const okMail = (m: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m.trim());

function Field({ label, error, ...p }: TextInputProps & { label: string; error?: string | null; ref?: React.Ref<TextInput> }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={{ fontFamily: F.medium, fontSize: 13, color: C.muted, marginBottom: 6 }}>{label}</Text>
      <TextInput
        placeholderTextColor={C.dim}
        accessibilityLabel={label}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        {...p}
        style={{ height: 50, borderRadius: R.md, backgroundColor: C.raised, color: C.text, paddingHorizontal: 14, fontFamily: F.regular, fontSize: 16, borderWidth: 1, borderColor: error ? C.accent : focus ? C.muted : 'transparent', outlineStyle: 'none' } as never}
      />
    </View>
  );
}

function Check({ value, onChange, children }: { value: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <Press accessibilityRole="checkbox" accessibilityState={{ checked: value }} onPress={() => onChange(!value)} scaleTo={1} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: 18 }}>
      <View style={{ width: 22, height: 22, borderRadius: 6, marginTop: 1, borderWidth: 1.5, borderColor: value ? C.accent : C.dim, backgroundColor: value ? C.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {value && <Feather name="check" size={15} color="#fff" />}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Press>
  );
}

export default function Account() {
  const acc = useAccount();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>(acc.recovery ? 'newpass' : 'signin');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [consent, setConsent] = useState(false);
  const [consentSaved, setConsentSaved] = useState(false);
  const [busy, setBusy] = useState<null | 'mail' | 'google'>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const pwRef = useRef<TextInput>(null);
  const wasIn = useRef(!!acc.user);

  useEffect(() => { AsyncStorage.getItem(CONSENT).then((v) => { if (v) { setConsent(true); setConsentSaved(true); } }).catch(() => {}); }, []);
  useEffect(() => { if (acc.recovery) setMode('newpass'); }, [acc.recovery]);
  // Giriş tamamlanınca profile dön
  useEffect(() => {
    if (acc.user && !acc.recovery && mode !== 'newpass') {
      if (!wasIn.current) toast('Giriş yapıldı. Kayıtların eşitleniyor.');
      router.canGoBack() ? router.back() : router.replace('/profile');
    }
  }, [acc.user, acc.recovery]); // eslint-disable-line react-hooks/exhaustive-deps

  const back = () => (router.canGoBack() ? router.back() : router.replace('/profile'));
  const switchTo = (m: Mode) => { setMode(m); setError(null); setInfo(null); };
  const remember = () => { if (!consentSaved) AsyncStorage.setItem(CONSENT, String(Date.now())).catch(() => {}); };

  if (!acc.enabled) {
    return (
      <Screen>
        <BackLink label="Profil" onPress={back} />
        <H1>Hesap</H1>
        <Panel style={{ marginTop: 20 }}><Muted>Üyelik henüz açılmadı. Kurulum tamamlanınca buradan hesap açabileceksin. O zamana kadar her şey bu cihazda saklanır.</Muted></Panel>
      </Screen>
    );
  }

  async function submit() {
    setError(null); setInfo(null);
    if (mode !== 'newpass' && !okMail(email)) { setError('Geçerli bir mail adresi yaz.'); return; }
    if (mode !== 'reset' && pw.length < 8) { setError('Şifre en az 8 karakter olmalı.'); return; }
    if (mode === 'signup' && !consent) { setError('Devam etmek için aydınlatma metnini onaylaman gerekiyor.'); return; }
    setBusy('mail');
    let r: string | null = null;
    if (mode === 'signin') r = await acc.signIn(email, pw);
    else if (mode === 'signup') { remember(); r = await acc.signUp(email, pw); }
    else if (mode === 'reset') { r = await acc.resetPassword(email); if (!r) { setInfo('Şifre yenileme bağlantısı mailine gönderildi. Gelen kutunu (ve gereksiz klasörünü) kontrol et.'); } }
    else { r = await acc.updatePassword(pw); if (!r) { toast('Yeni şifren kaydedildi'); back(); } }
    setBusy(null);
    if (r) (r.startsWith('Mailine') ? setInfo : setError)(r);
  }

  async function google() {
    setError(null);
    if (!consent) { setError('Google ile devam etmeden önce aydınlatma metnini onayla.'); return; }
    remember();
    setBusy('google');
    const r = await acc.google();
    if (r) { setBusy(null); setError(r); }
  }

  const title = { signin: 'Giriş yap', signup: 'Hesap aç', reset: 'Şifreni yenile', newpass: 'Yeni şifre belirle' }[mode];
  const cta = { signin: 'Giriş yap', signup: 'Hesap aç', reset: 'Bağlantı gönder', newpass: 'Şifreyi kaydet' }[mode];
  const needConsent = mode === 'signup' || mode === 'signin';

  return (
    <Screen>
      <BackLink label="Profil" onPress={back} />
      <View style={{ width: '100%', maxWidth: 440, alignSelf: 'center' }}>
        <H1>{title}</H1>
        <Muted style={{ marginTop: 8 }}>
          {mode === 'newpass' ? 'Hesabın için yeni bir şifre yaz.' : mode === 'reset' ? 'Mail adresini yaz, şifreni yenilemen için bir bağlantı gönderelim.' : 'İzlediklerin, puanların ve listelerin hesabına kaydedilir; telefon değişse de kaybolmaz, her cihazda aynı görünür.'}
        </Muted>

        {(mode === 'signin' || mode === 'signup') && (
          <>
            <Press accessibilityRole="button" accessibilityLabel="Google ile devam et" onPress={google} disabled={!!busy}
              style={{ marginTop: 24, height: 50, borderRadius: R.md, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: busy && busy !== 'google' ? 0.5 : 1 }}>
              {busy === 'google' ? <ActivityIndicator color="#111" /> : <Ionicons name="logo-google" size={18} color="#111" />}
              <Text style={{ fontFamily: F.semibold, fontSize: 15.5, color: '#111' }}>Google ile devam et</Text>
            </Press>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 22 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
              <Small>ya da mail ile</Small>
              <View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
            </View>
          </>
        )}

        {mode !== 'newpass' && (
          <Field label="Mail adresi" value={email} onChangeText={setEmail} placeholder="ornek@mail.com" autoCapitalize="none" autoCorrect={false}
            keyboardType="email-address" autoComplete="email" textContentType="emailAddress" inputMode="email" returnKeyType="next"
            onSubmitEditing={() => (mode === 'reset' ? submit() : pwRef.current?.focus())} error={error && !okMail(email) ? error : null} />
        )}
        {mode !== 'reset' && (
          <View>
            <Field ref={pwRef} label={mode === 'signin' ? 'Şifre' : 'Şifre (en az 8 karakter)'} value={pw} onChangeText={setPw} secureTextEntry={!show}
              autoCapitalize="none" autoCorrect={false} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              textContentType={mode === 'signin' ? 'password' : 'newPassword'} returnKeyType="go" onSubmitEditing={submit} />
            <Press accessibilityRole="button" accessibilityLabel={show ? 'Şifreyi gizle' : 'Şifreyi göster'} onPress={() => setShow((v) => !v)} hitSlop={10}
              style={{ position: 'absolute', right: 14, bottom: 15 }}>
              <Feather name={show ? 'eye-off' : 'eye'} size={19} color={C.muted} />
            </Press>
          </View>
        )}

        {mode === 'signin' && (
          <Press accessibilityRole="button" onPress={() => switchTo('reset')} style={{ alignSelf: 'flex-end', marginTop: 10 }} hitSlop={8}>
            <Small style={{ color: C.accentSoft }}>Şifremi unuttum</Small>
          </Press>
        )}

        {needConsent && !consentSaved && (
          <Check value={consent} onChange={setConsent}>
            <Small style={{ color: C.text }}>
              <Small style={{ color: C.accentSoft }} onPress={() => router.push('/legal/gizlilik')}>Aydınlatma metnini</Small> ve{' '}
              <Small style={{ color: C.accentSoft }} onPress={() => router.push('/legal/sartlar')}>kullanım şartlarını</Small> okudum. Hesabımın ve kayıtlarımın yurt dışındaki (AB) sunucularda saklanmasına açık rıza veriyorum.
            </Small>
          </Check>
        )}
        {mode === 'signin' && !consentSaved && <Small style={{ marginTop: 6, marginLeft: 34, color: C.dim }}>Var olan hesabınla mail ile girerken gerekmez.</Small>}

        {!!error && <FadeIn><View accessibilityRole="alert" style={{ marginTop: 16, padding: 12, borderRadius: R.md, backgroundColor: alpha(C.accent, 0.14) }}><Small style={{ color: C.accentSoft }}>{error}</Small></View></FadeIn>}
        {!!info && <FadeIn><View accessibilityRole="alert" style={{ marginTop: 16, padding: 12, borderRadius: R.md, backgroundColor: alpha(C.green, 0.14) }}><Small style={{ color: C.green }}>{info}</Small></View></FadeIn>}

        <Btn label={busy === 'mail' ? 'Bekle…' : cta} onPress={submit} disabled={!!busy} style={{ marginTop: 20 }} />

        <View style={{ alignItems: 'center', marginTop: 18 }}>
          {mode === 'signin' && <Press accessibilityRole="button" onPress={() => switchTo('signup')} hitSlop={8}><Small>Hesabın yok mu? <Small style={{ color: C.accentSoft, fontFamily: F.semibold }}>Hesap aç</Small></Small></Press>}
          {mode === 'signup' && <Press accessibilityRole="button" onPress={() => switchTo('signin')} hitSlop={8}><Small>Zaten hesabın var mı? <Small style={{ color: C.accentSoft, fontFamily: F.semibold }}>Giriş yap</Small></Small></Press>}
          {mode === 'reset' && <Press accessibilityRole="button" onPress={() => switchTo('signin')} hitSlop={8}><Small style={{ color: C.accentSoft }}>Girişe dön</Small></Press>}
        </View>
        <Small style={{ marginTop: 28, textAlign: 'center', color: C.dim }}>Hesap açmak zorunlu değil. Hesapsız kullanırsan her şey yalnızca bu cihazda kalır.</Small>
      </View>
    </Screen>
  );
}
