export function duration(min: number) {
  if (!min) return 'Süre bilgisi yok';
  const h = Math.floor(min / 60), m = min % 60;
  if (h >= 10) return `${Math.round(min / 60)} saat`;
  return [h ? `${h} sa` : '', m ? `${m} dk` : ''].filter(Boolean).join(' ');
}
export const plural = (n: number, w: string) => `${n.toLocaleString('tr-TR')} ${w}`;
export function monthLabel(ts: number) {
  return new Date(ts).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}
