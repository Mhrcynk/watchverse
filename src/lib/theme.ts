// WatchVerse tasarım dili: koyu arduvaz zemin, yumuşak kartlar, altın vurgular.
export const C = {
  bg: '#15171D',
  card: '#1F222A',
  raised: '#292D36',
  line: '#323642',
  lineSoft: '#252831',
  text: '#F4F5F8',
  muted: '#9CA1AC',
  dim: '#6F7581',
  accent: '#F2C14E',
  accentSoft: '#F6D27C',
  /** altın zemin üstündeki yazı */
  onAccent: '#1A1712',
  green: '#5FD3A2',
  amber: '#F2C14E',
  danger: '#FF7A7A',
} as const;

export const F = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  heavy: 'Inter_800ExtraBold',
} as const;

export const R = { sm: 12, md: 14, lg: 22, xl: 28 } as const;

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
