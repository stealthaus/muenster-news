import type { NewsItem } from './types';

/** The `n` most recent dates that have at least one item, newest first. */
export function lastDaysWithNews(items: Pick<NewsItem, 'date'>[], n = 3): string[] {
  return [...new Set(items.map((i) => i.date))].sort().reverse().slice(0, n);
}

function utc(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

/** "Freitag, 20. November" */
export function longDayLabel(date: string): string {
  return new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(utc(date));
}

/** "Fr 20." */
export function shortDayLabel(date: string): string {
  const d = utc(date);
  const wd = new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', weekday: 'short' }).format(d).replace('.', '');
  return `${wd} ${d.getUTCDate()}.`;
}

/** "20.11." */
export function numericDayLabel(date: string): string {
  const [, m, d] = date.split('-');
  return `${d}.${m}.`;
}

/** "17:05" in Europe/Berlin for an ISO timestamp. */
export function clockLabel(isoTime: string): string {
  return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(new Date(isoTime));
}

/** Calendar date in Europe/Berlin for an instant. */
export function berlinDate(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
