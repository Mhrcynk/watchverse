import Feather from '@expo/vector-icons/Feather';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Backdrop } from '@/components/home';
import { usePreview } from '@/components/preview';
import { Row, Tile, useTileW } from '@/components/rows';
import { BackLink, Btn, Chip, FadeIn, Press, Screen, Small, useToast } from '@/components/ui';
import { pickBackupFile, saveBackupFile } from '@/lib/backup-file';
import { TBY, VIEWS, VIEW_TR } from '@/lib/catalog';
import { confirm } from '@/lib/confirm';
import { useAccount } from '@/lib/account';
import { isEn } from '@/lib/i18n';
import { history } from '@/lib/progress';
import { enablePush } from '@/lib/push';
import { fullStats } from '@/lib/stats';
import { useStore } from '@/lib/store';
import { hasSyncApi, syncDevice } from '@/lib/sync';
import { C, F, R, alpha } from '@/lib/theme';
import { img } from '@/lib/tmdb';
import type { ListView } from '@/lib/types';

type IconName = React.ComponentProps<typeof Feather>['name'];

export default function Profile() {
  const store = useStore();
  const { state } = store;
  const toast = useToast();
  const acc = useAccount();
  const tw = useTileW();
  const { openTitle } = usePreview();
  const fs = useMemo(() => fullStats(state), [state]);
  const hist = useMemo(() => history(state, 12), [state]);
  const favs = useMemo(() => Object.entries(state.ratings).map(([id, r]) => ({ t: TBY[id], r })).filter((x) => x.t)
    .sort((a, b) => b.r - a.r || (state.touched[b.t.id] || 0) - (state.touched[a.t.id] || 0)), [state]);
  const [importing, setImporting] = useState(false);
  const [code, setCode] = useState('');
  const [pushOn, setPushOn] = useState(false);
  const pushActive = hasSyncApi() && pushOn;

  const turnOnPush = async () => {
    const r = await enablePush(state.follow);
    if (!r.ok) { toast(r.reason); return; }
    if (hasSyncApi()) {
      const ok = await syncDevice(state, store.ensureDevice(), true);
      if (ok) { setPushOn(true); toast('Bildirimler açıldı'); return; }
    }
    toast('Bildirim izni verildi ancak sunucu kaydı tamamlanamadı. Giriş yapıp tekrar dene.');
  };
  const refreshPush = async () => {
    const r = await enablePush(state.follow);
    const ok = r.ok && (await syncDevice(state, store.ensureDevice(), true));
    toast(ok ? 'Bildirim aboneliği yenilendi' : r.ok ? 'Sunucuya ulaşılamadı, sonra tekrar dene' : r.reason);
  };
  const restoreFile = async () => {
    let txt;
    try { txt = await pickBackupFile(); } catch { toast('Yedek dosyası okunamadı veya çok büyük.'); return; }
    if (txt === null) return;
    confirm('Yedek geri yüklensin mi?', 'Bu cihazdaki mevcut ilerlemenin yerine yedekteki ilerleme gelir.', 'Geri yükle', () => {
      toast(store.importBackup(txt) ? 'Yedek geri yüklendi' : 'Dosya okunamadı. WatchVerse yedeği olduğundan emin ol.');
    });
  };
  const lastBackup = state.lastBackup ? new Date(state.lastBackup).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : undefined;

  return (
    <Screen>
      <Backdrop />
      <BackLink label="Ana sayfa" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <Header />

      <StatStrip items={[[state.follow.length, 'Evren'], [fs.films, 'Film'], [fs.eps, 'Bölüm'], [Math.round(fs.minutes / 60), 'Saat']]} />

      {acc.enabled && !acc.user && (
        <FadeIn>
          <Press accessibilityRole="button" accessibilityLabel="Giriş yap ya da hesap aç" onPress={() => router.push('/account')} scaleTo={0.98}
            style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: R.lg, backgroundColor: alpha(C.accent, 0.12) }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="cloud" size={19} color={C.onAccent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: F.semibold, fontSize: 15, color: C.text }}>Kayıtların kaybolmasın</Text>
              <Small style={{ marginTop: 2 }}>Hesap aç, her cihazda aynı görünsün.</Small>
            </View>
            <Feather name="chevron-right" size={20} color={C.accent} />
          </Press>
        </FadeIn>
      )}

      {favs.length > 0 && (
        <Row title="En sevdiklerin" note={`${favs.length} yapım`}>
          {favs.slice(0, 20).map(({ t, r }, i) => (
            <Tile key={t.id} index={i} width={tw} uri={img(t.tmdb?.p, 'w342')} title={t.title} score={`★ ${r}`} onPress={() => openTitle(t)} />
          ))}
        </Row>
      )}

      {hist.length > 0 && (
        <Row title="Son izlediklerin" onMore={() => router.push('/history')}>
          {hist.map((h, i) => (
            <Tile key={h.t.id} index={i} width={tw} uri={img(h.t.tmdb?.p, 'w342')} title={h.t.title} sub={h.t.year ? String(h.t.year) : undefined} onPress={() => openTitle(h.t)} />
          ))}
        </Row>
      )}

      <Group title="Hızlı erişim">
        <Item icon="calendar" label="Yayın takvimi" onPress={() => router.push('/calendar')} />
        <Item icon="bar-chart-2" label="İstatistikler" onPress={() => router.push('/stats')} />
        <Item icon="users" label="Arkadaşlar" onPress={() => router.push('/friends')} />
        <Item icon="sliders" label="Evrenlerini düzenle" onPress={() => router.push('/onboarding')} />
      </Group>

      <Group title="Tercihler">
        <Item icon="eye-off" label="Spoiler koruması" sub="İzlemediklerinin devamını gizler" right={
          <Switch value={state.spoiler} onValueChange={store.setSpoiler} trackColor={{ true: C.accent, false: C.line }} thumbColor="#fff" {...({ activeThumbColor: '#fff' } as object)} accessibilityLabel="Spoiler koruması" />
        } />
        <Item icon="list" label="Evren listelerinde göster" below={
          <View accessibilityRole="radiogroup" accessibilityLabel="Liste görünümü" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {VIEWS.map((v) => <Chip key={v} label={VIEW_TR[v]} active={state.view === v} onPress={() => store.setView(v as ListView)} />)}
          </View>
        } />
        <Item icon="bell" label="Bildirimler" sub={pushActive ? 'Açık: yeni bölüm ve yeni yapımlar' : 'Yeni bölüm çıkınca haber ver'}
          right={pushActive ? <SmallBtn label="Yenile" a11y="Bildirim aboneliğini yenile" onPress={refreshPush} /> : <SmallBtn label="Aç" a11y="Bildirimleri aç" strong onPress={turnOnPush} />}
        />
      </Group>

      <Group title="Kayıtların">
        <Item icon="log-in" label="Letterboxd / TV Time'dan aktar" onPress={() => router.push('/import')} />
        <Item icon="download" label="Dosyaya yedekle" value={lastBackup} onPress={async () => { if (await saveBackupFile(store.exportBackup())) { store.markBackup(); toast('Yedek hazırlandı'); } }} />
        <Item icon="upload" label="Yedekten geri yükle" onPress={restoreFile} below={importing ? (
          <View>
            <TextInput value={code} onChangeText={setCode} placeholder="WATCHVERSE: ile başlayan kodu yapıştır" placeholderTextColor={C.dim} multiline accessibilityLabel="Yedek kodu"
              style={{ minHeight: 90, borderRadius: R.md, backgroundColor: C.raised, color: C.text, padding: 12, fontFamily: F.regular, fontSize: 16, textAlignVertical: 'top' }} />
            <Btn label="Yedeği geri yükle" style={{ marginTop: 10, alignSelf: 'flex-start' }} disabled={!code.trim()}
              onPress={() => confirm('Yedek geri yüklensin mi?', 'Bu cihazdaki mevcut ilerlemenin yerine yedekteki ilerleme gelir.', 'Geri yükle', () => {
                const ok = store.importBackup(code);
                toast(ok ? 'Yedek geri yüklendi' : 'Kod okunamadı. Tamamını kopyaladığından emin ol.');
                if (ok) { setCode(''); setImporting(false); }
              })} />
          </View>
        ) : undefined} />
        <Item icon="rotate-ccw" label="Tüm ilerlemeyi sıfırla" danger
          onPress={() => confirm('Tüm ilerleme silinsin mi?', 'İzlediklerin, listen ve geçmişin silinir. Takip ettiğin evrenler ve tercihlerin kalır.', 'Sıfırla', () => { store.reset(); toast('İlerleme sıfırlandı'); })} />
      </Group>

      {acc.user && (
        <Group title="Hesap">
          <Item icon="log-out" label="Çıkış yap" onPress={() => confirm('Çıkış yapılsın mı?', 'Kayıtların hesabında kalır. Bu cihazdaki kayıtlar da silinmez.', 'Çıkış yap', async () => { await acc.signOut(); toast('Çıkış yapıldı'); router.replace('/welcome'); })} />
          <Item icon="trash-2" label="Hesabı sil" danger onPress={() => confirm('Hesabın kalıcı olarak silinsin mi?', 'Hesabın ve sunucudaki tüm kayıtların hemen silinir; geri alınamaz. Bu cihazdaki kayıtlar kalır.', 'Hesabı sil', async () => {
            const r = await acc.deleteAccount();
            toast(r ? r : 'Hesabın silindi');
            if (!r) router.replace('/welcome');
          })} />
        </Group>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 18, marginTop: 30 }}>
        <Press accessibilityRole="link" onPress={() => router.push('/legal/gizlilik')} hitSlop={6}><Small>Gizlilik ve KVKK</Small></Press>
        <Press accessibilityRole="link" onPress={() => router.push('/legal/sartlar')} hitSlop={6}><Small>Kullanım şartları</Small></Press>
        <Press accessibilityRole="link" onPress={() => router.push('/credits')} hitSlop={6}><Small>Kaynaklar ve haklar</Small></Press>
      </View>
      <Small style={{ textAlign: 'center', marginTop: 10, color: C.dim }}>WatchVerse 1.0</Small>
    </Screen>
  );
}

