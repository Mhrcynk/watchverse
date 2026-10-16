import { router } from 'expo-router';
import { View } from 'react-native';
import { useMemo } from 'react';
import { Backdrop, Greeting, PickBanner, TicketCard } from '@/components/home';
import { UniverseCard } from '@/components/media';
import { Row } from '@/components/rows';
import { StarterCard } from '@/components/starter';
import { Btn, Empty, Screen, useLayout, useToast } from '@/components/ui';
import { TBY, UBY } from '@/lib/catalog';
import { continueRow, type ContItem } from '@/lib/continue-row';
import { episodeLabel, nextEpisode } from '@/lib/progress';
import { useStore } from '@/lib/store';
import { SaveStatus } from '@/components/save-status';

export default function Home() {
  const store = useStore();
  const { state } = store;
  const toast = useToast();
  const { width } = useLayout();
  const cont = useMemo(() => continueRow(state), [state]);
  const followed = state.follow.map(id => UBY[id]).filter(Boolean);
  const markNext = (x: ContItem) => {
    const t = TBY[x.key];
    if (t && !t.episodes) {
      store.toggleWatched(t.id, true);
      toast('İzlendi olarak kaydedildi', { label: 'Geri al', onPress: () => store.toggleWatched(t.id, false) });
      return;
    }
    const n = t ? nextEpisode(state, t) : Array.from({length: state.lib[x.key]?.aired || 0}, (_,i)=>i+1).find(i=>!state.episodes[x.key]?.includes(i));
    if (!n) return;
    const set = (value:boolean) => t ? store.setEpisodes(t.id,[n],value) : store.setEpsKey(x.key,[n],value);
    set(true);
    toast(`${t ? episodeLabel(t,n) : `Bölüm ${n}`} izlendi`, {label:'Geri al',onPress:()=>set(false)});
  };
  return <Screen>
    <Backdrop />
    <Greeting name={state.name} sub="Nerede kaldın? Sıradaki hikâyene dön." />
    <SaveStatus />
    {cont.length ? <Row title="İzlemeye devam et" onMore={()=>router.push('/library')}>
      {cont.map((x,i)=><TicketCard key={x.key} index={i} width={Math.min(340,Math.round(width*.82))} title={x.title} poster={x.poster} sub={x.sub} badge={x.badge} pct={x.pct}
        watchedLabel={x.m==='tv'?'Sıradaki bölümü izledim':'İzledim'}
        onWatched={TBY[x.key] || ((state.lib[x.key]?.aired || 0) > (state.episodes[x.key]?.length || 0)) ? ()=>markNext(x) : undefined}
        onPress={()=>router.push(x.route as never)} />)}
    </Row> : <Empty icon="bookmark" title="İlk hikâyeni seç." text="Bir yapım kaydet veya izlediğin bölümleri işaretle; kaldığın yer burada görünsün." action="Yapım bul" onAction={()=>router.push('/explore')} />}
    <StarterCard />
    <PickBanner style={{marginTop:22}} />
    {followed.length>0 && <Row title="Evrenlerin" onMore={()=>router.push('/universes')}>
      {followed.map(u=><UniverseCard key={u.id} u={u} state={state} style={{width:Math.min(280,width*.72)}} />)}
    </Row>}
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:12,marginTop:24}}>
      <Btn kind="secondary" icon="calendar" label="Yaklaşan bölümler" onPress={()=>router.push('/calendar')} />
      <Btn kind="secondary" icon="search" label="Yeni bir şey keşfet" onPress={()=>router.push('/explore')} />
    </View>
  </Screen>;
}
