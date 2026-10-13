// WatchVerse tasarım dili — web prototipindeki renklerin devamı.
export const C = {
  bg: '#000000',
  card: '#121215',
  raised: '#1B1B20',
  line: '#2A2A31',
  lineSoft: '#1C1C22',
  text: '#F5F5F7',
  muted: '#A9A9B2',
  dim: '#80808A',
  accent: '#E3262F',
  accentSoft: '#FF5D65',
  green: '#4FD6A0',
  amber: '#F2B84B',
  danger: '#FF6B6B',
} as const;

export const F = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  heavy: 'Inter_800ExtraBold',
} as const;

export const R = { sm: 8, md: 12, lg: 16, xl: 22 } as const;

/** Hareket süreleri (ms): dokunma tepkisi, küçük geçiş, giriş, liste aralığı */
export const M = { press: 110, fast: 180, base: 260, enter: 340, stagger: 45 } as const;

// Tablet eşiği ve içerik genişliği
export const TABLET = 768;
export const MAX_W = 1120;

/** Hex rengi saydamlıkla birleştirir: alpha('#7C5CFC', 0.2) */
export function alpha(hex: string, a: number) {
  const n = hex.replace('#', '');
  const v = Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0');
  return `#${n.slice(0, 6)}${v}`;
}
