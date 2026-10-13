import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { pickBackupFile, saveBackupFile } from '@/lib/backup-file';
import { copyText, enablePush, pushPermission } from '@/lib/push';
import { Art, Wordmark, TitleRow } from '@/components/media';
import { Btn, Divider, Empty, Eyebrow, FadeIn, H1, H3, Muted, Panel, Press, Screen, SectionHead, Segmented, Small, Bar, useLayout, useToast } from '@/components/ui';
import { TBY, UBY, VIEWS, VIEW_TR } from '@/lib/catalog';
import { confirm } from '@/lib/confirm';
import { monthLabel } from '@/lib/format';
import { history, stats, universeProgress } from '@/lib/progress';
import { useStore } from '@/lib/store';
import { C, F, R, alpha } from '@/lib/theme';
import type { ListView } from '@/lib/types';

export default function Profile() {
  const store = useStore();
  const { state } = store;
  const toast = useToast();
  const { tablet } = useLayout();
  const s = useMemo(() => stats(state), [state]);
  const hist = useMemo(() => history(state, 30), [state]);
  const [importing, setImporting] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState(state.name);
  useEffect(() => setName(state.name), [state.name]);
  const list = state.list.map((id) => TBY[id]).filter(Boolean);
  const initial = (state.name.trim()[0] || 'W').toLocaleUpperCase('tr');

  const groups: { label: string; items: typeof hist }[] = [];
  for (const h of hist) {
    const label = h.at ? monthLabel(h.at) : 'Tarihsiz';
    const g = groups.find((x) => x.label === label);
    g ? g.items.push(h) : groups.push({ label, items: [h] });
  }

  const [pushCode, setPushCode] = useState<string | null>(null);
  const favs = Object.entries(state.ratings).map(([id, r]) => ({ t: TBY[id], r })).filter((x) => x.t).sort((a, b) => b.r - a.r || (state.touched[b.t.id] || 0) - (state.touched[a.t.id] || 0));
  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: alpha(C.accent, 0.25), borderWidth: 1, borderColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: F.bold, fontSize: 26, color: C.text }}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Eyebrow>Kişisel evrenin</Eyebrow>
          <H1 style={{ marginTop: 4, fontSize: 26 }}>{state.name ? `Merhaba, ${state.name}.` : 'Merhaba, gezgin.'}</H1>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 }}>
        {[[state.follow.length, 'Takip edilen evren'], [s.films, 'İzlenen film ve özel'], [s.eps, 'İzlenen bölüm'], [s.hours, 'Saatlik yolculuk']].map(([v, l]) => (
          <Panel key={String(l)} style={{ flexGrow: 1, flexBasis: tablet ? '22%' : '45%', padding: 16 }}>
            <Text style={{ fontFamily: F.bold, fontSize: 28, color: C.text, letterSpacing: -1 }}>{Number(v).toLocaleString('tr-TR')}</Text>
            <Small style={{ marginTop: 2 }}>{l}</Small>
          </Panel>
        ))}
      </View>

      <SectionHead title="Evren istatistiklerin" note={VIEW_TR[state.view]} />
      <Panel>
        {state.follow.length ? state.follow.map((id, i) => {
          const u = UBY[id]; const p = universeProgress(state, id);
          return (
            <Press key={id} accessibilityRole="button" onPress={() => router.push(`/universe/${id}`)} style={{ paddingVertical: 10, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: C.lineSoft }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontFamily: F.medium, fontSize: 14.5, color: C.text }}>{u.name}</Text>
                <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.text }}>{p.pct}%</Text>
              </View>
              <Bar pct={p.pct} color={u.color} />
            </Press>
          );
        }) : <Muted>Evren takip ederek yolculuğuna başla.</Muted>}
      </Panel>

      {favs.length > 0 && (
        <>
          <SectionHead title="En sevdiklerin" note={`${favs.length} puanlı yapım`} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 8 }}>
            {favs.slice(0, 20).map(({ t, r }) => (
              <Press key={t.id} accessibilityRole="button" accessibilityLabel={`${t.title}, ${r} yıldız`} onPress={() => router.push(`/title/${t.id}`)} style={{ width: 112 }}>
                <Art t={t} size="w185" style={{ width: 112, borderRadius: R.md }} />
                <Text numberOfLines={1} style={{ marginTop: 6, fontFamily: F.semibold, fontSize: 13, color: C.text }}>{t.title}</Text>
                <View style={{ flexDirection: 'row', gap: 1, marginTop: 2 }}>
                  {[1, 2, 3, 4, 5].map((n) => <Ionicons key={n} name={n <= r ? 'star' : 'star-outline'} size={12} color={n <= r ? C.amber : C.dim} />)}
                </View>
              </Press>
            ))}
          </ScrollView>
        </>
      )}

      <SectionHead title="Rozetlerin" note={`${s.completed.length} / ${state.follow.length || 25}`} />
      {s.completed.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {s.completed.map((u) => (
            <Panel key={u.id} style={{ flexBasis: tablet ? '30%' : '46%', flexGrow: 1, borderColor: alpha(u.color, 0.5) }}>
              <Feather name="award" size={22} color={u.color} />
              <H3 style={{ marginTop: 10 }}>{u.badge}</H3>
              <Small style={{ marginTop: 2 }}>{u.name} · {VIEW_TR[state.view]} tamamlandı</Small>
            </Panel>
          ))}
        </View>
      ) : <Panel><H3>İlk rozetin seni bekliyor.</H3><Small style={{ marginTop: 4 }}>Bir evrende seçili rotayı tamamladığında burada görünür.</Small></Panel>}

      <SectionHead title="Tercihler" />
      <Panel>
        <Text style={label}>Adın</Text>
        <TextInput value={name} onChangeText={setName} onBlur={() => store.setName(name.trim())} onSubmitEditing={() => store.setName(name.trim())}
          placeholder="İsteğe bağlı" placeholderTextColor={C.dim} maxLength={40} accessibilityLabel="Adın"
          style={{ height: 46, borderRadius: R.md, backgroundColor: C.raised, color: C.text, paddingHorizontal: 14, fontFamily: F.regular, fontSize: 15 }} />
        <Divider />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <H3>Spoiler koruması</H3>
            <Small>İzlemediğin bir yapımdan sonra gelen hikâyeleri gizler.</Small>
          </View>
          <Switch value={state.spoiler} onValueChange={store.setSpoiler} trackColor={{ true: C.accent, false: C.line }} thumbColor="#fff" accessibilityLabel="Spoiler koruması" />
        </View>
        <Divider />
        <Text style={label}>Evren listelerinin görünümü</Text>
        <Segmented<ListView> label="Liste görünümü" value={state.view} onChange={store.setView} options={VIEWS.map((v) => ({ id: v, label: VIEW_TR[v] }))} />
        <Divider />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}><H3>Evrenlerini ve başlangıç noktanı düzenle</H3><Small>Takip ettiklerini seç, izlediklerini topluca işaretle.</Small></View>
          <Btn kind="quiet" label="Düzenle" onPress={() => router.push('/onboarding')} />
        </View>
      </Panel>

      <SectionHead title="İzleme listem" note={`${list.length} yapım`} />
      {list.length ? <Panel style={{ paddingVertical: 6 }}>{list.map((t) => <TitleRow key={t.id} t={t} showUniverse />)}</Panel>
        : <Empty icon="bookmark" title="Listen boş." text="Bir yapımın sayfasında “Listeme ekle”ye dokunduğunda burada görünür." />}

      <SectionHead title="İzleme geçmişin" note={`${hist.length} kayıt`} />
      {groups.length ? groups.map((g) => (
        <View key={g.label} style={{ marginBottom: 12 }}>
          <Small style={{ marginBottom: 4, textTransform: 'capitalize' }}>{g.label}</Small>
          <Panel style={{ paddingVertical: 6 }}>{g.items.map((h) => <TitleRow key={h.t.id} t={h.t} showUniverse />)}</Panel>
        </View>
      )) : <Empty icon="clock" title="Henüz bir şey izlemedin." text="İşaretlediğin yapımlar ay ay burada birikir." />}

      <SectionHead title="Bildirimler" />
      <Panel>
        <Muted>Takip ettiğin evrenlere yeni bölüm, sezon ya da yapım eklendiğinde haftalık güncellemeyle telefonuna bildirim gelir.</Muted>
        {pushCode ? (
          <FadeIn style={{ marginTop: 14 }}>
            <Small style={{ color: C.green }}>İzin verildi. Son adım: bu kodu kopyala ve GitHub'da PUSH_SUBSCRIPTION ayarına yapıştır. Takip ettiğin evrenleri değiştirirsen kodu yeniden al.</Small>
            <Text selectable numberOfLines={3} style={{ marginTop: 10, padding: 12, borderRadius: R.md, backgroundColor: C.bg, color: C.muted, fontFamily: F.regular, fontSize: 12 }}>{pushCode}</Text>
            <Btn icon="copy" label="Kodu kopyala" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={async () => toast((await copyText(pushCode)) ? 'Kod kopyalandı' : 'Kopyalanamadı; metne uzun basıp kopyala')} />
          </FadeIn>
        ) : (
          <Btn icon="bell" label={pushPermission() === 'granted' ? 'Bildirim kodunu al' : 'Bildirimleri aç'} style={{ marginTop: 14, alignSelf: 'flex-start' }}
            onPress={async () => { const r = await enablePush(state.follow); if (r.ok) setPushCode(r.code); else toast(r.reason); }} />
        )}
      </Panel>

      <SectionHead title="Yedekleme" />
      <Panel>
        <Muted>İlerlemen, puanların ve notların yalnızca bu cihazda tutulur. Dosyaya yedekle; iPhone'da açılan sayfada “Dosyalar'a Kaydet”i seçip iCloud Drive'a kaydedersen telefon değişse bile kaybolmaz.</Muted>
        <Small style={{ marginTop: 8, color: state.lastBackup ? C.green : C.amber }}>{state.lastBackup ? `Son yedek: ${new Date(state.lastBackup).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Henüz yedek almadın.'}</Small>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <Btn icon="upload-cloud" label="Dosyaya yedekle" onPress={async () => { const ok = await saveBackupFile(store.exportBackup()); if (ok) { store.markBackup(); toast('Yedek hazırlandı'); } }} />
          <Btn icon="download" kind="secondary" label="Dosyadan geri yükle" onPress={async () => {
            const txt = await pickBackupFile();
            if (txt === null) { if (Platform.OS !== 'web') setImporting(true); return; }
            confirm('Yedek geri yüklensin mi?', 'Bu cihazdaki mevcut ilerlemenin yerine yedekteki ilerleme gelir.', 'Geri yükle', () => {
              const ok = store.importBackup(txt);
              toast(ok ? 'Yedek geri yüklendi' : 'Dosya okunamadı. WatchVerse yedeği olduğundan emin ol.');
            });
          }} />
          <Btn kind="quiet" label={importing ? 'Kodu gizle' : 'Kodla geri yükle'} onPress={() => setImporting((v) => !v)} />
        </View>
        {importing && (
          <View style={{ marginTop: 14 }}>
            <TextInput value={code} onChangeText={setCode} placeholder="WATCHVERSE: ile başlayan kodu yapıştır" placeholderTextColor={C.dim} multiline accessibilityLabel="Yedek kodu"
              style={{ minHeight: 90, borderRadius: R.md, backgroundColor: C.raised, color: C.text, padding: 12, fontFamily: F.regular, fontSize: 13, textAlignVertical: 'top' }} />
            <Btn label="Yedeği geri yükle" style={{ marginTop: 10, alignSelf: 'flex-start' }} disabled={!code.trim()}
              onPress={() => confirm('Yedek geri yüklensin mi?', 'Bu cihazdaki mevcut ilerlemenin yerine yedekteki ilerleme gelir.', 'Geri yükle', () => {
                const ok = store.importBackup(code);
                toast(ok ? 'Yedek geri yüklendi' : 'Kod okunamadı. Tamamını kopyaladığından emin ol.');
                if (ok) { setCode(''); setImporting(false); }
              })} />
          </View>
        )}
        <Divider />
        <Btn kind="quiet" label="Tüm ilerlemeyi sıfırla" style={{ alignSelf: 'flex-start' }}
          onPress={() => confirm('Tüm ilerleme silinsin mi?', 'İzlediklerin, listen ve geçmişin silinir. Takip ettiğin evrenler ve tercihlerin kalır.', 'Sıfırla', () => { store.reset(); toast('İlerleme sıfırlandı'); })} />
      </Panel>

      <Press accessibilityRole="button" onPress={() => router.push('/credits')} style={{ marginTop: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Small>WatchVerse 1.0 · Katalog, kaynaklar ve haklar</Small>
        <Feather name="chevron-right" size={18} color={C.dim} />
      </Press>
    </Screen>
  );
}

const label = { fontFamily: F.medium, fontSize: 13, color: C.muted, marginBottom: 8 } as const;
