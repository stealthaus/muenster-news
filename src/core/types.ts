export type SourceId = 'antenne';

export const CATEGORIES = ['verkehr', 'polizei', 'sport', 'stadt', 'freizeit', 'kultur', 'wetter', 'sonstiges'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  verkehr: 'Verkehr',
  polizei: 'Polizei',
  sport: 'Sport',
  stadt: 'Stadt',
  freizeit: 'Freizeit',
  kultur: 'Kultur',
  wetter: 'Wetter',
  sonstiges: 'Sonstiges',
};

export interface NewsImage {
  src: string;
  caption?: string;
  credit?: string;
}

export interface NewsItem {
  /** Stable across text edits: source + date + time (+ suffix for same-minute entries). */
  id: string;
  source: SourceId;
  /** Local date in Europe/Berlin, YYYY-MM-DD. */
  date: string;
  /** Local time, HH:MM. */
  time: string;
  title: string;
  paragraphs: string[];
  image?: NewsImage;
  category: Category;
  url: string;
}

export interface SourceInfo {
  name: string;
  url: string;
  fetchedAt: string;
}

export interface NewsFile {
  version: 1;
  generatedAt: string;
  sources: Partial<Record<SourceId, SourceInfo>>;
  items: NewsItem[];
}

export const SOURCE_NAMES: Record<SourceId, string> = {
  antenne: 'Antenne Münster',
};

/** Character count used to detect substantial edits. */
export function textLength(item: Pick<NewsItem, 'paragraphs'>): number {
  return item.paragraphs.join(' ').length;
}

export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}
