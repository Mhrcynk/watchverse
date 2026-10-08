import { router } from 'expo-router';
import { Linking, View } from 'react-native';
import { BackLink, Body, Divider, H1, H3, Muted, Panel, Press, Screen, SectionHead, Small } from '@/components/ui';
import { CATALOG, SCOPE, UNIVERSES, UPDATED } from '@/lib/catalog';
import { C, F } from '@/lib/theme';

const link = (url: string, text: string) => (
  <Press accessibilityRole="link" onPress={() => Linking.openURL(url)}><Small style={{ color: C.accentSoft, marginTop: 6 }}>{text}</Small></Press>
);

export default function Credits() {
  const posters = CATALOG.filter((t) => t.tmdb?.p).length;
  return (
    <Screen>
      <BackLink label="Profil" onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))} />
      <H1>Katalog ve kaynaklar</H1>

      <Panel style={{ marginTop: 20 }}>
        <H3>{CATALOG.length} yapım · {UNIVERSES.length} evren</H3>
        <Muted style={{ marginTop: 8 }}>{SCOPE}</Muted>
        <Muted style={{ marginTop: 8 }}>Katalog tarihi: {UPDATED}. Yeni yayınlar uygulama güncellemeleriyle eklenir. Bölüm ve tarih bilgileri eksik olabilir.</Muted>
      </Panel>

      <SectionHead title="Modlar" />
      <Panel>
        <Body><Body style={{ fontFamily: F.semibold }}>Ana hikâye:</Body> evrenin omurgasını taşıyan yapımlar.</Body>
        <Body style={{ marginTop: 6 }}><Body style={{ fontFamily: F.semibold }}>Önerilen:</Body> ana hikâye ve onu zenginleştiren yan yapımlar.</Body>
        <Body style={{ marginTop: 6 }}><Body style={{ fontFamily: F.semibold }}>Tümü:</Body> kısa, özel ve arşiv yapımları dahil her şey.</Body>
        <Small style={{ marginTop: 10 }}>Sıralama ve ön koşullar editoryal önerilerdir; resmî izleme sırası değildir.</Small>
      </Panel>

      <SectionHead title="Veri kaynakları" />
      <Panel>
        <Muted>Yapım bilgileri Wikipedia’dan, bölüm bilgileri TVmaze’den derlenmiştir. TVmaze verileri CC BY-SA lisansıyla kullanılır.</Muted>
        {link('https://www.tvmaze.com', 'tvmaze.com')}
        <Divider />
        <Muted>Afiş ve arka plan görselleri The Movie Database (TMDB) üzerinden gösterilir.</Muted>
        <Small style={{ marginTop: 6 }}>This product uses the TMDB API but is not endorsed or certified by TMDB.</Small>
        {link('https://www.themoviedb.org', 'themoviedb.org')}
        <Small style={{ marginTop: 8 }}>{posters ? `${posters} yapım için görsel eşleşmesi var.` : 'Görsel eşleşmeleri henüz yüklenmedi; yapımlar evren renginde kapaklarla gösteriliyor.'}</Small>
      </Panel>

      <SectionHead title="Haklar" />
      <Panel>
        <Muted>WatchVerse bağımsız bir izleme takip uygulamasıdır. Uygulamada adı geçen film, dizi, karakter ve markaların hakları sahiplerine aittir. WatchVerse bu şirketlerin hiçbiriyle bağlantılı değildir ve onlar tarafından onaylanmamıştır.</Muted>
      </Panel>

      <SectionHead title="Gizlilik" />
      <Panel>
        <Muted>WatchVerse hesap istemez, kişisel veri toplamaz ve reklam izleyicisi kullanmaz. İzleme ilerlemen yalnızca bu cihazda saklanır. Görseller yüklenirken cihazın TMDB görsel sunucusuna bağlanır.</Muted>
      </Panel>
      <View style={{ height: 20 }} />
    </Screen>
  );
}
