import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { TYPE_TR, UBY, posterUrl } from '@/lib/catalog';
import { duration } from '@/lib/format';
import { fraction, isDone, universeProgress, nextUp, watchedEps } from '@/lib/progress';
import { useStore } from '@/lib/store';
import { C, F, R, alpha } from '@/lib/theme';
import type { State, Title, Universe } from '@/lib/types';
import { Bar, H3, Press, Small, tap, useToast } from './ui';

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

/** Afişi olmayan yapımlar için evren rengiyle üretilen tipografik kapak */
function Cover({ t, compact, brandOnly }: { t: Title; compact?: boolean; brandOnly?: boolean }) {
  const u = UBY[t.u];
  const h = hash(t.id);
  const ang = (h % 70) / 100;
  const initial = (t.title.replace(/^(the|a)\s+/i, '').trim()[0] || '?').toUpperCase();
  return (
    <LinearGradient colors={[alpha(u.color, 0.55), alpha(u.color, 0.12), C.card]} start={{ x: ang, y: 0 }} end={{ x: 1 - ang * 0.5, y: 1 }} style={StyleSheet.absoluteFill}>
      <Text style={{ position: 'absolute', right: -6, top: -10, fontFamily: F.heavy, fontSize: compact ? 56 : 120, color: 'rgba(255,255,255,0.08)', letterSpacing: -4 }}>{initial}</Text>
      {!compact && (
        <View style={{ position: 'absolute', left: 10, right: 10, bottom: 12 }}>
          <Text style={{ fontFamily: F.semibold, fontSize: 9.5, letterSpacing: 1.2, color: alpha(u.color, 0.95) }} numberOfLines={1}>{u.short}</Text>
          {!brandOnly && <Text style={{ fontFamily: F.bold, fontSize: 13.5, lineHeight: 16.5, color: C.text, marginTop: 4 }} numberOfLines={4}>{t.title}</Text>}
        </View>
      )}
    </LinearGradient>
  );
}

export const Art = memo(function Art({ t, style, compact, brandOnly, size = 'w342' }: { t: Title; style?: StyleProp<ViewStyle>; compact?: boolean; brandOnly?: boolean; size?: 'w185' | 'w342' | 'w500' }) {
  const url = posterUrl(t, size);
  return (
    <View style={[{ aspectRatio: 2 / 3, borderRadius: R.md, overflow: 'hidden', backgroundColor: C.card }, style]}>
      <Cover t={t} compact={compact} brandOnly={brandOnly} />
      {url && <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} cachePolicy="memory-disk" recyclingKey={t.id} accessibilityIgnoresInvertColors />}
    </View>
  );
});

/** Afiş kartı: ızgara ve yatay raylarda */
export const PosterCard = memo(function PosterCard({ t, width, showMeta = true }: { t: Title; width?: number; showMeta?: boolean }) {
  const { state } = useStore();
  const done = isDone(state, t);
  const f = fraction(state, t);
  const u = UBY[t.u];
  return (
    <Press accessibilityRole="button" accessibilityLabel={`${t.title}, ${t.year}${done ? ', izlendi' : ''}`} onPress={() => router.push(`/title/${t.id}`)} style={{ width }}>
      <View>
        <Art t={t} brandOnly={showMeta} style={done ? { opacity: 0.55 } : undefined} />
        {done && (
          <View style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name="check" size={14} color={C.bg} />
          </View>
        )}
        {!done && f > 0 && (
          <View style={{ position: 'absolute', left: 8, right: 8, bottom: 8 }}><Bar pct={f * 100} color={u.color} height={4} /></View>
        )}
      </View>
      {showMeta && (
        <>
          <Text numberOfLines={2} style={{ fontFamily: F.semibold, fontSize: 13.5, lineHeight: 18, color: C.text, marginTop: 9 }}>{t.title}</Text>
          <Small numberOfLines={1} style={{ marginTop: 2 }}>{t.year} · {TYPE_TR[t.type]}</Small>
        </>
      )}
    </Press>
  );
});

