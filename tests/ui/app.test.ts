import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dwellMs } from '../../src/core/dwell';
import { DAY_MS, Store } from '../../src/core/store';
import type { NewsFile, NewsItem } from '../../src/core/types';
import { App, GLOW_MS, LEAVE_MS, plural, standLabel } from '../../src/ui/app';
import { cardWords } from '../../src/ui/card';
import { CACHE_KEY } from '../../src/ui/data';
import { clock, item, MemoryKV } from '../helpers';
import { drag, FakeIO } from './fakes';

// Saturday, 21 Nov 2026, 10:00 in Münster
const NOW = Date.UTC(2026, 10, 21, 9);

const ITEMS: NewsItem[] = [
  item({ date: '2026-11-20', time: '17:00', title: 'Preußen gewinnen', category: 'sport' }),
  item({ date: '2026-11-20', time: '16:00', title: 'Rat tagt', category: 'stadt' }),
  item({ date: '2026-11-20', time: '15:00', title: 'Polizei sucht Zeugen', category: 'polizei' }),
  item({ date: '2026-11-19', time: '12:00', title: 'Baustelle am Ring', category: 'verkehr' }),
  item({ date: '2026-11-19', time: '08:00', title: 'Zoo öffnet', category: 'freizeit' }),
  item({ date: '2026-11-18', time: '09:00', title: 'Konzert im Dom', category: 'kultur' }),
  item({ date: '2026-11-16', time: '09:00', title: 'Zu alt für den Feed', category: 'stadt' }),
];

function newsFile(items = ITEMS): NewsFile {
  return {
    version: 1,
    generatedAt: '2026-11-20T16:06:00Z',
    sources: { antenne: { name: 'Antenne Münster', url: 'https://example.org/ticker', fetchedAt: '2026-11-20T16:05:00Z' } },
    items,
  };
}

const respond = (file: unknown) => vi.fn(async () => new Response(JSON.stringify(file), { status: 200 })) as unknown as typeof fetch & ReturnType<typeof vi.fn>;

async function mount(opts: { kv?: MemoryKV; fetch?: typeof fetch; now?: ReturnType<typeof clock>; prepare?: (s: Store) => void } = {}) {
  const kv = opts.kv ?? new MemoryKV();
  const now = opts.now ?? clock(NOW);
  const store = new Store(kv, now);
  opts.prepare?.(store);
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const app = new App({ root, store, kv, fetch: opts.fetch ?? respond(newsFile()), IO: FakeIO as never, now });
  await app.start();
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T & HTMLElement>(sel);
  const $$ = (sel: string) => [...root.querySelectorAll<HTMLElement>(sel)];
  const card = (title: string) => $$('.card').find((c) => c.querySelector('.card-title')?.textContent === title);
  const toast = () => document.querySelector<HTMLElement>('.toast')!;
  const counts = () => $$('.day-tab-count').map((e) => e.textContent);
  return { app, root, kv, now, store, $, $$, card, toast, counts };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  FakeIO.reset();
  window.scrollTo = vi.fn() as never;
});
afterEach(() => vi.useRealTimers());

describe('helpers', () => {
  it('formats the data age', () => {
    expect(standLabel('2026-11-21T08:30:00Z', NOW)).toBe('Stand 09:30');
    expect(standLabel('2026-11-20T16:05:00Z', NOW)).toBe('Stand Fr 20. 17:05');
  });
  it('builds German plurals', () => {
    expect(plural(1, 'Meldung', 'Meldungen')).toBe('1 Meldung');
    expect(plural(3, 'Meldung', 'Meldungen')).toBe('3 Meldungen');
  });
});

