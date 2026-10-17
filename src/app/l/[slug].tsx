import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Brand } from '@/components/brand';
import { MediaCard } from '@/components/media';
import { Btn, Empty, Grid, H1, Muted, Screen, Small, useLayout, useToast } from '@/components/ui';
import { routeOf } from '@/lib/library';
import { useStore } from '@/lib/store';
import { sb } from '@/lib/supabase';
import { C } from '@/lib/theme';
import { img } from '@/lib/tmdb';
import type { ListItem } from '@/lib/types';

type Shared = { name: string; owner: string | null; items: ListItem[]; updated: string };

/** Paylaşılan liste: bağlantıyı açan herkes görebilir, hesap gerekmez */
export default function SharedList() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const store = useStore();
  const toast = useToast();
  const { posterCols } = useLayout();
  const [result, setResult] = useState<{ slug: string; data: Shared | null } | null>(null);
  const d = !sb() || !slug ? null : result?.slug === slug ? result.data : undefined;
  const mine = Object.values(store.state.lists).find((l) => l.share === slug);

  useEffect(() => {
    const c = sb();
    if (!c || !slug) return;
    let alive = true;
    c.rpc('get_shared_list', { p_slug: slug }).then(({ data, error }) => { if (alive) setResult({ slug, data: error || !data ? null : (data as Shared) }); }, () => { if (alive) setResult({ slug, data: null }); });
    return () => { alive = false; };
  }, [slug]);

  const home = () => router.replace('/');
  if (d === undefined) return <Screen><View style={{ paddingVertical: 100, alignItems: 'center' }}><ActivityIndicator color={C.accentSoft} /></View></Screen>;
  if (!d) return <Screen><Brand /><View style={{ height: 28 }} /><Empty icon="link" title="Bu liste bulunamadı." text="Paylaşım kapatılmış ya da bağlantı hatalı olabilir." action="WatchVerse'e git" onAction={home} /></Screen>;

  const copy = () => {
    const id = store.listCreate(d.name, d.items);
    toast('Liste kütüphanene kopyalandı');
    router.replace(`/lists/${id}`);
  };

  return (
    <Screen>
      <Brand />
      <Small style={{ marginTop: 26, color: C.accentSoft }}>{d.owner ? `${d.owner} seninle bir liste paylaştı` : 'Seninle bir liste paylaşıldı'}</Small>
      <H1 style={{ marginTop: 6 }}>{d.name}</H1>
      <Muted style={{ marginTop: 4 }}>{d.items.length} yapım</Muted>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        {mine ? <Btn icon="list" label="Listeni aç" onPress={() => router.replace(`/lists/${mine.id}`)} /> : <Btn icon="copy" label="Listeyi kütüphaneme kopyala" onPress={copy} />}
        <Btn kind="secondary" label="WatchVerse'ü aç" onPress={home} />
      </View>
      <View style={{ marginTop: 22 }}>
        {d.items.length ? (
          <Grid items={d.items} cols={posterCols} gap={14} rowGap={22} keyOf={(x) => x.k}
            render={(x, cw) => <MediaCard uri={img(x.p, 'w342')} title={x.t} sub={x.y ? String(x.y) : undefined} width={cw} onPress={() => router.push((x.k.includes(':') ? routeOf(x.k) : `/title/${x.k}`) as never)} />} />
        ) : <Empty icon="list" title="Bu liste boş." />}
      </View>
    </Screen>
  );
}
