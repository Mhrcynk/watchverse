import { Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Polygon, Rect, Stop } from 'react-native-svg';
import { C, F } from '@/lib/theme';

/** Uygulama simgesindeki W (scripts/make-icons.py ile aynı koordinatlar, 1000'lik kutu) */
const FRONT = ['200,220 330,220 445,780 315,780', '435,360 565,360 685,780 555,780'];
const BACK = ['315,780 445,780 565,360 435,360', '555,780 685,780 800,220 670,220'];

export function BrandMark({ size = 30, plate = true }: { size?: number; plate?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1000 1000" accessibilityLabel="WatchVerse">
      <Defs>
        <LinearGradient id="wvf" x1="0" y1="0.22" x2="0" y2="0.78">
          <Stop offset="0" stopColor="#F7CD62" />
          <Stop offset="1" stopColor="#ECB23A" />
        </LinearGradient>
        <LinearGradient id="wvb" x1="0" y1="0.22" x2="0" y2="0.78">
          <Stop offset="0" stopColor="#9C6C1E" />
          <Stop offset="1" stopColor="#7A5214" />
        </LinearGradient>
      </Defs>
      {plate && <Rect x="0" y="0" width="1000" height="1000" rx="230" fill="#1F222A" />}
      {BACK.map((p) => <Polygon key={p} points={p} fill="url(#wvb)" />)}
      {FRONT.map((p) => <Polygon key={p} points={p} fill="url(#wvf)" />)}
    </Svg>
  );
}

export function Brand() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
      <BrandMark size={30} />
      <Text style={{ fontFamily: F.bold, fontSize: 19, color: C.text, letterSpacing: -0.4 }}>
        Watch<Text style={{ color: C.accentSoft }}>Verse</Text>
      </Text>
    </View>
  );
}
