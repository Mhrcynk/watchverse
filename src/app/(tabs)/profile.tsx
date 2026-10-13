import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { pickBackupFile, saveBackupFile } from '@/lib/backup-file';
import { copyText, enablePush, pushPermission } from '@/lib/push';
import { hasSyncApi, syncDevice } from '@/lib/sync';
import { Art, Wordmark, TitleRow } from '@/components/media';
import { Btn, Divider, Empty, Eyebrow, FadeIn, H1, H3, Muted, Panel, Press, Screen, SectionHead, Segmented, Small, Bar, useLayout, useToast } from '@/components/ui';
import { TBY, UBY, VIEWS, VIEW_TR } from '@/lib/catalog';
import { confirm } from '@/lib/confirm';
import { monthLabel } from '@/lib/format';
import { history, stats, universeProgress } from '@/lib/progress';
import { useStore } from '@/lib/store';
import { useAccount } from '@/lib/account';
import { fullStats } from '@/lib/stats';
import { C, F, R, alpha } from '@/lib/theme';
import type { ListView } from '@/lib/types';

export default function Profile() {
  const store = useStore();
  const { state } = store;
  const toast = useToast();
  const acc = useAccount();
  const { tablet } = useLayout();
  const s = useMemo(() => stats(state), [state]);
  const fs = useMemo(() => fullStats(state), [state]);
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
  const [pushOn, setPushOn] = useState(false);
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
        {[[state.follow.length, 'Takip edilen evren'], [fs.films, 'İzlenen film'], [fs.eps, 'İzlenen bölüm'], [Math.round(fs.minutes / 60), 'Saat izleme']].map(([v, l]) => (
          <Panel key={String(l)} style={{ flexGrow: 1, flexBasis: tablet ? '22%' : '45%', padding: 16 }}>
            <Text style={{ fontFamily: F.bold, fontSize: 28, color: C.text, letterSpacing: -1 }}>{Number(v).toLocaleString('tr-TR')}</Text>
            <Small style={{ marginTop: 2 }}>{l}</Small>
          </Panel>
        ))}
      </View>

      <Btn kind="secondary" icon="bar-chart-2" label="Tüm istatistiklerin" style={{ marginTop: 12 }} onPress={() => router.push('/stats')} />

      <AccountPanel />

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

      <SectionHead title="İzleme geçmişin" note={`${hist.length} kayıt`} />
      {groups.length ? groups.map((g) => (
        <View key={g.label} style={{ marginBottom: 12 }}>
          <Small style={{ marginBottom: 4, textTransform: 'capitalize' }}>{g.label}</Small>
          <Panel style={{ paddingVertical: 6 }}>{g.items.map((h) => <TitleRow key={h.t.id} t={h.t} showUniverse />)}</Panel>
        </View>
      )) : <Empty icon="clock" title="Henüz bir şey izlemedin." text="İşaretlediğin yapımlar ay ay burada birikir." />}

      <SectionHead title="Bildirimler" />
      <Panel>
        <Muted>Takip ettiğin dizilerde yeni bölüm çıktığında ve evrenlerine yeni yapım eklendiğinde telefonuna bildirim gelir.</Muted>
        {pushCode ? (
          <FadeIn style={{ marginTop: 14 }}>
            <Small style={{ color: C.green }}>İzin verildi. Son adım: bu kodu kopyala ve GitHub'da PUSH_SUBSCRIPTION ayarına yapıştır. Takip ettiğin evrenleri değiştirirsen kodu yeniden al.</Small>
            <Text selectable numberOfLines={3} style={{ marginTop: 10, padding: 12, borderRadius: R.md, backgroundColor: C.bg, color: C.muted, fontFamily: F.regular, fontSize: 12 }}>{pushCode}</Text>
            <Btn icon="copy" label="Kodu kopyala" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={async () => toast((await copyText(pushCode)) ? 'Kod kopyalandı' : 'Kopyalanamadı; metne uzun basıp kopyala')} />
          </FadeIn>
        ) : (
          hasSyncApi() && (pushOn || pushPermission() === 'granted') ? (
            <View style={{ marginTop: 14, gap: 10 }}>
              <Small style={{ color: C.green }}>Bildirimler açık. Takip ettiğin dizilerde yeni bölüm çıkınca ve evrenlerine yeni yapım eklenince haber verilir.</Small>
              <Btn kind="secondary" icon="refresh-cw" label="Aboneliği yenile" style={{ alignSelf: 'flex-start' }}
                onPress={async () => { const r = await enablePush(state.follow); const ok = r.ok && (await syncDevice(state, store.ensureDevice(), true)); toast(ok ? 'Bildirim aboneliği yenilendi' : r.ok ? 'Sunucuya ulaşılamadı, sonra tekrar dene' : r.reason); }} />
            </View>
          ) : (
          <Btn icon="bell" label="Bildirimleri aç" style={{ marginTop: 14, alignSelf: 'flex-start' }}
            onPress={async () => {
              const r = await enablePush(state.follow);
              if (!r.ok) { toast(r.reason); return; }
              if (hasSyncApi()) {
                const ok = await syncDevice(state, store.ensureDevice(), true);
                if (ok) { setPushOn(true); toast('Bildirimler açıldı'); return; }
              }
              setPushCode(r.code);
            }} />
          )
        )}
      </Panel>

      <SectionHead title="Yedekleme" />
      <Panel>
        <Muted>{acc.user ? 'Kayıtların hesabında güvende. İstersen ayrıca bir dosya yedeği de alabilirsin.' : "İlerlemen, puanların ve notların yalnızca bu cihazda tutulur. Hesap açarsan kaybolmaz. Ya da dosyaya yedekle: iPhone'da açılan sayfada “Dosyalar'a Kaydet”i seçip iCloud Drive'a kaydet."}</Muted>
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

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 28 }}>
        <Press accessibilityRole="link" onPress={() => router.push('/legal/gizlilik')} hitSlop={6}><Small style={{ color: C.muted }}>Gizlilik ve KVKK</Small></Press>
        <Press accessibilityRole="link" onPress={() => router.push('/legal/sartlar')} hitSlop={6}><Small style={{ color: C.muted }}>Kullanım şartları</Small></Press>
      </View>
      <Press accessibilityRole="button" onPress={() => router.push('/credits')} style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Small>WatchVerse 1.0 · Katalog, kaynaklar ve haklar</Small>
        <Feather name="chevron-right" size={18} color={C.dim} />
      </Press>
    </Screen>
  );
}

