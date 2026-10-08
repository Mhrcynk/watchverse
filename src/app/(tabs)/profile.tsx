import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Wordmark, TitleRow } from '@/components/media';
import { Btn, Divider, Empty, Eyebrow, H1, H3, Muted, Panel, Press, Screen, SectionHead, Segmented, Small, Bar, useLayout, useToast } from '@/components/ui';
import { MODE_TR, ORDER_TR, TBY, UBY } from '@/lib/catalog';
import { confirm } from '@/lib/confirm';
import { monthLabel } from '@/lib/format';
import { history, stats, universeProgress } from '@/lib/progress';
import { useStore } from '@/lib/store';
import { C, F, R, alpha } from '@/lib/theme';
import type { Mode, Order } from '@/lib/types';

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

      <SectionHead title="Evren istatistiklerin" note={MODE_TR[state.mode]} />
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

      <SectionHead title="Rozetlerin" note={`${s.completed.length} / ${state.follow.length || 25}`} />
      {s.completed.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {s.completed.map((u) => (
            <Panel key={u.id} style={{ flexBasis: tablet ? '30%' : '46%', flexGrow: 1, borderColor: alpha(u.color, 0.5) }}>
              <Feather name="award" size={22} color={u.color} />
              <H3 style={{ marginTop: 10 }}>{u.badge}</H3>
              <Small style={{ marginTop: 2 }}>{u.name} · {MODE_TR[state.mode]} rotası tamamlandı</Small>
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
        <Text style={label}>Varsayılan izleme modu</Text>
        <Segmented<Mode> label="İzleme modu" value={state.mode} onChange={store.setMode} options={(['essential', 'recommended', 'complete'] as Mode[]).map((m) => ({ id: m, label: MODE_TR[m] }))} />
        <Text style={[label, { marginTop: 16 }]}>Varsayılan izleme sırası</Text>
        <Segmented<Order> label="İzleme sırası" value={state.order} onChange={store.setOrder} options={(['recommended', 'release', 'chrono'] as Order[]).map((o) => ({ id: o, label: ORDER_TR[o] }))} />
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

      <SectionHead title="Yedekleme" />
      <Panel>
        <Muted>İlerlemen yalnızca bu cihazda tutulur. Telefon değiştirirken ya da uygulamayı silmeden önce yedek kodunu al, yeni cihazda yapıştır.</Muted>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <Btn icon="share" kind="secondary" label="Yedek kodunu paylaş" onPress={() => Share.share({ message: store.exportBackup() }).catch(() => {})} />
          <Btn icon="download" kind="secondary" label="Yedekten yükle" onPress={() => setImporting((v) => !v)} />
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
