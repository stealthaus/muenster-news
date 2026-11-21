import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cardWords, isCollapsible, renderCard } from '../../src/ui/card';
import { CACHE_KEY, loadNews } from '../../src/ui/data';
import { h, svg } from '../../src/ui/dom';
import { icon, ICON_NAMES } from '../../src/ui/icons';
import { skyline } from '../../src/ui/skyline';
import { Toaster, TOAST_MS } from '../../src/ui/toast';
import { item, MemoryKV } from '../helpers';

const long = item({ title: 'Lange Meldung', paragraphs: ['wort '.repeat(60).trim(), 'noch '.repeat(60).trim()] });
const short = item({ title: 'Kurz', paragraphs: ['Nur ein Satz.'], category: 'polizei', time: '09:05' });
const withImage = item({ paragraphs: ['Kurz.'], image: { src: 'https://example.org/a.jpg', caption: 'Bildtext', credit: 'Foto X' } });

describe('dom helpers', () => {
  it('builds elements with attributes, events and children', () => {
    const click = vi.fn();
    const el = h('button', { class: 'a', autofocus: true, hidden: false, 'data-x': 3, onclick: click }, 'Text', null, h('span', {}, 'kind'));
    expect(el.outerHTML).toBe('<button class="a" autofocus="" data-x="3">Text<span>kind</span></button>');
    el.click();
    expect(click).toHaveBeenCalled();
  });

  it('parses app svg markup', () => {
    expect(svg('<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>').tagName.toLowerCase()).toBe('svg');
  });
});

describe('icons and skyline', () => {
  it('renders every icon as a decorative svg', () => {
    for (const name of ICON_NAMES) {
      const el = icon(name, 18);
      expect(el.getAttribute('aria-hidden')).toBe('true');
      expect(el.getAttribute('width')).toBe('18');
      expect(el.querySelector('path, rect')).not.toBeNull();
    }
  });

  it('draws the Prinzipalmarkt with houses, arcades and night windows', () => {
    const el = skyline();
    expect(el.getAttribute('role')).toBe('img');
    expect(el.querySelectorAll('.house')).toHaveLength(7);
    expect(el.querySelector('.tower')).not.toBeNull();
    expect(el.querySelectorAll('.lit').length).toBeGreaterThan(0);
  });

  it('uses no emoji anywhere in the app source', () => {
    const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|css|html|js|webmanifest|svg)$/.test(f)) files.push(p);
      }
    };
    walk('src');
    walk('public');
    files.push('index.html');
    const offenders = files.filter((f) => emoji.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});

describe('renderCard', () => {
  it('shows topic, time, title and text', () => {
    const card = renderCard(short);
    expect(card.dataset.id).toBe(short.id);
    expect(card.querySelector('.card-label')!.textContent).toBe('POLIZEI · 09:05');
    expect(card.querySelector('.card-title')!.textContent).toBe('Kurz');
    expect(card.querySelector('.card-text')!.textContent).toBe('Nur ein Satz.');
    expect(card.querySelector('.card-more')).toBeNull();
    expect(card.classList.contains('is-collapsed')).toBe(false);
  });

  it('collapses long texts to 7 lines and expands on tap', () => {
    const onToggle = vi.fn();
    const card = renderCard(long, { onToggle });
    expect(isCollapsible(long)).toBe(true);
    expect(card.classList.contains('is-collapsed')).toBe(true);
    const more = card.querySelector<HTMLButtonElement>('.card-more')!;
    expect(more.textContent).toBe('weiterlesen');
    card.querySelector<HTMLElement>('.card-surface')!.click();
    expect(card.classList.contains('is-expanded')).toBe(true);
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(more.textContent).toBe('weniger');
    expect(onToggle).toHaveBeenLastCalledWith(true);
    more.click();
    expect(card.classList.contains('is-collapsed')).toBe(true);
    expect(onToggle).toHaveBeenLastCalledWith(false);
  });

  it('keeps short cards with an image collapsible behind "Bild anzeigen"', () => {
    const card = renderCard(withImage);
    expect(card.querySelector('.card-more')!.textContent).toBe('Bild anzeigen');
    const img = card.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('https://example.org/a.jpg');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(card.querySelector('figcaption')!.textContent).toBe('Bildtext · © Foto X');
  });

  it('marks read and updated cards', () => {
    const card = renderCard(short, { read: true, updated: true });
    expect(card.classList.contains('is-read')).toBe(true);
    expect(card.querySelector('.badge-updated')!.textContent).toBe('aktualisiert');
  });

  it('saves via the bookmark button without toggling the card', () => {
    const onSave = vi.fn();
    const onToggle = vi.fn();
    const card = renderCard(long, { onSave, onToggle });
    card.querySelector<HTMLButtonElement>('.card-save')!.click();
    expect(onSave).toHaveBeenCalled();
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('counts only the visible words while collapsed', () => {
    expect(cardWords(long, false)).toBe(2 + 80);
    expect(cardWords(long, true)).toBe(2 + 120);
    expect(cardWords(short, false)).toBe(1 + 3);
  });
});

describe('Toaster', () => {
  afterEach(() => vi.useRealTimers());

  it('shows a message with undo and hides after a while', () => {
    vi.useFakeTimers();
    const host = document.createElement('div');
    const t = new Toaster(host);
    const undo = vi.fn();
    t.show('Gemerkt', undo);
    const el = host.querySelector<HTMLElement>('.toast')!;
    expect(el.hidden).toBe(false);
    expect(el.textContent).toContain('Gemerkt');
    el.querySelector<HTMLButtonElement>('.toast-undo')!.click();
    expect(undo).toHaveBeenCalled();
    expect(el.hidden).toBe(true);
    t.show('Ohne Undo');
    expect(el.querySelector('.toast-undo')).toBeNull();
    vi.advanceTimersByTime(TOAST_MS);
    expect(el.hidden).toBe(true);
  });
});

describe('loadNews', () => {
  const file = { version: 1, generatedAt: '2026-11-20T16:05:00Z', sources: {}, items: [short] };
  const ok = (body: unknown, headers: Record<string, string> = {}) =>
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers })) as unknown as typeof fetch;

  it('loads the file and keeps a copy', async () => {
    const kv = new MemoryKV();
    const res = await loadNews(ok(file), kv);
    expect(res).toEqual({ file, offline: false });
    expect(JSON.parse(kv.getItem(CACHE_KEY)!)).toEqual(file);
  });

  it('flags answers the service worker served from its cache', async () => {
    const res = await loadNews(ok(file, { 'X-Served-From': 'cache' }), null);
    expect(res.offline).toBe(true);
    expect(res.file).toEqual(file);
  });

  it('falls back to the stored copy when the network fails', async () => {
    const kv = new MemoryKV();
    kv.setItem(CACHE_KEY, JSON.stringify(file));
    const failing = vi.fn(async () => {
      throw new TypeError('offline');
    }) as unknown as typeof fetch;
    expect(await loadNews(failing, kv)).toEqual({ file, offline: true });
  });

  it('rejects invalid data and reports nothing when there is no copy', async () => {
    expect(await loadNews(ok({ version: 9 }), new MemoryKV())).toEqual({ file: null, offline: true });
    const notFound = vi.fn(async () => new Response('', { status: 404 })) as unknown as typeof fetch;
    expect(await loadNews(notFound, null)).toEqual({ file: null, offline: true });
  });
});
