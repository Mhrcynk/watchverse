import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Row } from './rows';
import { Press } from './ui';
import { C, F } from '@/lib/theme';
import { img, type Person } from '@/lib/tmdb';

/** Yuvarlak kişi kartı: fotoğraf, ad, rol */
export function PersonChip({ p, sub, size = 76 }: { p: Pick<Person, 'id' | 'name' | 'p'>; sub?: string; size?: number }) {
  const uri = img(p.p, 'w185');
  return (
    <Press accessibilityRole="button" accessibilityLabel={[p.name, sub].filter(Boolean).join(', ')} onPress={() => router.push(`/person/${p.id}`)} scaleTo={0.95} style={{ width: size + 14, alignItems: 'center' }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }}>
        {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : <Feather name="user" size={size * 0.38} color={C.dim} />}
      </View>
      <Text numberOfLines={2} style={{ marginTop: 7, fontFamily: F.semibold, fontSize: 12.5, lineHeight: 16, color: C.text, textAlign: 'center' }}>{p.name}</Text>
      {!!sub && <Text numberOfLines={1} style={{ marginTop: 1, fontFamily: F.regular, fontSize: 11.5, color: C.muted, textAlign: 'center' }}>{sub}</Text>}
    </Press>
  );
}

/** Yapım sayfalarında "Oyuncular ve ekip" satırı */
export function CastRow({ cast, makers }: { cast: Person[]; makers: Person[] }) {
  if (!cast.length && !makers.length) return null;
  return (
    <Row title="Oyuncular ve ekip">
      {[...makers, ...cast].map((p, i) => <PersonChip key={`${p.id}-${i}`} p={p} sub={p.role} />)}
    </Row>
  );
}
