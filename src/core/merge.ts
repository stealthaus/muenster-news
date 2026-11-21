import type { NewsItem } from './types';

export function compareNewestFirst(a: NewsItem, b: NewsItem): number {
  return b.date.localeCompare(a.date) || b.time.localeCompare(a.time) || a.id.localeCompare(b.id);
}

/** YYYY-MM-DD minus `days`, computed on the calendar (no time zones involved). */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - days));
  return t.toISOString().slice(0, 10);
}

/**
 * Combines the last published items with a fresh fetch. For every source and date the fresh fetch covers, the fresh
 * items replace the old ones (so deletions and time corrections carry over). Dates the fresh fetch no longer covers
 * are kept, which protects against the source page being cleared. Items older than `keepDays` before `today` are dropped.
 */
export function mergeNews(previous: NewsItem[], fresh: NewsItem[], today: string, keepDays = 10): NewsItem[] {
  const covered = new Set(fresh.map((i) => `${i.source}|${i.date}`));
  const cutoff = shiftDate(today, keepDays);
  const byId = new Map<string, NewsItem>();
  for (const item of previous) {
    if (!covered.has(`${item.source}|${item.date}`)) byId.set(item.id, item);
  }
  for (const item of fresh) byId.set(item.id, item);
  return [...byId.values()].filter((i) => i.date > cutoff).sort(compareNewestFirst);
}
