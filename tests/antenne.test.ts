import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ANTENNE_ORIGIN,
  berlinDate,
  findTickerUrl,
  parseAntenneTicker,
  parseDayHeading,
} from '../src/sources/antenne';

const html = readFileSync(new URL('./fixtures/antenne-ticker.html', import.meta.url), 'utf8');
const NOW = new Date('2026-11-21T10:00:00Z');
const URL_ = 'https://www.antennemuenster.de/artikel/der-antenne-muenster-newsticker-1';
const items = parseAntenneTicker(html, URL_, NOW);
const byTitle = (t: string) => items.find((i) => i.title.startsWith(t))!;

describe('findTickerUrl', () => {
  it('finds the ticker article link on the homepage', () => {
    const home = '<a href="/artikel/anderes-123">x</a><a href="/artikel/der-antenne-muenster-newsticker-618851">Ticker</a>';
    expect(findTickerUrl(home)).toBe(`${ANTENNE_ORIGIN}/artikel/der-antenne-muenster-newsticker-618851`);
  });
  it('returns null when there is no ticker link', () => {
    expect(findTickerUrl('<a href="/artikel/x-1">x</a>')).toBeNull();
  });
});

describe('parseDayHeading', () => {
  it('reads weekday headings', () => {
    expect(parseDayHeading('Freitag, 20. November', NOW)).toBe('2026-11-20');
    expect(parseDayHeading(' Montag, 2. März ', new Date('2026-03-05T12:00:00Z'))).toBe('2026-03-02');
  });
  it('puts December headings seen in January into the previous year', () => {
    expect(parseDayHeading('Mittwoch, 31. Dezember', new Date('2027-01-02T08:00:00Z'))).toBe('2026-12-31');
  });
  it('rejects headings that are not dates', () => {
    expect(parseDayHeading('Unsere Themen', NOW)).toBeNull();
    expect(parseDayHeading('40. Foo', NOW)).toBeNull();
  });
});

describe('berlinDate', () => {
  it('uses the calendar day in Berlin, not UTC', () => {
    expect(berlinDate(new Date('2026-11-20T23:30:00Z'))).toBe('2026-11-21');
    expect(berlinDate(new Date('2026-07-01T21:59:00Z'))).toBe('2026-07-01');
    expect(berlinDate(new Date('2026-07-01T22:01:00Z'))).toBe('2026-07-02');
  });
});

describe('parseAntenneTicker', () => {
  it('finds every timed entry and skips notes without a time', () => {
    expect(items.map((i) => `${i.date} ${i.time}`)).toEqual([
      '2026-11-20 17:01',
      '2026-11-20 16:40',
      '2026-11-20 15:02',
      '2026-11-20 14:38',
      '2026-11-20 12:00',
      '2026-11-20 09:05',
      '2026-11-19 18:15',
      '2026-11-19 18:15',
    ]);
    expect(items.some((i) => i.title.includes('Wochenende'))).toBe(false);
  });

  it('accepts colon, dot, dash or no separator after the time', () => {
    expect(byTitle('Früher Start').time).toBe('14:38');
    expect(byTitle('Eingeschränkte Fernwärme').time).toBe('12:00');
    expect(byTitle('Polizei sucht').time).toBe('09:05');
  });

  it('cleans whitespace and decodes entities in paragraphs', () => {
    expect(byTitle('Übung').paragraphs).toEqual([
      'Erster Absatz mit geschütztem Leerzeichen und "Zitat".',
      'Zweiter Absatz mit vielen Leerzeichen.',
    ]);
  });

  it('keeps bold sentence starts and inline times inside the body', () => {
    expect(byTitle('Polizei sucht').paragraphs).toEqual([
      'Die Polizei bittet um Hinweise nach einer Unfallflucht.',
      'Wichtig: Fett gesetzter Satzanfang mitten im Text bleibt Absatz.',
      'Ein Absatz mit 9:30 Uhr: keine Überschrift, weil er nicht fett beginnt.',
    ]);
  });

  it('treats an impossible time as body text', () => {
    expect(items[7].paragraphs).toEqual(['Text zwei.', '25:99 Uhr: Unmögliche Uhrzeit', 'Gehört noch zur zweiten Meldung.']);
  });

  it('attaches the following image block with credit and caption to the entry', () => {
    expect(byTitle('Neue Attraktion').image).toEqual({
      src: `${ANTENNE_ORIGIN}/externalimages/?source=jpg929/zoo.jpeg&resize=768x346`,
      credit: 'Zoo Test/Fotograf',
      caption: 'Bildunterschrift zur Erlebniswelt.',
    });
    expect(byTitle('Preußen').image).toBeUndefined();
  });

  it('falls back to src without srcset and keeps only the first image per entry', () => {
    expect(items[7].image).toEqual({ src: `${ANTENNE_ORIGIN}/externalimages/?source=jpg929/ohne-srcset.jpeg` });
  });

  it('gives same-minute entries distinct ids', () => {
    expect(items[6].id).toBe('antenne:2026-11-19T18:15');
    expect(items[7].id).toBe('antenne:2026-11-19T18:15-2');
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
  });

  it('fills source, url and a topic', () => {
    const p = byTitle('Preußen');
    expect(p.source).toBe('antenne');
    expect(p.url).toBe(URL_);
    expect(p.category).toBe('sport');
    expect(byTitle('Polizei sucht').category).toBe('polizei');
    expect(byTitle('Neue Attraktion').category).toBe('freizeit');
  });

  it('returns nothing for a page without the ticker structure', () => {
    expect(parseAntenneTicker('<html><body><p>Wartung</p></body></html>', URL_, NOW)).toEqual([]);
  });
});