/** Evren adı — logo taklidi yerine evren renginde yazı */
export function Wordmark({ u, size = 12 }: { u: Universe; size?: number }) {
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: alpha(u.color, 0.16), borderWidth: StyleSheet.hairlineWidth, borderColor: alpha(u.color, 0.5) }}>
      <Text style={{ fontFamily: F.heavy, fontSize: size, letterSpacing: 1.2, color: u.color }}>{u.short}</Text>
    </View>
  );
}

export function UniverseCard({ u, state, style }: { u: Universe; state: State; style?: StyleProp<ViewStyle> }) {
  const p = universeProgress(state, u.id);
  const n = nextUp(state, u.id);
  const following = state.follow.includes(u.id);
  return (
    <Press accessibilityRole="button" accessibilityLabel={`${u.name}, yüzde ${p.pct}`} onPress={() => router.push(`/universe/${u.id}`)}
      style={[{ backgroundColor: C.card, borderRadius: R.lg, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: following ? alpha(u.color, 0.45) : C.line, overflow: 'hidden' }, style]}>
      <LinearGradient colors={[alpha(u.color, 0.16), 'transparent']} start={{ x: 1, y: 0 }} end={{ x: 0.3, y: 0.8 }} style={StyleSheet.absoluteFill} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Wordmark u={u} size={10.5} />
        <Small>{p.pct === 100 ? 'Tamamlandı' : following ? 'Takip ediliyor' : 'Keşfet'}</Small>
      </View>
      <H3 style={{ marginTop: 14 }} numberOfLines={1}>{u.name}</H3>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, marginBottom: 7 }}>
        <Small>{p.done} / {p.total} yapım</Small>
        <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.text }}>{p.pct}%</Text>
      </View>
      <Bar pct={p.pct} color={u.color} />
      <Small numberOfLines={1} style={{ marginTop: 10 }}>{n ? `Sıradaki: ${n.title} · ${n.year}` : 'Bu rotayı tamamladın.'}</Small>
    </Press>
  );
}

/** Liste satırı: afiş + bilgi + izlendi düğmesi */
export const TitleRow = memo(function TitleRow({ t, dim, showUniverse, index }: { t: Title; dim?: boolean; showUniverse?: boolean; index?: number }) {
  const { state, toggleWatched } = useStore();
  const toast = useToast();
  const done = isDone(state, t);
  const eps = watchedEps(state, t.id);
  const u = UBY[t.u];
  const status = done ? 'Tamamlandı' : t.episodes ? `${eps} / ${t.episodes} bölüm` : 'İzlenmedi';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, opacity: dim ? 0.5 : 1 }}>
      <Press accessibilityRole="button" accessibilityLabel={`${t.title} ayrıntıları`} onPress={() => router.push(`/title/${t.id}`)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Art t={t} compact size="w185" style={{ width: 48, borderRadius: 8 }} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={{ fontFamily: F.semibold, fontSize: 15, lineHeight: 20, color: C.text }}>
            {index != null && <Text style={{ color: C.dim, fontFamily: F.medium }}>{String(index).padStart(2, '0')}  </Text>}
            {t.title}
          </Text>
          <Small numberOfLines={1} style={{ marginTop: 2 }}>
            {t.year} · {TYPE_TR[t.type]} · {t.episodes ? `${t.episodes} bölüm` : duration(t.minutes)}{showUniverse ? ` · ${u.name}` : ''}
          </Small>
          <Small style={{ marginTop: 2, color: done ? C.green : t.episodes && eps ? C.accentSoft : C.dim }}>{status}{dim ? ' · Seçili modun dışında' : ''}</Small>
        </View>
      </Press>
      <Press accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={done ? `${t.title} izlendi işaretini kaldır` : `${t.title} izlendi olarak işaretle`}
        hitSlop={8}
        onPress={() => { const v = toggleWatched(t.id); tap(v ? 'success' : 'light'); toast(v ? 'İzlendi olarak kaydedildi' : 'İzleme işareti kaldırıldı'); }}
        style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? C.green : 'transparent', borderWidth: done ? 0 : 1.5, borderColor: C.line }}>
        <Feather name={done ? 'check' : 'plus'} size={18} color={done ? C.bg : C.muted} />
      </Press>
    </View>
  );
});
