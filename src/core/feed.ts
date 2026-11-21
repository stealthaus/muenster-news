import { lastDaysWithNews } from './days';
import { compareNewestFirst } from './merge';
import type { Store } from './store';
import type { NewsItem } from './types';

export interface FeedDay {
  date: string;
  unread: NewsItem[];
  read: NewsItem[];
}

/**
 * Splits the last `days` dates with news into unread and read items, newest first. The days are chosen from all items,
 * so a day stays in the feed even when everything on it is read or filtered out. Hidden topics are left out entirely.
 */
export function buildFeed(items: NewsItem[], store: Store, days = 3): FeedDay[] {
  const dates = lastDaysWithNews(items, days);
  const hidden = new Set(store.hidden());
  return dates.map((date) => {
    const ofDay = items.filter((i) => i.date === date && !hidden.has(i.category)).sort(compareNewestFirst);
    return {
      date,
      unread: ofDay.filter((i) => !store.isRead(i)),
      read: ofDay.filter((i) => store.isRead(i)),
    };
  });
}

/** Items from the fetch that are unread and not part of the feed the reader is looking at. */
export function newSince(shownIds: Set<string>, feed: FeedDay[]): NewsItem[] {
  return feed.flatMap((d) => d.unread).filter((i) => !shownIds.has(i.id));
}
