import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { useAccount } from '@/lib/account';
import { isDropped } from '@/lib/library';
import { useStore } from '@/lib/store';
import { siteUrl } from '@/lib/supabase';
import { C, F, R, alpha } from '@/lib/theme';
import { shareLink } from './share';
import { Press, tap, useToast } from './ui';

type IconName = React.ComponentProps<typeof Feather>['name'];

function Pill({ icon, label, onPress, tint, a11y }: { icon: IconName; label: string; onPress: () => void; tint?: string; a11y?: string }) {
  return (
    <Press accessibilityRole="button" accessibilityLabel={a11y || label} onPress={onPress} scaleTo={0.95} hitSlop={4}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 7, height: 36, paddingHorizontal: 13, borderRadius: 99, backgroundColor: alpha(tint || '#FFFFFF', tint ? 0.14 : 0.07) }}>
      <Feather name={icon} size={15} color={tint || C.text} />
      <Text style={{ fontFamily: F.semibold, fontSize: 13, color: tint || C.text }}>{label}</Text>
    </Press>
  );
}

/**
 * Yapım sayfalarındaki ek işlemler: paylaş, tekrar izledim (film), bıraktım (dizi).
 * k: katalog kimliği ya da 'movie:123' anahtarı; path: paylaşılacak sayfa (title/… ya da show/…)
 */
export function TitleExtras({ k, title, path, movie, done, started }: { k: string; title: string; path: string; movie: boolean; done: boolean; started: boolean }) {
  const store = useStore();
  const toast = useToast();
  const s = store.state;
  const times = 1 + (s.rewatch?.[k] || 0);
  const dropped = isDropped(s, k);
  const share = () => {
    const ref = s.name.trim() ? `?ref=${encodeURIComponent(s.name.trim().slice(0, 30))}` : '';
    shareLink(`${siteUrl()}${path}${ref}`, title, toast, s.name.trim() ? `${s.name.trim()} sana önerdi: ${title}` : `Bunu izlemelisin: ${title}`);
  };
  return (
    <View style={{ marginTop: 12, gap: 10 }}>
      {dropped && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: R.md, backgroundColor: alpha(C.amber, 0.1) }}>
          <Feather name="pause-circle" size={18} color={C.amber} />
          <Text style={{ flex: 1, fontFamily: F.medium, fontSize: 13.5, color: C.text }}>Bu diziyi yarıda bıraktın.</Text>
          <Pill icon="play" label="Devam ediyorum" tint={C.amber} onPress={() => { store.setDropped(k, false); tap('success'); toast('Yeniden izliyorum olarak işaretlendi'); }} />
        </View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Pill icon="share-2" label="Paylaş" a11y={`${title} yapımını paylaş`} onPress={share} />
        {movie && done && <Pill icon="rotate-cw" label="Tekrar izledim" onPress={() => { store.rewatch(k, 1); tap('success'); toast(`${times + 1}. kez izledin`); }} />}
        {movie && done && times > 1 && <Pill icon="minus" label={`${times} kez izledin`} a11y={`${times} kez izledin; bir azalt`} onPress={() => store.rewatch(k, -1)} />}
        {!movie && !done && !dropped && started && <Pill icon="pause" label="Bıraktım" onPress={() => { store.setDropped(k, true); tap(); toast('Bıraktıkların arasına taşındı'); }} />}
      </View>
    </View>
  );
}

/** Paylaşılan bağlantıyla gelene: kimin önerdiği ve (üye değilse) uygulamaya başlama düğmesi */
export function RecommendBanner() {
  const { ref } = useLocalSearchParams<{ ref?: string }>();
  const acc = useAccount();
  const member = !!acc.user || acc.guest;
  if (!ref && member) return null;
  const who = typeof ref === 'string' ? ref.slice(0, 30) : '';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 14, borderRadius: R.lg, backgroundColor: alpha(C.accent, 0.12) }}>
      <Feather name="gift" size={20} color={C.accent} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.semibold, fontSize: 14.5, color: C.text }}>{who ? `${who} sana bunu önerdi` : 'Sana bir öneri var'}</Text>
        {!member && <Text style={{ marginTop: 2, fontFamily: F.regular, fontSize: 13, color: C.muted }}>WatchVerse ile kaydet, izlediklerini takip et. Ücretsiz.</Text>}
      </View>
      {!member && (
        <Press accessibilityRole="button" accessibilityLabel="WatchVerse'e başla" onPress={() => router.push('/welcome')} scaleTo={0.95}
          style={{ paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.onAccent }}>Başla</Text>
        </Press>
      )}
    </View>
  );
}
