import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Brand } from '@/components/brand';
import { Btn, Empty, Screen, Small, useLayout, useToast } from '@/components/ui';
import { useAccount } from '@/lib/account';
import { CATALOG, posterUrl } from '@/lib/catalog';
import { acceptInvite, inviteInfo, savePending } from '@/lib/friends';
import { useStore } from '@/lib/store';
import { C, F, R, alpha } from '@/lib/theme';

type IconName = React.ComponentProps<typeof Feather>['name'];

/** Afiş şeridi: davet sayfasının üstünde, ne tür bir uygulama olduğunu ilk bakışta gösterir */
function PosterStrip() {
  const { width } = useLayout();
  const list = useMemo(() => CATALOG.filter((t) => t.tmdb?.p && t.tier === 0), []);
  const pick = (i: number) => (list.length ? list[(i * 11) % list.length] : null);
  const pw = Math.min(118, Math.round(width / 3.4));
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: pw * 1.5 + 140, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, marginLeft: -pw * 0.3, transform: [{ rotate: '-6deg' }] }}>
        {Array.from({ length: 8 }, (_, c) => {
          const t = pick(c + 3);
          const uri = t ? posterUrl(t, 'w185') : null;
          return (
            <View key={c} style={{ width: pw, aspectRatio: 2 / 3, borderRadius: R.sm, overflow: 'hidden', backgroundColor: C.card, marginTop: c % 2 ? 26 : 0 }}>
              {uri && <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} />}
            </View>
          );
        })}
      </View>
      <LinearGradient colors={[alpha(C.bg, 0.35), C.bg]} locations={[0, 0.85]} style={StyleSheet.absoluteFill} />
    </View>
  );
}

function Point({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 14, paddingVertical: 12 }}>
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: alpha(C.accent, 0.14), alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={icon} size={18} color={C.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.semibold, fontSize: 15.5, color: C.text }}>{title}</Text>
        <Text style={{ marginTop: 3, fontFamily: F.regular, fontSize: 14, lineHeight: 20, color: C.muted }}>{text}</Text>
      </View>
    </View>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 26 }}>
      <Text accessibilityRole="header" style={{ fontFamily: F.bold, fontSize: 18, color: C.text, marginBottom: 4 }}>{title}</Text>
      <View style={{ paddingHorizontal: 14, paddingVertical: 4, borderRadius: R.lg, backgroundColor: C.card }}>{children}</View>
    </View>
  );
}

/** Davet bağlantısı: açan kişi önce uygulamayı ve arkadaşlığın ne kazandırdığını görür, sonra katılır */
export default function Invite() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const acc = useAccount();
  const { state } = useStore();
  const toast = useToast();
  // undefined: yükleniyor · null: geçersiz · '': geçerli ama adsız
  const [who, setWho] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (code) inviteInfo(code).then((n) => setWho(n ?? null), () => setWho(null)); }, [code]);

  if (!acc.enabled) return <Screen><Brand /><Empty icon="users" title="Arkadaşlık henüz açık değil." /></Screen>;
  if (who === undefined || !acc.ready) return <Screen><View style={{ paddingVertical: 100, alignItems: 'center' }}><ActivityIndicator color={C.accentSoft} /></View></Screen>;
  if (who === null) return <Screen><Brand /><View style={{ height: 28 }} /><Empty icon="link" title="Bu davet geçersiz." text="Bağlantı yenilenmiş olabilir. Davet edenden yenisini iste." action="WatchVerse'e git" onAction={() => router.replace('/')} /></Screen>;

  const name = who || 'Bir arkadaşın';
  const initial = (who.trim()[0] || 'W').toLocaleUpperCase('tr');

  const accept = async () => {
    setBusy(true);
    try { const n = await acceptInvite(code!, state.name); toast(`${n || 'Davet eden'} ile artık arkadaşsınız`); router.replace('/friends'); }
    catch (e) { toast(/kendi/.test(String((e as Error)?.message)) ? 'Bu senin kendi davet bağlantın.' : 'Davet kabul edilemedi.'); setBusy(false); }
  };
  const join = (mode: 'signup' | 'signin') => { savePending(code!); router.push(`/account?mode=${mode}&from=welcome`); };

  return (
    <Screen>
      <PosterStrip />
      <View style={{ maxWidth: 520, width: '100%', alignSelf: 'center' }}>
        <Brand />

        <View style={{ marginTop: 150, alignItems: 'flex-start' }}>
          <LinearGradient colors={[C.accentSoft, '#C9902A']} style={{ width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: F.heavy, fontSize: 25, color: C.onAccent }}>{initial}</Text>
          </LinearGradient>
          <Text accessibilityRole="header" style={{ marginTop: 16, fontFamily: F.heavy, fontSize: 28, lineHeight: 34, color: C.text, letterSpacing: -0.7 }}>
            {who ? `${who} seni WatchVerse'e davet etti` : "WatchVerse'e davet edildin"}
          </Text>
          <Text style={{ marginTop: 10, fontFamily: F.regular, fontSize: 15.5, lineHeight: 23, color: C.muted }}>
            WatchVerse izlediğin film ve dizileri tek yerde takip ettiğin ücretsiz bir uygulama. Arkadaş olursanız birbirinizin ne izlediğini görürsünüz.
          </Text>
        </View>

        {acc.user ? (
          <Btn icon="user-check" label={busy ? 'Bekle…' : who ? `${who} ile arkadaş ol` : 'Arkadaş ol'} disabled={busy} style={{ marginTop: 22 }} onPress={accept} />
        ) : (
          <View style={{ marginTop: 22, gap: 10 }}>
            <Btn label="Hesap aç ve arkadaş ol" onPress={() => join('signup')} />
            <Btn kind="secondary" label="Zaten hesabım var" onPress={() => join('signin')} />
          </View>
        )}

        <Block title="Arkadaş olunca ne olur?">
          <Point icon="eye" title="Ne izlediğini görürsünüz" text={`${name} son ne izledi, neyi bitirdi, neye kaç puan verdi; ikiniz de görürsünüz.`} />
          <Point icon="star" title="Ne izleyeceğine kolay karar verirsin" text="Arkadaşının yüksek puan verdikleri, sıradaki ne izlesem sorusuna en iyi cevap." />
          <Point icon="lock" title="Kontrol sende" text="Notların kimseye görünmez. İzlediklerini paylaşmayı istediğin an kapatır, arkadaşlıktan çıkabilirsin." />
        </Block>

        {!acc.user && (
          <Block title="WatchVerse ne işe yarar?">
            <Point icon="layers" title="Evrenleri doğru sırayla izle" text="Marvel, Star Wars, Yüzüklerin Efendisi gibi büyük evrenlerde hangi yapımın önce geldiğini ve sıradakinin ne olduğunu gösterir." />
            <Point icon="check-circle" title="Kaldığın yeri unutma" text="İzlediğin bölümü işaretle; yeni bölüm çıkınca haber al." />
            <Point icon="tv" title="Nerede izleneceğini gör" text="Netflix, Disney+, Prime Video ve diğerlerinde neyin olduğunu ve Türkiye'de neyin popüler olduğunu tek yerde gör." />
          </Block>
        )}

        <Small style={{ marginTop: 22, textAlign: 'center' }}>Ücretsiz · Reklam yok · İstediğin an hesabını silebilirsin</Small>
      </View>
    </Screen>
  );
}