function ago(t: number | null) {
  if (!t) return '';
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'az önce' : m < 60 ? `${m} dk önce` : `${Math.round(m / 60)} sa önce`;
}

/** Üst kısım: büyük baş harf, ad (dokununca düzenlenir), hesap ve eşitleme durumu */
function Header() {
  const store = useStore();
  const acc = useAccount();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(store.state.name);
  const [, tick] = useState(0);
  useEffect(() => { const h = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(h); }, []);
  const initial = (store.state.name.trim()[0] || 'W').toLocaleUpperCase('tr');
  const save = () => { store.setName(name.trim()); setEditing(false); };

  const st = acc.status;
  const color = st === 'ok' ? C.green : st === 'syncing' ? C.muted : C.amber;
  const syncText = st === 'syncing' ? 'Eşitleniyor…' : st === 'ok' ? `Eşitlendi · ${ago(acc.lastSync)}` : st === 'offline' ? 'İnternet yok; bağlanınca eşitlenecek' : st === 'error' ? 'Eşitlenemedi; tekrar denenecek' : 'Bekliyor';

  return (
    <View style={{ alignItems: 'center', marginTop: 8 }}>
      <LinearGradient colors={[C.accentSoft, '#C9902A']} style={{ width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', shadowColor: C.accent, shadowOpacity: 0.35, shadowRadius: 22, shadowOffset: { width: 0, height: 8 } }}>
        <Text style={{ fontFamily: F.heavy, fontSize: 36, color: C.onAccent }}>{initial}</Text>
      </LinearGradient>

      {editing ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, alignSelf: 'stretch', justifyContent: 'center' }}>
          <TextInput autoFocus value={name} onChangeText={setName} onSubmitEditing={save} onBlur={save} placeholder="Adın" placeholderTextColor={C.dim} maxLength={40} accessibilityLabel="Adın"
            style={{ flex: 1, maxWidth: 260, height: 46, borderRadius: R.md, backgroundColor: C.card, color: C.text, paddingHorizontal: 14, fontFamily: F.semibold, fontSize: 17, textAlign: 'center' }} />
          <Press accessibilityRole="button" accessibilityLabel="Adı kaydet" onPress={save} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="check" size={20} color={C.onAccent} />
          </Press>
        </View>
      ) : (
        <Press accessibilityRole="button" accessibilityLabel="Adını düzenle" onPress={() => { setName(store.state.name); setEditing(true); }} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <Text accessibilityRole="header" numberOfLines={1} style={{ fontFamily: F.bold, fontSize: 26, color: C.text, letterSpacing: -0.6 }}>{store.state.name || 'Adını ekle'}</Text>
          <Feather name="edit-2" size={15} color={C.dim} />
        </Press>
      )}

      {acc.user ? (
        <Press accessibilityRole="button" accessibilityLabel={`Şimdi eşitle. ${syncText}`} onPress={() => acc.syncNow()} hitSlop={6} style={{ alignItems: 'center', marginTop: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name={acc.user.google ? 'logo-google' : 'mail-outline'} size={13} color={C.muted} />
            <Text numberOfLines={1} style={{ fontFamily: F.regular, fontSize: 13.5, color: C.muted }}>{acc.user.email || 'Hesabın'}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
            <Text style={{ fontFamily: F.regular, fontSize: 12.5, color }}>{syncText}</Text>
          </View>
        </Press>
      ) : (
        <Text style={{ marginTop: 6, fontFamily: F.regular, fontSize: 13.5, color: C.muted }}>{acc.enabled ? 'Hesapsız kullanıyorsun' : 'Kayıtların bu cihazda'}</Text>
      )}
    </View>
  );
}

/** Dört sayı tek kartta; dokununca ayrıntılı istatistikler */
function StatStrip({ items }: { items: [number, string][] }) {
  return (
    <Press accessibilityRole="button" accessibilityLabel={`İstatistikler: ${items.map(([v, l]) => `${v} ${l}`).join(', ')}`} onPress={() => router.push('/stats')} scaleTo={0.98}
      style={{ marginTop: 24, flexDirection: 'row', paddingVertical: 18, borderRadius: R.lg, backgroundColor: C.card }}>
      {items.map(([v, l], i) => (
        <View key={l} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i ? StyleSheet.hairlineWidth : 0, borderLeftColor: C.line }}>
          <Text style={{ fontFamily: F.bold, fontSize: 22, color: i === 0 ? C.accent : C.text, letterSpacing: -0.6 }}>{Number(v).toLocaleString(isEn ? 'en-US' : 'tr-TR')}</Text>
          <Text style={{ marginTop: 2, fontFamily: F.regular, fontSize: 12.5, color: C.muted }}>{l}</Text>
        </View>
      ))}
    </Press>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const kids = (Array.isArray(children) ? children : [children]).flat().filter(Boolean);
  return (
    <View style={{ marginTop: 28 }}>
      <Text accessibilityRole="header" style={{ fontFamily: F.semibold, fontSize: 14, color: C.muted, marginBottom: 10, marginLeft: 4 }}>{title}</Text>
      <View style={{ borderRadius: R.lg, backgroundColor: C.card, overflow: 'hidden' }}>
        {kids.map((k, i) => (
          <View key={i}>
            {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginLeft: 62 }} />}
            {k}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Ayar satırı: simge, ad, isteğe bağlı açıklama / değer / sağ öğe, altında ek alan */
function Item({ icon, label, sub, value, right, below, onPress, danger }: {
  icon: IconName; label: string; sub?: string; value?: string; right?: ReactNode; below?: ReactNode; onPress?: () => void; danger?: boolean;
}) {
  const tint = danger ? C.danger : C.text;
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingHorizontal: 14, paddingVertical: 10 }}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: danger ? alpha(C.danger, 0.14) : C.raised, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={icon} size={17} color={danger ? C.danger : C.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.medium, fontSize: 15, color: tint }}>{label}</Text>
        {!!sub && <Text style={{ marginTop: 2, fontFamily: F.regular, fontSize: 12.5, color: C.muted }}>{sub}</Text>}
      </View>
      {!!value && <Text style={{ fontFamily: F.regular, fontSize: 13.5, color: C.muted }}>{value}</Text>}
      {right}
      {onPress && !right && <Feather name="chevron-right" size={18} color={C.dim} />}
    </View>
  );
  return (
    <View>
      {onPress ? <Press accessibilityRole="button" accessibilityLabel={label} onPress={onPress} scaleTo={0.99}>{body}</Press> : body}
      {below && <View style={{ paddingHorizontal: 14, paddingBottom: 14, paddingLeft: 62, marginTop: -2 }}>{below}</View>}
    </View>
  );
}

function SmallBtn({ label, a11y, onPress, strong }: { label: string; a11y?: string; onPress: () => void; strong?: boolean }) {
  return (
    <Press accessibilityRole="button" accessibilityLabel={a11y || label} onPress={onPress} scaleTo={0.95} hitSlop={6}
      style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99, backgroundColor: strong ? C.accent : C.raised }}>
      <Text style={{ fontFamily: F.bold, fontSize: 13, color: strong ? C.onAccent : C.text }}>{label}</Text>
    </Press>
  );
}
