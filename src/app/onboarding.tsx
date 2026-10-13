import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Brand } from '@/components/brand';
import { Wordmark } from '@/components/media';
import { Btn, Eyebrow, Grid, H1, H3, Muted, Press, Screen, Small, tap, useLayout } from '@/components/ui';
import { UBY, UNIVERSES, routeTitles } from '@/lib/catalog';
import { isDone } from '@/lib/progress';
import { useStore } from '@/lib/store';
import { C, F, R, alpha } from '@/lib/theme';

export default function Onboarding() {
  const store = useStore();
  const { state } = store;
  const editing = state.onboarded;
  const { tablet, width } = useLayout();
  const [step, setStep] = useState(1); // tanıtım artık hoş geldin ekranında
  const [sel, setSel] = useState<string[]>(state.follow.length ? state.follow : []);
  const [open, setOpen] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const u of UNIVERSES) for (const t of routeTitles(u.id, u.defaultBranch, 'recommended', 'release')) if (isDone(state, t)) s.add(t.id);
    return s;
  });
  const lists = useMemo(() => Object.fromEntries(sel.map((u) => [u, routeTitles(u, UBY[u].defaultBranch, 'recommended', 'release')])), [sel]);
  const cols = tablet ? 4 : width >= 520 ? 3 : 2;

  const toggleU = (id: string) => { tap(); setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])); };
  const togglePick = (ids: string[], on: boolean) => setPicked((p) => { const n = new Set(p); ids.forEach((i) => (on ? n.add(i) : n.delete(i))); return n; });

  const finish = () => {
    store.setState((s) => {
      const now = Date.now();
      const watched = { ...s.watched };
      const episodes = { ...s.episodes };
      for (const u of sel) for (const t of lists[u] || []) {
        const want = picked.has(t.id);
        const has = isDone(s, t);
        if (want === has) continue;
        if (t.episodes) { if (want) episodes[t.id] = Array.from({ length: t.episodes }, (_, i) => i + 1); else delete episodes[t.id]; }
        else { if (want) watched[t.id] = now; else delete watched[t.id]; }
      }
      return { ...s, onboarded: true, follow: sel, watched, episodes };
    });
    tap('success');
    if (editing && router.canGoBack()) router.back(); else router.replace('/');
  };


  if (step === 0) {
    return (
      <Screen style={{ flexGrow: 1, justifyContent: 'center' }}>
        <LinearGradient colors={[alpha(C.accent, 0.22), 'transparent']} style={[StyleSheet.absoluteFill, { height: 420 }]} pointerEvents="none" />
        <View style={{ maxWidth: 560, width: '100%', alignSelf: 'center', paddingVertical: 30 }}>
          <Steps step={step} />
          <Brand />
          <Eyebrow style={{ marginTop: 38 }}>WatchVerse’e hoş geldin</Eyebrow>
          <Text style={{ fontFamily: F.bold, fontSize: tablet ? 44 : 36, lineHeight: tablet ? 50 : 42, color: C.text, letterSpacing: -1.2, marginTop: 10 }}>
            Sevdiğin tüm evrenler.{'\n'}<Text style={{ color: C.accentSoft }}>Doğru sırayla.</Text>
          </Text>
          <Muted style={{ marginTop: 14, fontSize: 16, lineHeight: 24 }}>Nerede kaldığını hatırla, sıradaki hikâyeni bul. {UNIVERSES.length} evren, film ve diziler, bölüm bölüm takip.</Muted>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 22 }}>
            {UNIVERSES.slice(0, 12).map((u) => <Wordmark key={u.id} u={u} size={9.5} />)}
            <View style={{ paddingHorizontal: 8, paddingVertical: 4 }}><Small>ve {UNIVERSES.length - 12} evren daha</Small></View>
          </View>
          <Btn label="Yolculuğa başla" style={{ marginTop: 30 }} onPress={() => setStep(1)} />
          <Small style={{ marginTop: 14, textAlign: 'center' }}>Üyelik gerekmez. İlerlemen bu cihazda saklanır.</Small>
        </View>
      </Screen>
    );
  }

  if (step === 1) {
    return (
      <Screen>
        <Steps step={step} />
        <Eyebrow>01 · Evrenlerin</Eyebrow>
        <H1 style={{ marginTop: 8 }}>Hangi dünyalara dönmek istersin?</H1>
        <Muted style={{ marginTop: 8, marginBottom: 22 }}>En az bir evren seç. Sonra istediğin zaman değiştirebilirsin.</Muted>
        <Grid items={UNIVERSES} cols={cols} gap={12} keyOf={(u) => u.id} render={(u) => {
            const on = sel.includes(u.id);
            return (
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={u.name} onPress={() => toggleU(u.id)}
                style={({ pressed }) => ({ minHeight: 104, padding: 14, borderRadius: R.lg, backgroundColor: on ? alpha(u.color, 0.14) : C.card, borderWidth: 1, borderColor: on ? u.color : C.line, opacity: pressed ? 0.75 : 1, justifyContent: 'space-between' })}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                  <Wordmark u={u} size={9.5} />
                  <Feather name={on ? 'check-circle' : 'plus-circle'} size={19} color={on ? u.color : C.dim} />
                </View>
                <View style={{ marginTop: 12 }}>
                  <Text numberOfLines={1} style={{ fontFamily: F.semibold, fontSize: 14, color: C.text }}>{u.name}</Text>
                  <Small numberOfLines={1}>{routeTitles(u.id, 'all', null, 'release').length} yapım</Small>
                </View>
              </Pressable>
            );
          }} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 26 }}>
          {editing && <Btn kind="secondary" label="Vazgeç" onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))} />}
          <Btn style={{ flex: 1 }} label={`Devam et · ${sel.length} evren`} disabled={!sel.length} onPress={() => { setStep(2); setOpen(sel[0] || null); }} />
        </View>
      </Screen>
    );
  }

  const total = sel.reduce((n, u) => n + (lists[u] || []).filter((t) => picked.has(t.id)).length, 0);
  return (
    <Screen>
      <Steps step={step} />
      <Eyebrow>02 · Başlangıç noktan</Eyebrow>
      <H1 style={{ marginTop: 8 }}>Hikâyede neredesin?</H1>
      <Muted style={{ marginTop: 8 }}>İzlediklerine dokun, kaldığın yerden devam et. Diziler için yayımlanmış bütün bölümler işaretlenir.</Muted>
      <Small style={{ marginTop: 10, marginBottom: 16, color: C.accentSoft }}>{total} yapım seçildi</Small>

      {sel.map((uid) => {
        const u = UBY[uid];
        const l = lists[uid] || [];
        const n = l.filter((t) => picked.has(t.id)).length;
        const isOpen = open === uid;
        return (
          <View key={uid} style={{ marginBottom: 10, borderRadius: R.lg, backgroundColor: C.card, borderWidth: StyleSheet.hairlineWidth, borderColor: isOpen ? alpha(u.color, 0.5) : C.line, overflow: 'hidden' }}>
            <Press accessibilityRole="button" accessibilityState={{ expanded: isOpen }} onPress={() => setOpen(isOpen ? null : uid)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
              <View style={{ flex: 1 }}>
                <H3>{u.name}</H3>
                <Small>{n} / {l.length} izlendi</Small>
              </View>
              <Feather name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color={C.muted} />
            </Press>
            {isOpen && (
              <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  <Btn kind="secondary" label="Sıfırdan başlıyorum" style={{ flex: 1, minHeight: 40 }} onPress={() => togglePick(l.map((t) => t.id), false)} />
                  <Btn kind="secondary" label="Hepsini izledim" style={{ flex: 1, minHeight: 40 }} onPress={() => togglePick(l.map((t) => t.id), true)} />
                </View>
                {l.map((t) => {
                  const on = picked.has(t.id);
                  return (
                    <Pressable key={t.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${t.title}, ${t.year}`}
                      onPress={() => { tap(); togglePick([t.id], !on); }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.lineSoft }}>
                      <Feather name={on ? 'check-square' : 'square'} size={20} color={on ? u.color : C.dim} />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontFamily: F.medium, fontSize: 14.5, color: C.text }}>{t.title}</Text>
                        <Small>{t.year}{t.episodes ? ` · ${t.episodes} bölüm` : ''}</Small>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
        <Btn kind="secondary" label="Geri" onPress={() => setStep(1)} />
        <Btn style={{ flex: 1 }} label={editing ? 'Kaydet' : 'Evrenlerime git'} onPress={finish} />
      </View>
    </Screen>
  );
}

function Steps({ step }: { step: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 26 }} accessibilityLabel={`Adım ${step} / 2`}>
      {[1, 2].map((i) => <View key={i} style={{ flex: 1, height: 4, borderRadius: 4, backgroundColor: i <= step ? C.accent : C.line }} />)}
    </View>
  );
}
