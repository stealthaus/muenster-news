import { describe, expect, it } from 'vitest';
import { buildFeed, newSince } from '../src/core/feed';
import { DAY_MS, sanitize, SAVE_DAYS, STORAGE_KEY, Store } from '../src/core/store';
import { clock, item, MemoryKV } from './helpers';

const T0 = Date.UTC(2026, 10, 21, 9);

function setup() {
  const kv = new MemoryKV();
  const now = clock(T0);
  return { kv, now, store: new Store(kv, now) };
}

describe('read state', () => {
  it('marks items read and persists', () => {
    const { kv, now, store } = setup();
    const a = item();
    expect(store.isRead(a)).toBe(false);
    store.markRead(a);
    expect(store.isRead(a)).toBe(true);
    expect(new Store(kv, now).isRead(a)).toBe(true);
  });

  it('marks a whole day read and undoes it', () => {
    const { store } = setup();
    const list = [item({ time: '10:00' }), item({ time: '11:00' })];
    const snap = store.snapshot(list.map((i) => i.id));
    store.markAllRead(list);
    expect(list.every((i) => store.isRead(i))).toBe(true);
    store.restore(snap);
    expect(list.some((i) => store.isRead(i))).toBe(false);
  });

  it('marks unread again', () => {
    const { store } = setup();
    const a = item();
    store.markRead(a);
    store.markUnread(a.id);
    expect(store.isRead(a)).toBe(false);
  });

  it('resets all read marks except saved items and undoes the reset', () => {
    const { kv, now, store } = setup();
    const a = item({ time: '10:00' });
    const b = item({ time: '11:00' });
    const kept = item({ time: '12:00' });
    store.markAllRead([a, b]);
    store.save(kept);
    const snap = store.resetRead();
    expect([a, b].some((i) => store.isRead(i))).toBe(false);
    expect(store.isRead(kept)).toBe(true);
    expect(new Store(kv, now).isRead(a)).toBe(false);
    store.restore(snap);
    expect([a, b, kept].every((i) => store.isRead(i))).toBe(true);
  });

  it('treats substantial text growth as an update', () => {
    const { store } = setup();
    const short = item({ paragraphs: ['x'.repeat(200)] });
    store.markRead(short);
    const small = { ...short, paragraphs: ['x'.repeat(260)] };
    expect(store.isUpdated(small)).toBe(false);
    expect(store.isRead(small)).toBe(true);
    const big = { ...short, paragraphs: ['x'.repeat(200), 'y'.repeat(150)] };
    expect(store.isUpdated(big)).toBe(true);
    expect(store.isRead(big)).toBe(false);
    store.markRead(big);
    expect(store.isUpdated(big)).toBe(false);
  });

  it('needs both the ratio and the minimum characters for an update', () => {
    const { store } = setup();
    const long = item({ paragraphs: ['x'.repeat(1000)] });
    store.markRead(long);
    expect(store.isUpdated({ ...long, paragraphs: ['x'.repeat(1200)] })).toBe(false);
    const tiny = item({ id: 't', paragraphs: ['x'.repeat(10)] });
    store.markRead(tiny);
    expect(store.isUpdated({ ...tiny, paragraphs: ['x'.repeat(100)] })).toBe(false);
  });

  it('forgets read marks after 30 days', () => {
    const { kv, now, store } = setup();
    const a = item();
    store.markRead(a);
    now.advance(31 * DAY_MS);
    expect(new Store(kv, now).isRead(a)).toBe(false);
  });
});

describe('saved items', () => {
  it('saves a full copy and marks it read', () => {
    const { store } = setup();
    const a = item({ title: 'Original' });
    store.save(a);
    a.title = 'verändert';
    expect(store.isSaved(a.id)).toBe(true);
    expect(store.savedList()[0].item.title).toBe('Original');
    expect(store.isRead(a)).toBe(true);
  });

  it('expires 14 days after saving unless pinned', () => {
    const { kv, now, store } = setup();
    const a = item({ time: '10:00' });
    const b = item({ time: '11:00' });
    store.save(a);
    store.save(b);
    store.togglePin(b.id);
    now.advance(SAVE_DAYS * DAY_MS - 1);
    expect(new Store(kv, now).savedCount()).toBe(2);
    now.advance(1);
    const later = new Store(kv, now);
    expect(later.isSaved(a.id)).toBe(false);
    expect(later.isSaved(b.id)).toBe(true);
  });

  it('counts the days left and the share left', () => {
    const { now, store } = setup();
    store.save(item());
    const e = () => store.savedList()[0];
    expect(store.daysLeft(e())).toBe(14);
    expect(store.fractionLeft(e())).toBe(1);
    now.advance(11.5 * DAY_MS);
    expect(store.daysLeft(e())).toBe(3);
    expect(store.fractionLeft(e())).toBeCloseTo(2.5 / 14);
    now.advance(2.49 * DAY_MS);
    expect(store.daysLeft(e())).toBe(1);
  });

  it('reports pinned items without a deadline', () => {
    const { store } = setup();
    const a = item();
    store.save(a);
    store.togglePin(a.id);
    expect(store.daysLeft(store.savedList()[0])).toBeNull();
    expect(store.fractionLeft(store.savedList()[0])).toBe(1);
  });

  it('starts a fresh period when unpinning', () => {
    const { now, store } = setup();
    const a = item();
    store.save(a);
    store.togglePin(a.id);
    now.advance(40 * DAY_MS);
    store.togglePin(a.id);
    expect(store.daysLeft(store.savedList()[0])).toBe(14);
  });

  it('removes saved items and restores them on undo', () => {
    const { store } = setup();
    const a = item();
    store.save(a);
    const snap = store.snapshot([a.id]);
    store.remove(a.id);
    expect(store.isSaved(a.id)).toBe(false);
    store.restore(snap);
    expect(store.isSaved(a.id)).toBe(true);
  });

  it('undoes a save completely, including the read mark', () => {
    const { store } = setup();
    const a = item();
    const snap = store.snapshot([a.id]);
    store.save(a);
    store.restore(snap);
    expect(store.isSaved(a.id)).toBe(false);
    expect(store.isRead(a)).toBe(false);
  });

  it('lists newest saved first', () => {
    const { now, store } = setup();
    store.save(item({ time: '10:00' }));
    now.advance(1000);
    store.save(item({ time: '09:00' }));
    expect(store.savedList().map((e) => e.item.time)).toEqual(['09:00', '10:00']);
  });

  it('refreshes saved copies when the source updates them', () => {
    const { store } = setup();
    const a = item({ paragraphs: ['alt'] });
    store.save(a);
    store.refreshSaved([{ ...a, paragraphs: ['alt', 'neu'] }]);
    expect(store.savedList()[0].item.paragraphs).toEqual(['alt', 'neu']);
  });

  it('ignores pin toggles for unknown ids', () => {
    const { store } = setup();
    expect(() => store.togglePin('nope')).not.toThrow();
  });
});

