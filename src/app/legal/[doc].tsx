import { router, useLocalSearchParams } from 'expo-router';
import { Linking, View } from 'react-native';
import { BackLink, Body, H1, H3, Muted, Panel, Press, Screen, Small } from '@/components/ui';
import { CONTACT, LEGAL, LEGAL_UPDATED } from '@/lib/legal';
import { C } from '@/lib/theme';

export default function Legal() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const d = LEGAL[(doc as keyof typeof LEGAL) || 'gizlilik'] || LEGAL.gizlilik;
  const other = d.id === 'gizlilik' ? LEGAL.sartlar : LEGAL.gizlilik;
  return (
    <Screen>
      <BackLink label="Geri" onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))} />
      <H1>{d.title}</H1>
      <Small style={{ marginTop: 6 }}>Son güncelleme: {LEGAL_UPDATED}</Small>
      <Muted style={{ marginTop: 16 }}>{d.intro}</Muted>
      <View style={{ gap: 12, marginTop: 20 }}>
        {d.sections.map((s) => (
          <Panel key={s.h}>
            <H3 accessibilityRole="header">{s.h}</H3>
            {s.p.map((p, i) => (
              <Body key={i} style={{ marginTop: 8, color: C.muted }}>
                {p.includes(CONTACT) ? (
                  <>
                    {p.split(CONTACT)[0]}
                    <Body style={{ color: C.accentSoft }} onPress={() => Linking.openURL(CONTACT.includes('@') ? `mailto:${CONTACT}` : CONTACT)}>{CONTACT.replace(/^https?:\/\//, '')}</Body>
                    {p.split(CONTACT)[1]}
                  </>
                ) : p}
              </Body>
            ))}
          </Panel>
        ))}
      </View>
      <Press accessibilityRole="link" onPress={() => router.replace(`/legal/${other.id}`)} style={{ marginTop: 20 }}>
        <Small style={{ color: C.accentSoft }}>{other.title}</Small>
      </Press>
    </Screen>
  );
}
