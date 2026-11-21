import { parse, type HTMLElement } from 'node-html-parser';
import { categorize } from '../core/categorize';
import { berlinDate } from '../core/days';
import type { NewsImage, NewsItem } from '../core/types';

export { berlinDate };

export const ANTENNE_ORIGIN = 'https://www.antennemuenster.de';
export const ANTENNE_FALLBACK_TICKER = `${ANTENNE_ORIGIN}/artikel/der-antenne-muenster-newsticker-618851`;

const MONTHS: Record<string, number> = {
  januar: 1, februar: 2, märz: 3, april: 4, mai: 5, juni: 6,
  juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12,
};

/** "17:01 Uhr: Titel", also "12:00 Uhr Titel", "14:38 Uhr. Titel" and "9.15 Uhr - Titel". */
const HEADLINE = /^(\d{1,2})[:.](\d{2})\s*Uhr\b\s*[:.,\-–—]?\s*(.+)$/su;

/** Finds the current ticker article on the homepage. */
export function findTickerUrl(homeHtml: string): string | null {
  const m = homeHtml.match(/href="(\/artikel\/der-antenne-muenster-newsticker-\d+)"/);
  return m ? ANTENNE_ORIGIN + m[1] : null;
}

/** "Freitag, 20. November" → YYYY-MM-DD. The year comes from `now`; dates after `now` belong to the previous year. */
export function parseDayHeading(text: string, now: Date): string | null {
  const m = text.trim().match(/(\d{1,2})\.\s*([A-Za-zÄÖÜäöü]+)/u);
  if (!m) return null;
  const day = Number(m[1]);
  const month = MONTHS[m[2].toLowerCase()];
  if (!month || day < 1 || day > 31) return null;
  const today = berlinDate(now);
  let year = Number(today.slice(0, 4));
  if (iso(year, month, day) > today) year -= 1;
  return iso(year, month, day);
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function clean(text: string): string {
  return text.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

/** Picks a phone-sized variant from srcset, otherwise the plain src. */
function imageSrc(img: HTMLElement): string | null {
  const srcset = img.getAttribute('srcset') ?? '';
  const candidates = srcset
    .split(',')
    .map((part) => part.trim().split(/\s+/))
    .filter((p) => p.length === 2 && /^\d+w$/.test(p[1]))
    .map(([url, w]) => ({ url, w: parseInt(w, 10) }))
    .sort((a, b) => a.w - b.w);
  const pick = candidates.find((c) => c.w >= 768) ?? candidates[candidates.length - 1];
  const raw = pick?.url ?? img.getAttribute('src');
  if (!raw) return null;
  return new URL(raw.replace(/&amp;/g, '&'), ANTENNE_ORIGIN).toString();
}

function parseImage(block: HTMLElement): NewsImage | null {
  const img = block.querySelector('img');
  if (!img) return null;
  const src = imageSrc(img);
  if (!src) return null;
  const image: NewsImage = { src };
  const creditEl = block.querySelector('.line-clamp-5 span');
  const credit = creditEl ? clean(creditEl.text) : '';
  if (credit) image.credit = credit;
  const captionEl = block.querySelector('div.p-2.px-4');
  const caption = captionEl ? clean(captionEl.text) : '';
  if (caption) image.caption = caption;
  return image;
}

/** A paragraph opens a new entry when it starts with bold text that reads like "HH:MM Uhr: Titel". */
function headline(p: HTMLElement): { time: string; title: string } | null {
  const first = p.childNodes.find((n) => n.nodeType !== 3 || n.text.trim() !== '') as HTMLElement | undefined;
  if (!first || first.nodeType !== 1 || !['strong', 'b'].includes(first.tagName?.toLowerCase())) return null;
  const m = clean(p.text).match(HEADLINE);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return { time: `${String(h).padStart(2, '0')}:${m[2]}`, title: m[3].trim() };
}

interface Draft {
  date: string;
  time: string;
  title: string;
  paragraphs: string[];
  image?: NewsImage;
}

/** Parses the ticker article into entries, newest first as on the page. Notes without a time are skipped. */
export function parseAntenneTicker(html: string, url: string, now: Date): NewsItem[] {
  const root = parse(html);
  const blocks = root.querySelectorAll('app-article-headline2lvl, app-article-paragraph, app-article-image');
  const drafts: Draft[] = [];
  let date: string | null = null;
  let current: Draft | null = null;

  for (const block of blocks) {
    const tag = block.tagName.toLowerCase();
    if (tag === 'app-article-headline2lvl') {
      date = parseDayHeading(block.text, now);
      current = null;
    } else if (tag === 'app-article-paragraph') {
      if (!date) continue;
      for (const p of block.querySelectorAll('p')) {
        const head = headline(p);
        if (head) {
          current = { date, ...head, paragraphs: [] };
          drafts.push(current);
          continue;
        }
        const text = clean(p.text);
        if (current && text) current.paragraphs.push(text);
      }
    } else if (tag === 'app-article-image') {
      if (current && !current.image) {
        const image = parseImage(block);
        if (image) current.image = image;
      }
    }
  }

  const seen = new Map<string, number>();
  return drafts.map((d) => {
    const base = `antenne:${d.date}T${d.time}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const item: NewsItem = {
      id: n === 1 ? base : `${base}-${n}`,
      source: 'antenne',
      date: d.date,
      time: d.time,
      title: d.title,
      paragraphs: d.paragraphs,
      category: categorize(d.title, d.paragraphs.join(' ')),
      url,
    };
    if (d.image) item.image = d.image;
    return item;
  });
}
