import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { Backdrop, PageHeader } from '@/components/home';
import { TitleRow } from '@/components/media';
import { BackLink, Empty, Panel, Screen, Small } from '@/components/ui';
import { monthLabel } from '@/lib/format';
import { isEn } from '@/lib/i18n';
import { history } from '@/lib/progress';
import { useStore } from '@/lib/store';

export default function History() {
  const { state } = useStore();
  const hist = useMemo(() => history(state, 400), [state]);
  const groups: { label: string; items: typeof hist }[] = [];
  for (const h of hist) {
    const label = h.at ? monthLabel(h.at) : 'Tarihsiz';
    const g = groups.find((x) => x.label === label);
    g ? g.items.push(h) : groups.push({ label, items: [h] });
  }
  const back = () => (router.canGoBack() ? router.back() : router.replace('/profile'));
  return (
    <Screen>
      <Backdrop />
      <BackLink label="Profil" onPress={back} />
      <PageHeader bold={isEn ? 'İzleme geçmişin' : 'İzleme'} light={isEn ? undefined : 'geçmişin'} sub={`${hist.length} kayıt, yeniden eskiye.`} />
      <View style={{ marginTop: 18 }}>
        {groups.length ? groups.map((g) => (
          <View key={g.label} style={{ marginBottom: 16 }}>
            <Small style={{ marginBottom: 6, marginLeft: 4, textTransform: 'capitalize' }}>{g.label}</Small>
            <Panel style={{ paddingVertical: 6 }}>{g.items.map((h) => <TitleRow key={h.t.id} t={h.t} showUniverse />)}</Panel>
          </View>
        )) : <Empty icon="clock" title="Henüz bir şey izlemedin." text="İşaretlediğin yapımlar ay ay burada birikir." />}
      </View>
    </Screen>
  );
}
