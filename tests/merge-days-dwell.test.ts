import { describe, expect, it } from 'vitest';
import { clockLabel, lastDaysWithNews, longDayLabel, numericDayLabel, shortDayLabel } from '../src/core/days';
import { COLLAPSED_WORDS, dwellMs, visibleWords } from '../src/core/dwell';
import { compareNewestFirst, mergeNews, shiftDate } from '../src/core/merge';
import { textLength, wordCount } from '../src/core/types';
import { item } from './helpers';

describe('shiftDate', () => {
  it('moves across month and year boundaries', () => {
    expect(shiftDate('2026-03-01', 1)).toBe('2026-02-28');
    expect(shiftDate('2027-01-03', 10)).toBe('2026-12-24');
    expect(shiftDate('2026-11-20', -2)).toBe('2026-11-22');
  });
});

describe('mergeNews', () => {
  const today = '2026-11-23';

  it('keeps dates the fresh fetch no longer covers', () => {
    const prev = [item({ date: '2026-11-20', time: '10:00' }), item({ date: '2026-11-19', time: '09:00' })];
    const fresh = [item({ date: '2026-11-23', time: '07:00' })];
    expect(mergeNews(prev, fresh, today).map((i) => i.id)).toEqual([
      'antenne:2026-11-23T07:00',
      'antenne:2026-11-20T10:00',
      'antenne:2026-11-19T09:00',
    ]);
  });

  it('replaces covered dates completely, so deleted or moved entries disappear', () => {
    const prev = [item({ date: '2026-11-20', time: '10:00', title: 'alt' }), item({ date: '2026-11-20', time: '11:00' })];
    const fresh = [item({ date: '2026-11-20', time: '10:00', title: 'neu' })];
    const merged = mergeNews(prev, fresh, today);
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe('neu');
  });

  it('drops items older than the retention window', () => {
    const prev = [item({ date: '2026-11-13' }), item({ date: '2026-11-14' })];
    expect(mergeNews(prev, [], today, 10).map((i) => i.date)).toEqual(['2026-11-14']);
  });

  it('sorts newest first', () => {
    const list = [item({ date: '2026-11-20', time: '08:00' }), item({ date: '2026-11-21', time: '07:00' }), item({ date: '2026-11-20', time: '09:00' })];
    expect(list.sort(compareNewestFirst).map((i) => `${i.date} ${i.time}`)).toEqual([
      '2026-11-21 07:00',
      '2026-11-20 09:00',
      '2026-11-20 08:00',
    ]);
  });
});

describe('days', () => {
  it('picks the last three dates that have news, skipping empty weekends', () => {
    const items = ['2026-11-16', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-20'].map((date) => ({ date }));
    expect(lastDaysWithNews(items, 3)).toEqual(['2026-11-20', '2026-11-19', '2026-11-18']);
    expect(lastDaysWithNews([], 3)).toEqual([]);
  });

  it('formats labels in German', () => {
    expect(longDayLabel('2026-11-20')).toBe('Freitag, 20. November');
    expect(shortDayLabel('2026-11-20')).toBe('Fr 20.');
    expect(shortDayLabel('2026-11-02')).toBe('Mo 2.');
    expect(numericDayLabel('2026-11-09')).toBe('09.11.');
  });

  it('shows clock times in Berlin time', () => {
    expect(clockLabel('2026-11-20T16:05:00Z')).toBe('17:05');
    expect(clockLabel('2026-07-20T16:05:00Z')).toBe('18:05');
  });
});

describe('dwell', () => {
  it('scales with text length within 2 to 8 seconds', () => {
    expect(dwellMs(0)).toBe(2000);
    expect(dwellMs(15)).toBe(2000);
    expect(dwellMs(60)).toBe(4000);
    expect(dwellMs(90)).toBe(6000);
    expect(dwellMs(500)).toBe(8000);
  });

  it('counts only the visible part of collapsed cards', () => {
    expect(visibleWords(5, 200, true)).toBe(5 + COLLAPSED_WORDS);
    expect(visibleWords(5, 200, false)).toBe(205);
    expect(visibleWords(5, 30, true)).toBe(35);
  });

  it('counts words and characters', () => {
    expect(wordCount('  eins zwei\n drei ')).toBe(3);
    expect(wordCount('')).toBe(0);
    expect(textLength({ paragraphs: ['abc', 'de'] })).toBe(6);
  });
});
