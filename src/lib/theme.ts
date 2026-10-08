// WatchVerse tasarım dili — web prototipindeki renklerin devamı.
export const C = {
  bg: '#0B0D12',
  card: '#151821',
  raised: '#1C202B',
  line: '#262B38',
  lineSoft: '#1E222D',
  text: '#F6F7FB',
  muted: '#A0A5B4',
  dim: '#6E7486',
  accent: '#7C5CFC',
  accentSoft: '#B5A0FF',
  green: '#62DCAC',
  amber: '#E8B65A',
  danger: '#F06A6A',
} as const;

export const F = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  heavy: 'Inter_800ExtraBold',
} as const;

export const R = { sm: 8, md: 12, lg: 16, xl: 22 } as const;

// Tablet eşiği ve içerik genişliği
export const TABLET = 768;
export const MAX_W = 1120;

/** Hex rengi saydamlıkla birleştirir: alpha('#7C5CFC', 0.2) */
export function alpha(hex: string, a: number) {
  const n = hex.replace('#', '');
  const v = Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0');
  return `#${n.slice(0, 6)}${v}`;
}