describe('feed', () => {
  it('shows the last three days with news, unread counts and the data age', async () => {
    const { $, $$, counts } = await mount();
    expect($('.stand')!.textContent).toBe('Stand Fr 20. 17:05');
    expect($$('.day-tab-label').map((e) => e.textContent)).toEqual(['Fr 20.', 'Do 19.', 'Mi 18.']);
    expect(counts()).toEqual(['3', '2', '1']);
    expect($$('.day-heading').map((e) => e.textContent)).toEqual(['Freitag, 20. November', 'Donnerstag, 19. November', 'Mittwoch, 18. November']);
    expect($$('.day')[0].querySelectorAll('.card-title')[0].textContent).toBe('Preußen gewinnen');
    expect($$('.card-title').some((e) => e.textContent === 'Zu alt für den Feed')).toBe(false);
    expect($('.nav-btn')!.textContent).toBe('Neu · 6');
    expect($$('.nav-btn')[1].textContent).toBe('Gemerkt · 0');
    expect($('.skyline')).not.toBeNull();
  });

  it('marks a card read after dwelling: border glows, card fades and stays', async () => {
    const m = await mount();
    const c = m.card('Rat tagt')!;
    FakeIO.set(c, 1);
    vi.advanceTimersByTime(dwellMs(cardWords(ITEMS[1], false)));
    expect(c.classList.contains('just-read')).toBe(true);
    expect(m.store.isRead(ITEMS[1])).toBe(true);
    expect(m.counts()).toEqual(['2', '2', '1']);
    vi.advanceTimersByTime(GLOW_MS);
    expect(c.classList.contains('just-read')).toBe(false);
    expect(c.classList.contains('is-read')).toBe(true);
    expect(c.isConnected).toBe(true);

    const again = await mount({ kv: m.kv });
    expect(again.card('Rat tagt')).toBeUndefined();
    expect(again.counts()).toEqual(['2', '2', '1']);
  });

  it('does not count a card that was only scrolled past', async () => {
    const m = await mount();
    const c = m.card('Rat tagt')!;
    FakeIO.set(c, 1);
    vi.advanceTimersByTime(1000);
    FakeIO.set(c, 0);
    vi.advanceTimersByTime(10_000);
    expect(m.store.isRead(ITEMS[1])).toBe(false);
  });

  it('swiping left marks read and removes the card, undo brings it back', async () => {
    const m = await mount();
    const c = m.card('Rat tagt')!;
    drag(c.querySelector('.card-surface')!, -200);
    expect(m.store.isRead(ITEMS[1])).toBe(true);
    expect(m.counts()).toEqual(['2', '2', '1']);
    vi.advanceTimersByTime(LEAVE_MS);
    expect(c.isConnected).toBe(false);
    expect(m.toast().textContent).toContain('Als gelesen markiert');

    m.toast().querySelector<HTMLButtonElement>('.toast-undo')!.click();
    expect(m.store.isRead(ITEMS[1])).toBe(false);
    const back = m.card('Rat tagt')!;
    expect(back).toBeDefined();
    expect(back.previousElementSibling?.querySelector('.card-title')?.textContent).toBe('Preußen gewinnen');
    expect(m.counts()).toEqual(['3', '2', '1']);
  });

  it('swiping right saves into the Merkfach', async () => {
    const m = await mount();
    drag(m.card('Preußen gewinnen')!.querySelector('.card-surface')!, 200);
    expect(m.store.isSaved(ITEMS[0].id)).toBe(true);
    expect(m.$$('.nav-btn')[1].textContent).toBe('Gemerkt · 1');
    expect(m.toast().textContent).toContain('Gemerkt');
    vi.advanceTimersByTime(LEAVE_MS);
    expect(m.card('Preußen gewinnen')).toBeUndefined();
  });

  it('marks a whole day read and can undo it', async () => {
    const m = await mount();
    m.$('.daybar .icon-btn')!.click();
    vi.advanceTimersByTime(LEAVE_MS);
    expect(m.$$('.day')[0].querySelectorAll('.card')).toHaveLength(0);
    expect(m.counts()).toEqual(['0', '2', '1']);
    expect(m.toast().textContent).toContain('3 Meldungen als gelesen markiert');
    m.toast().querySelector<HTMLButtonElement>('.toast-undo')!.click();
    expect(m.$$('.day')[0].querySelectorAll('.card')).toHaveLength(3);
    expect(m.counts()).toEqual(['3', '2', '1']);
  });

  it('says so when the day is read already', async () => {
    const m = await mount({ prepare: (s) => s.markAllRead(ITEMS.slice(0, 3)) });
    m.$('.daybar .icon-btn')!.click();
    expect(m.toast().textContent).toContain('Freitag: schon alles gelesen');
  });

  it('offers read items at the end and lets you save them', async () => {
    const m = await mount({ prepare: (s) => s.markRead(ITEMS[3]) });
    expect(m.card('Baustelle am Ring')).toBeUndefined();
    const btn = m.$$('.feed-end .btn').find((b) => b.textContent === 'Bereits gelesene Meldungen anzeigen')!;
    btn.click();
    const read = m.$('.read-feed .card')!;
    expect(read.querySelector('.card-title')!.textContent).toBe('Baustelle am Ring');
    expect(read.classList.contains('is-read')).toBe(true);
    expect(m.$('.feed-end .btn')).toBeNull();
    drag(read.querySelector('.card-surface')!, 200);
    expect(m.store.isSaved(ITEMS[3].id)).toBe(true);
  });

  it('shows an empty state when everything is read', async () => {
    const m = await mount({ prepare: (s) => s.markAllRead(ITEMS) });
    expect(m.$('.feed-end .empty-title')!.textContent).toBe('Alles gelesen');
    expect(m.$$('.feed-end .btn')).toHaveLength(1);
  });

  it('brings back read items with a lot of new text as updated', async () => {
    const kv = new MemoryKV();
    const first = await mount({ kv });
    first.store.markRead(ITEMS[1]);
    const grown = { ...ITEMS[1], paragraphs: ['Ein kurzer Text.', 'Neu: '.repeat(40)] };
    const m = await mount({ kv, fetch: respond(newsFile([ITEMS[0], grown, ...ITEMS.slice(2)])) });
    const c = m.card('Rat tagt')!;
    expect(c.querySelector('.badge-updated')!.textContent).toBe('aktualisiert');
    expect(c.classList.contains('is-read')).toBe(false);
  });

  it('filters topics through the sheet', async () => {
    const m = await mount();
    m.$$('.daybar .icon-btn')[1].click();
    const sheet = m.$('.sheet')!;
    expect(sheet.hidden).toBe(false);
    const sport = sheet.querySelector<HTMLButtonElement>('.chip[data-category="sport"]')!;
    expect(sport.querySelector('.chip-count')!.textContent).toBe('1');
    sport.click();
    expect(sport.getAttribute('aria-pressed')).toBe('false');
    sheet.querySelector<HTMLButtonElement>('.btn-primary')!.click();
    expect(sheet.hidden).toBe(true);
    expect(m.card('Preußen gewinnen')).toBeUndefined();
    expect(m.counts()).toEqual(['2', '2', '1']);
    expect(m.store.hidden()).toEqual(['sport']);
  });

  it('offers news that arrived while the app was open', async () => {
    const extra = item({ date: '2026-11-21', time: '09:30', title: 'Ganz frisch' });
    const fetchFn = respond(newsFile());
    const m = await mount({ fetch: fetchFn });
    fetchFn.mockImplementation(async () => new Response(JSON.stringify(newsFile([extra, ...ITEMS]))));
    await m.app.load(false);
    const pill = m.$<HTMLButtonElement>('.new-pill')!;
    expect(pill.hidden).toBe(false);
    expect(pill.textContent).toBe('1 neue Meldung');
    expect(m.card('Ganz frisch')).toBeUndefined();
    pill.click();
    expect(pill.hidden).toBe(true);
    expect(m.card('Ganz frisch')).toBeDefined();
    expect(m.$$('.day-tab-label').map((e) => e.textContent)).toEqual(['Sa 21.', 'Fr 20.', 'Do 19.']);
  });

  it('shows the stored copy with an offline note when the network fails', async () => {
    const kv = new MemoryKV();
    kv.setItem(CACHE_KEY, JSON.stringify(newsFile()));
    const failing = vi.fn(async () => {
      throw new TypeError('offline');
    }) as unknown as typeof fetch;
    const m = await mount({ kv, fetch: failing });
    expect(m.$('.stand')!.textContent).toBe('Offline · Stand Fr 20. 17:05');
    expect(m.$$('.card')).toHaveLength(6);
  });

  it('explains when nothing could be loaded and retries', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('offline');
    }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
    const m = await mount({ fetch: fetchFn });
    expect(m.$('.empty-title')!.textContent).toBe('Noch keine Meldungen geladen');
    fetchFn.mockImplementation(async () => new Response(JSON.stringify(newsFile())));
    m.$<HTMLButtonElement>('.feed .btn')!.click();
    await vi.waitFor(() => expect(m.$$('.card')).toHaveLength(6));
  });
});

