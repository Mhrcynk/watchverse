import { shareTextFile } from './backup-file';
import { Linking } from 'react-native';

/** Takvime eklenecek tüm gün etkinliği (bölüm yayın günü) */
export type CalEvent = { uid: string; title: string; date: string; note?: string };

const d8 = (ymd: string) => ymd.replace(/-/g, '');
const nextDay = (ymd: string) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

/** Google Takvim'de doldurulmuş "etkinlik ekle" sayfası */
export function googleUrl(e: CalEvent) {
  const q = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${d8(e.date)}/${d8(nextDay(e.date))}`, details: e.note || '' });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
export const openGoogle = (e: CalEvent) => Linking.openURL(googleUrl(e));

export function icsText(evs: CalEvent[]) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WatchVerse//TR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const e of evs) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}@watchverse`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d8(e.date)}`, `DTEND;VALUE=DATE:${d8(nextDay(e.date))}`,
      `SUMMARY:${esc(e.title)}`, ...(e.note ? [`DESCRIPTION:${esc(e.note)}`] : []), 'TRANSP:TRANSPARENT', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export const canIcs = true;
export const openIcs = (evs: CalEvent[], name = 'watchverse') => shareTextFile(icsText(evs), `${name}.ics`, 'text/calendar', 'public.calendar-event');
