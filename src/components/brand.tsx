import { Text, View } from 'react-native';
import { C, F } from '@/lib/theme';

export function Brand() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
      <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: F.heavy, color: '#fff', fontSize: 17, marginTop: -2 }}>w</Text>
      </View>
      <Text style={{ fontFamily: F.bold, fontSize: 19, color: C.text, letterSpacing: -0.4 }}>
        Watch<Text style={{ color: C.accentSoft }}>Verse</Text>
      </Text>
    </View>
  );
}