const label = { fontFamily: F.medium, fontSize: 13, color: C.muted, marginBottom: 8 } as const;

function ago(t: number | null) {
  if (!t) return '';
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'az önce' : m < 60 ? `${m} dk önce` : `${Math.round(m / 60)} sa önce`;
}

/** Hesap kartı: giriş yoksa davet, varsa eşitleme durumu ve hesap işlemleri */
function AccountPanel() {
  const acc = useAccount();
  const toast = useToast();
  const [, tick] = useState(0);
  useEffect(() => { const h = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(h); }, []);
  if (!acc.enabled) return null;
  if (!acc.user) {
    return (
      <Panel style={{ marginTop: 22, borderColor: alpha(C.accent, 0.45) }}>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: alpha(C.accent, 0.18), alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="cloud" size={20} color={C.accentSoft} />
          </View>
          <View style={{ flex: 1 }}>
            <H3>Kayıtların kaybolmasın</H3>
            <Small>Hesap açarsan izlediklerin her cihazda aynı görünür, telefon değişse de kaybolmaz.</Small>
          </View>
        </View>
        <Btn label="Giriş yap ya da hesap aç" style={{ marginTop: 14 }} onPress={() => router.push('/account')} />
      </Panel>
    );
  }
  const st = acc.status;
  const color = st === 'ok' ? C.green : st === 'syncing' ? C.muted : C.amber;
  const text = st === 'syncing' ? 'Eşitleniyor…' : st === 'ok' ? `Eşitlendi · ${ago(acc.lastSync)}` : st === 'offline' ? 'İnternet yok; bağlanınca eşitlenecek' : st === 'error' ? 'Eşitlenemedi; tekrar denenecek' : 'Bekliyor';
  return (
    <>
      <SectionHead title="Hesap" />
      <Panel>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Ionicons name={acc.user.google ? 'logo-google' : 'mail-outline'} size={18} color={C.muted} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: F.semibold, fontSize: 15, color: C.text }}>{acc.user.email || 'Hesabın'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
              <Small style={{ color }}>{text}</Small>
            </View>
          </View>
          <Btn kind="secondary" icon="refresh-cw" label="Eşitle" onPress={() => acc.syncNow()} />
        </View>
        <Divider />
        <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
          <Btn kind="quiet" label="Çıkış yap" onPress={() => confirm('Çıkış yapılsın mı?', 'Kayıtların hesabında kalır. Bu cihazdaki kayıtlar da silinmez.', 'Çıkış yap', async () => { await acc.signOut(); toast('Çıkış yapıldı'); })} />
          <Btn kind="quiet" label="Hesabı sil" onPress={() => confirm('Hesabın kalıcı olarak silinsin mi?', 'Hesabın ve sunucudaki tüm kayıtların hemen silinir; geri alınamaz. Bu cihazdaki kayıtlar kalır.', 'Hesabı sil', async () => {
            const r = await acc.deleteAccount();
            toast(r ? r : 'Hesabın silindi');
          })} />
        </View>
      </Panel>
    </>
  );
}
