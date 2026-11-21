import type { KeyValue } from '../src/core/store';
import type { NewsItem } from '../src/core/types';

export function item(partial: Partial<NewsItem> & { date?: string; time?: string } = {}): NewsItem {
  const date = partial.date ?? '2026-11-20';
  const time = partial.time ?? '12:00';
  return {
    id: partial.id ?? `antenne:${date}T${time}`,
    source: 'antenne',
    date,
    time,
    title: partial.title ?? `Meldung ${date} ${time}`,
    paragraphs: partial.paragraphs ?? ['Ein kurzer Text.'],
    category: partial.category ?? 'stadt',
    url: partial.url ?? 'https://example.org/ticker',
    ...(partial.image ? { image: partial.image } : {}),
  };
}

export class MemoryKV implements KeyValue {
  data = new Map<string, string>();
  failWrites = false;
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.data.set(key, value);
  }
}

export function clock(start: number) {
  let t = start;
  const now = () => t;
  now.advance = (ms: number) => {
    t += ms;
  };
  now.set = (ms: number) => {
    t = ms;
  };
  return now;
}