describe('topic filter', () => {
  it('stores hidden topics in a stable order', () => {
    const { kv, now, store } = setup();
    store.setHidden('sport', true);
    store.setHidden('verkehr', true);
    store.setHidden('verkehr', true);
    expect(store.hidden()).toEqual(['verkehr', 'sport']);
    store.setHidden('sport', false);
    expect(new Store(kv, now).hidden()).toEqual(['verkehr']);
  });
});

describe('robustness', () => {
  it('starts empty on damaged storage', () => {
    const kv = new MemoryKV();
    kv.setItem(STORAGE_KEY, '{kaputt');
    expect(new Store(kv).savedCount()).toBe(0);
  });

  it('drops malformed entries and unknown topics', () => {
    const s = sanitize({
      v: 1,
      read: { a: { at: 1, len: 2 }, b: { at: 'x' } },
      saved: { c: { savedAt: 1, item: { title: 't', paragraphs: [] } }, d: { savedAt: 1 } },
      hidden: ['sport', 'quatsch'],
    });
    expect(Object.keys(s.read)).toEqual(['a']);
    expect(Object.keys(s.saved)).toEqual(['c']);
    expect(s.saved.c.pinned).toBe(false);
    expect(s.hidden).toEqual(['sport']);
    expect(sanitize({ v: 2 }).read).toEqual({});
    expect(sanitize(null).saved).toEqual({});
  });

  it('keeps working in memory when storage writes fail', () => {
    const kv = new MemoryKV();
    kv.failWrites = true;
    const store = new Store(kv);
    const a = item();
    store.markRead(a);
    expect(store.isRead(a)).toBe(true);
    expect(store.writeFailed).toBe(true);
  });

  it('works without any storage', () => {
    const store = new Store(null);
    store.save(item());
    expect(store.savedCount()).toBe(1);
  });

  it('notifies subscribers and lets them unsubscribe', () => {
    const { store } = setup();
    let calls = 0;
    const off = store.subscribe(() => calls++);
    store.markRead(item());
    off();
    store.markRead(item({ time: '13:00' }));
    expect(calls).toBe(1);
  });
});

describe('buildFeed', () => {
  const items = [
    item({ date: '2026-11-20', time: '17:00', category: 'sport' }),
    item({ date: '2026-11-20', time: '16:00' }),
    item({ date: '2026-11-19', time: '09:00' }),
    item({ date: '2026-11-18', time: '09:00' }),
    item({ date: '2026-11-16', time: '09:00' }),
  ];

  it('shows the last three days with news, split into unread and read', () => {
    const { store } = setup();
    store.markRead(items[1]);
    const feed = buildFeed(items, store);
    expect(feed.map((d) => d.date)).toEqual(['2026-11-20', '2026-11-19', '2026-11-18']);
    expect(feed[0].unread.map((i) => i.time)).toEqual(['17:00']);
    expect(feed[0].read.map((i) => i.time)).toEqual(['16:00']);
  });

  it('keeps a fully read day in the feed', () => {
    const { store } = setup();
    store.markAllRead(items.slice(0, 2));
    const feed = buildFeed(items, store);
    expect(feed[0].unread).toEqual([]);
    expect(feed[0].read).toHaveLength(2);
  });

  it('leaves out hidden topics', () => {
    const { store } = setup();
    store.setHidden('sport', true);
    expect(buildFeed(items, store)[0].unread.map((i) => i.time)).toEqual(['16:00']);
  });

  it('lists unread items that are not on screen yet', () => {
    const { store } = setup();
    const feed = buildFeed(items, store);
    const shown = new Set(items.slice(1).map((i) => i.id));
    expect(newSince(shown, feed).map((i) => i.id)).toEqual([items[0].id]);
  });
});
