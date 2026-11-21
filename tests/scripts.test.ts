import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadPrevious, run } from '../scripts/fetch-news';
import { berlinOffsetMinutes, localSlots, shouldRun, SUMMER_CRONS, WINTER_CRONS } from '../scripts/schedule-gate';
import type { NewsFile } from '../src/core/types';
import { ANTENNE_FALLBACK_TICKER } from '../src/sources/antenne';
import { item } from './helpers';

const ticker = readFileSync(new URL('./fixtures/antenne-ticker.html', import.meta.url), 'utf8');
const NOW = new Date('2026-11-21T10:00:00Z');
const HOME = 'https://www.antennemuenster.de/';
const TICKER = 'https://www.antennemuenster.de/artikel/der-antenne-muenster-newsticker-999';
const PREV = 'https://example.github.io/muenster-news/data/news.json';

type Routes = Record<string, () => Response>;

function fakeFetch(routes: Routes) {
  const calls: string[] = [];
  const fn = async (url: string) => {
    calls.push(url);
    const route = routes[url];
    if (!route) return new Response('nope', { status: 404 });
    return route();
  };
  return Object.assign(fn, { calls });
}

const html = (body: string) => () => new Response(body, { status: 200 });
const json = (data: unknown) => () => new Response(JSON.stringify(data), { status: 200 });

function previousFile(items = [item({ date: '2026-11-17', time: '08:00' })]): NewsFile {
  return {
    version: 1,
    generatedAt: '2026-11-20T09:00:00Z',
    sources: { antenne: { name: 'Antenne Münster', url: TICKER, fetchedAt: '2026-11-20T09:00:00Z' } },
    items,
  };
}

describe('fetch-news run', () => {
  it('follows the homepage link, parses and merges with the previous file', async () => {
    const f = fakeFetch({
      [PREV]: json(previousFile()),
      [HOME]: html(`<a href="/artikel/der-antenne-muenster-newsticker-999">Ticker</a>`),
      [TICKER]: html(ticker),
    });
    const { file, errors } = await run(f, NOW, PREV);
    expect(errors).toEqual([]);
    expect(file.items).toHaveLength(9);
    expect(file.items.at(-1)!.date).toBe('2026-11-17');
    expect(file.sources.antenne).toEqual({ name: 'Antenne Münster', url: TICKER, fetchedAt: NOW.toISOString() });
    expect(file.generatedAt).toBe(NOW.toISOString());
  });

  it('uses the last known ticker when the homepage fails', async () => {
    const f = fakeFetch({ [PREV]: json(previousFile()), [TICKER]: html(ticker) });
    const { file, errors } = await run(f, NOW, PREV);
    expect(errors).toEqual([]);
    expect(f.calls).toContain(TICKER);
    expect(file.items.length).toBeGreaterThan(1);
  });

  it('falls back to the built-in ticker url without any history', async () => {
    const f = fakeFetch({ [ANTENNE_FALLBACK_TICKER]: html(ticker) });
    const { file } = await run(f, NOW);
    expect(file.items).toHaveLength(8);
    expect(file.sources.antenne?.url).toBe(ANTENNE_FALLBACK_TICKER);
  });

  it('keeps previous items and reports an error when the source breaks', async () => {
    const prev = previousFile();
    const f = fakeFetch({ [PREV]: json(prev), [HOME]: html('<p>kein Link</p>'), [ANTENNE_FALLBACK_TICKER]: html('<p>Wartung</p>') });
    const { file, errors } = await run(f, NOW, PREV);
    expect(errors).toHaveLength(1);
    expect(file.items).toEqual(prev.items);
    expect(file.sources.antenne?.fetchedAt).toBe(prev.sources.antenne?.fetchedAt);
  });
});

describe('loadPrevious', () => {
  it('ignores missing, broken or foreign files', async () => {
    expect(await loadPrevious(fakeFetch({}), PREV)).toBeNull();
    expect(await loadPrevious(fakeFetch({ [PREV]: html('{kaputt') }), PREV)).toBeNull();
    expect(await loadPrevious(fakeFetch({ [PREV]: json({ version: 2, items: [] }) }), PREV)).toBeNull();
    expect(await loadPrevious(fakeFetch({}), undefined)).toBeNull();
  });
});

describe('schedule gate', () => {
  const expected = ['06:30', '07:15', '08:00', '08:45', '09:30', '10:15', '11:00', '11:45', '12:30', '13:15', '14:00', '14:45', '15:30', '16:15', '17:00', '17:45', '18:30'];

  it('produces every 45 minutes from 6:30 to 19:00 local time in winter and summer', () => {
    expect(localSlots(WINTER_CRONS, 60)).toEqual(expected);
    expect(localSlots(SUMMER_CRONS, 120)).toEqual(expected);
  });

  it('knows the Berlin offset', () => {
    expect(berlinOffsetMinutes(new Date('2026-01-15T12:00:00Z'))).toBe(60);
    expect(berlinOffsetMinutes(new Date('2026-07-15T12:00:00Z'))).toBe(120);
  });

  it('lets only the matching set of crons through', () => {
    const winter = new Date('2026-11-23T08:00:00Z');
    const summer = new Date('2026-06-22T08:00:00Z');
    expect(shouldRun('schedule', WINTER_CRONS[0], winter)).toBe(true);
    expect(shouldRun('schedule', SUMMER_CRONS[0], winter)).toBe(false);
    expect(shouldRun('schedule', SUMMER_CRONS[2], summer)).toBe(true);
    expect(shouldRun('schedule', WINTER_CRONS[2], summer)).toBe(false);
  });

  it('always runs for pushes and manual starts', () => {
    expect(shouldRun('push', '', NOW)).toBe(true);
    expect(shouldRun('workflow_dispatch', '', NOW)).toBe(true);
  });

  it('matches the crons in the workflow file', () => {
    const yml = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
    const crons = [...yml.matchAll(/cron:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(crons.sort()).toEqual([...WINTER_CRONS, ...SUMMER_CRONS].sort());
  });
});