describe('Merkfach', () => {
  async function withSaved() {
    const m = await mount({ prepare: (s) => s.save(ITEMS[0]) });
    m.$$('.nav-btn')[1].click();
    return m;
  }

  it('lists saved items with time left and switches views', async () => {
    const m = await withSaved();
    expect(m.$('.view-saved')!.hidden).toBe(false);
    expect(m.$('.view-feed')!.hidden).toBe(true);
    expect(m.$('.saved-title')!.textContent).toBe('Preußen gewinnen');
    expect(m.$('.saved-row .card-label')!.textContent).toBe('SPORT · 20.11. · 17:00');
    expect(m.$('.saved-status')!.textContent).toBe('noch 14 Tage');
    m.$$('.nav-btn')[0].click();
    expect(m.$('.view-feed')!.hidden).toBe(false);
  });

  it('opens the full text with a link to the source', async () => {
    const m = await withSaved();
    const detail = m.$('.saved-detail')!;
    expect(detail.hidden).toBe(true);
    m.$('.saved-main')!.click();
    expect(detail.hidden).toBe(false);
    expect(detail.textContent).toContain('Ein kurzer Text.');
    const link = detail.querySelector('a')!;
    expect(link.getAttribute('href')).toBe('https://example.org/ticker');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('pins with the lock and unpins again', async () => {
    const m = await withSaved();
    m.$('.saved-lock')!.click();
    expect(m.store.savedList()[0].pinned).toBe(true);
    expect(m.$('.saved-status')!.textContent).toBe('festgepinnt');
    expect(m.$('.saved-lock')!.getAttribute('aria-pressed')).toBe('true');
    m.$('.saved-lock')!.click();
    expect(m.store.savedList()[0].pinned).toBe(false);
  });

  it('deletes with undo', async () => {
    const m = await withSaved();
    m.$('.saved-delete')!.click();
    expect(m.$('.saved-row')).toBeNull();
    expect(m.$('.view-saved .empty-title')!.textContent).toBe('Noch nichts gemerkt');
    expect(m.$$('.nav-btn')[1].textContent).toBe('Gemerkt · 0');
    m.toast().querySelector<HTMLButtonElement>('.toast-undo')!.click();
    expect(m.$('.saved-title')!.textContent).toBe('Preußen gewinnen');
  });

  it('highlights items that are about to expire and drops expired ones', async () => {
    const kv = new MemoryKV();
    const now = clock(NOW);
    await mount({ kv, now, prepare: (s) => s.save(ITEMS[0]) });
    now.advance(13 * DAY_MS);
    const m = await mount({ kv, now });
    m.$$('.nav-btn')[1].click();
    expect(m.$('.saved-status')!.textContent).toBe('noch 1 Tag');
    expect(m.$('.saved-status')!.classList.contains('is-soon')).toBe(true);
    now.advance(DAY_MS);
    const later = await mount({ kv, now });
    expect(later.store.savedCount()).toBe(0);
  });

  it('pauses reading by dwell while the Merkfach is open', async () => {
    const m = await withSaved();
    const c = m.card('Rat tagt')!;
    FakeIO.set(c, 1);
    vi.advanceTimersByTime(10_000);
    expect(m.store.isRead(ITEMS[1])).toBe(false);
  });
});
