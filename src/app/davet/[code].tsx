import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Brand } from '@/components/brand';
import { Btn, Empty, H1, Muted, Screen, useToast } from '@/components/ui';
import { useAccount } from '@/lib/account';
import { acceptInvite, inviteInfo, savePending } from '@/lib/friends';
import { useStore } from '@/lib/store';
import { C } from '@/lib/theme';

/** Davet bağlantısı: açan kişi davet edenle arkadaş olur */
export default function Invite() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const acc = useAccount();
  const { state } = useStore();
  const toast = useToast();
  const [who, setWho] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (code) inviteInfo(code).then((n) => setWho(n ?? null), () => setWho(null)); }, [code]);

  if (!acc.enabled) return <Screen><Brand /><Empty icon="users" title="Arkadaşlık henüz açık değil." /></Screen>;
  if (who === undefined || !acc.ready) return <Screen><View style={{ paddingVertical: 100, alignItems: 'center' }}><ActivityIndicator color={C.accentSoft} /></View></Screen>;
  if (who === null) return <Screen><Brand /><View style={{ height: 28 }} /><Empty icon="link" title="Bu davet geçersiz." text="Bağlantı yenilenmiş olabilir. Davet edenden yenisini iste." action="WatchVerse'e git" onAction={() => router.replace('/')} /></Screen>;

  const accept = async () => {
    setBusy(true);
    try { const n = await acceptInvite(code!, state.name); toast(`${n} ile artık arkadaşsınız`); router.replace('/friends'); }
    catch (e) { toast(/kendi/.test(String((e as Error)?.message)) ? 'Bu senin kendi davet bağlantın.' : 'Davet kabul edilemedi.'); setBusy(false); }
  };
  const join = (mode: 'signup' | 'signin') => { savePending(code!); router.push(`/account?mode=${mode}&from=welcome`); };

  return (
    <Screen style={{ flexGrow: 1, justifyContent: 'center' }}>
      <View style={{ maxWidth: 480, width: '100%', alignSelf: 'center' }}>
        <Brand />
        <H1 style={{ marginTop: 30 }}>{who} seni arkadaş olarak eklemek istiyor</H1>
        <Muted style={{ marginTop: 10 }}>Arkadaş olunca birbirinizin son izlediklerini ve puanlarını görürsünüz. Notların gizli kalır; istediğin zaman arkadaşlıktan çıkabilirsin.</Muted>
        {acc.user ? (
          <Btn icon="user-check" label={busy ? 'Bekle…' : 'Arkadaş ol'} disabled={busy} style={{ marginTop: 24 }} onPress={accept} />
        ) : (
          <>
            <Btn label="Hesap aç ve arkadaş ol" style={{ marginTop: 24 }} onPress={() => join('signup')} />
            <Btn kind="secondary" label="Zaten hesabım var" style={{ marginTop: 10 }} onPress={() => join('signin')} />
          </>
        )}
      </View>
    </Screen>
  );
}
