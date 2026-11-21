import { berlinDate, clockLabel, longDayLabel, numericDayLabel, shortDayLabel } from '../core/days';
import { dwellMs } from '../core/dwell';
import { buildFeed, newSince, type FeedDay } from '../core/feed';
import { compareNewestFirst } from '../core/merge';
import type { KeyValue, SavedEntry, Store } from '../core/store';
import { CATEGORIES, CATEGORY_LABELS, SOURCE_NAMES, type NewsFile, type NewsItem } from '../core/types';
import { cardWords, figure, renderCard } from './card';
import { loadNews } from './data';
import { h } from './dom';
import { DwellWatcher } from './dwell-watcher';
import { icon } from './icons';
import { skyline } from './skyline';
import { Toaster } from './toast';

/** How long the border glows after a card counts as read. */
export const GLOW_MS = 1200;
/** Time for a swiped card to slide out before it is removed. */
export const LEAVE_MS = 220;
/** Reload news when the app returns from the background after this long. */
export const RELOAD_AFTER_MS = 5 * 60_000;

type IOCtor = new (cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) => IntersectionObserver;

export interface AppDeps {
  root: HTMLElement;
  store: Store;
  kv: KeyValue | null;
  fetch: typeof fetch;
  IO?: IOCtor;
  now?: () => number;
  dataUrl?: string;
}

interface Day {
  date: string;
  items: NewsItem[];
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "Stand 17:05", or with the day when the data is not from today. */
export function standLabel(fetchedAt: string, now: number): string {
  const clock = clockLabel(fetchedAt);
  const day = berlinDate(new Date(fetchedAt));
  return day === berlinDate(new Date(now)) ? `Stand ${clock}` : `Stand ${shortDayLabel(day)} ${clock}`;
}

export class App {
  readonly root: HTMLElement;
  private store: Store;
  private deps: AppDeps;
  private now: () => number;
  private watcher: DwellWatcher;
  private toaster: Toaster;

  private file: NewsFile | null = null;
  private offline = false;
  private items: NewsItem[] = [];
  private days: Day[] = [];
  /** Ids shown in the feed this session (read ones stay until the next start) and ids swiped away. */
  private shown = new Set<string>();
  private removed = new Set<string>();
  private activeDate: string | null = null;
  private view: 'feed' | 'saved' = 'feed';
  private lastLoad = 0;
  private sheetOpen = false;

  private el!: {
    stand: HTMLElement;
    daybar: HTMLElement;
    tabbar: HTMLElement;
    tabs: HTMLElement;
    allRead: HTMLButtonElement;
    pill: HTMLButtonElement;
    feed: HTMLElement;
    end: HTMLElement;
    readFeed: HTMLElement;
    feedView: HTMLElement;
    savedView: HTMLElement;
    savedList: HTMLElement;
    navNew: HTMLButtonElement;
    navSaved: HTMLButtonElement;
    sheet: HTMLElement;
  };

  constructor(deps: AppDeps) {
    this.deps = deps;
    this.root = deps.root;
    this.store = deps.store;
    this.now = deps.now ?? Date.now;
    this.watcher = new DwellWatcher(
      deps.IO,
      () => this.view !== 'feed' || this.sheetOpen,
      () => ({ top: this.el.daybar.getBoundingClientRect().height, bottom: this.el.tabbar.getBoundingClientRect().height }),
    );
    this.renderShell();
    this.toaster = new Toaster(this.root);
  }

  async start(): Promise<void> {
    await this.load(true);
    document.addEventListener('visibilitychange', () => this.onVisibility());
    window.addEventListener('scroll', () => this.updateActiveDay(), { passive: true });
  }

  // Data

  async load(initial: boolean): Promise<void> {
    const res = await loadNews(this.deps.fetch, this.deps.kv, this.deps.dataUrl);
    this.lastLoad = this.now();
    this.offline = res.offline;
    if (res.file) {
      this.file = res.file;
      this.items = [...res.file.items].sort(compareNewestFirst);
      this.store.refreshSaved(this.items);
    }
    if (initial || this.days.length === 0) this.rebuildFeed();
    else this.checkForNew();
    this.updateHeader();
  }

  private onVisibility(): void {
    if (document.visibilityState === 'hidden') {
      this.watcher.pauseAll();
      return;
    }
    this.watcher.resumeAll();
    if (this.now() - this.lastLoad > RELOAD_AFTER_MS) void this.load(false);
  }

  private checkForNew(): void {
    const known = new Set([...this.shown, ...this.removed]);
    const fresh = newSince(known, buildFeed(this.items, this.store));
    this.el.pill.hidden = fresh.length === 0;
    this.el.pill.textContent = fresh.length === 1 ? '1 neue Meldung' : `${fresh.length} neue Meldungen`;
  }

  // Shell

  private renderShell(): void {
    const stand = h('span', { class: 'stand' });
    const masthead = h(
      'header',
      { class: 'masthead' },
      h('div', { class: 'mast-top' }, h('h1', {}, 'Münster News'), stand),
      h('div', { class: 'mast-sky' }, skyline()),
      h('div', { class: 'mast-ground' }),
    );

    const tabs = h('div', { class: 'day-tabs', role: 'tablist', 'aria-label': 'Tage' });
    const allRead = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Alle als gelesen markieren' }, icon('checkAll'));
    allRead.addEventListener('click', () => this.markDayRead(this.activeDate ?? this.days[0]?.date));
    const filterBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Themen filtern' }, icon('filter'));
    filterBtn.addEventListener('click', () => this.openSheet());
    const daybar = h('nav', { class: 'daybar' }, tabs, h('span', { class: 'spacer' }), allRead, filterBtn);

    const pill = h('button', { class: 'new-pill', type: 'button', hidden: true }, '');
    pill.addEventListener('click', () => {
      this.rebuildFeed();
      window.scrollTo?.({ top: 0, behavior: 'smooth' });
    });

    const feed = h('div', { class: 'feed' });
    const end = h('div', { class: 'feed-end' });
    const readFeed = h('div', { class: 'read-feed' });
    const feedView = h('section', { class: 'view view-feed', 'aria-label': 'Neue Meldungen' }, daybar, pill, feed, end, readFeed);

    const savedList = h('div', { class: 'saved-list' });
    const savedView = h(
      'section',
      { class: 'view view-saved', 'aria-label': 'Gemerkte Meldungen', hidden: true },
      h('div', { class: 'saved-head' }, h('h2', {}, 'Gemerkt'), h('span', { class: 'saved-hint' }, '14 Tage, mit Schloss dauerhaft')),
      savedList,
    );

    const navNew = h('button', { class: 'nav-btn is-active', type: 'button', 'aria-current': 'page' });
    navNew.addEventListener('click', () => this.setView('feed'));
    const navSaved = h('button', { class: 'nav-btn', type: 'button' });
    navSaved.addEventListener('click', () => this.setView('saved'));
    const nav = h('nav', { class: 'tabbar', 'aria-label': 'Ansicht' }, navNew, navSaved);

    const sheet = h('div', { class: 'sheet', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Themen' });
    sheet.addEventListener('click', (e) => {
      if (e.target === sheet) this.closeSheet();
    });

    this.root.replaceChildren(masthead, h('main', {}, feedView, savedView), nav, sheet);
    this.el = { stand, daybar, tabbar: nav, tabs, allRead, pill, feed, end, readFeed, feedView, savedView, savedList, navNew, navSaved, sheet };
  }

  private updateHeader(): void {
    const fetchedAt = this.file?.sources.antenne?.fetchedAt ?? this.file?.generatedAt;
    const parts: (string | Node)[] = [];
    if (this.offline) parts.push(icon('cloudOff', 14), 'Offline · ');
    parts.push(fetchedAt ? standLabel(fetchedAt, this.now()) : 'Noch keine Daten');
    this.el.stand.replaceChildren(...parts);
    this.el.stand.classList.toggle('is-offline', this.offline);
  }

  private setView(view: 'feed' | 'saved'): void {
    this.view = view;
    this.el.feedView.hidden = view !== 'feed';
    this.el.savedView.hidden = view !== 'saved';
    this.el.navNew.classList.toggle('is-active', view === 'feed');
    this.el.navSaved.classList.toggle('is-active', view === 'saved');
    this.el.navNew.toggleAttribute('aria-current', view === 'feed');
    this.el.navSaved.toggleAttribute('aria-current', view === 'saved');
    if (view === 'saved') {
      this.watcher.pauseAll();
      this.renderSaved();
    } else {
      this.watcher.resumeAll();
    }
    window.scrollTo?.({ top: 0 });
  }

  // Feed

  /** Builds the session's feed: unread items plus those read while this session runs. */
  rebuildFeed(): void {
    this.watcher.disconnect();
    const feed: FeedDay[] = buildFeed(this.items, this.store);
    this.days = feed.map((d) => ({
      date: d.date,
      items: [...d.unread, ...d.read.filter((i) => this.shown.has(i.id))]
        .filter((i) => !this.removed.has(i.id))
        .sort(compareNewestFirst),
    }));
    this.shown = new Set(this.days.flatMap((d) => d.items.map((i) => i.id)));
    if (!this.days.some((d) => d.date === this.activeDate)) this.activeDate = this.days[0]?.date ?? null;
    this.el.pill.hidden = true;
    this.renderFeed();
  }

  private renderFeed(): void {
    this.el.readFeed.replaceChildren();
    if (!this.file) {
      const retry = h('button', { class: 'btn', type: 'button' }, icon('refresh', 18), 'Erneut versuchen');
      retry.addEventListener('click', () => void this.load(true));
      this.el.feed.replaceChildren(
        h('div', { class: 'empty' }, h('p', { class: 'empty-title' }, 'Noch keine Meldungen geladen'), h('p', {}, 'Prüfe die Verbindung und versuch es noch einmal.'), retry),
      );
      this.el.end.replaceChildren();
      this.renderTabs();
      this.updateCounts();
      return;
    }
    this.el.feed.replaceChildren(
      ...this.days.map((day) =>
        h(
          'section',
          { class: 'day', 'data-date': day.date, id: `tag-${day.date}` },
          h('h2', { class: 'day-heading' }, longDayLabel(day.date)),
          ...day.items.map((item) => this.feedCard(item)),
        ),
      ),
    );
    this.renderTabs();
    this.renderEnd();
    this.updateCounts();
  }

  private feedCard(item: NewsItem): HTMLElement {
    const read = this.store.isRead(item);
    const card: HTMLElement = renderCard(item, {
      read,
      updated: this.store.isUpdated(item),
      onSwipe: (dir) => (dir === 'left' ? this.dismiss(item, card) : this.saveFromFeed(item, card)),
      onSave: () => this.saveFromFeed(item, card),
      onToggle: (expanded) => this.watcher.retime(card, dwellMs(cardWords(item, expanded))),
    });
    if (!read) this.watcher.watch(card, dwellMs(cardWords(item, false)), () => this.readByDwell(item, card));
    return card;
  }

  private readByDwell(item: NewsItem, card: HTMLElement): void {
    this.store.markRead(item);
    card.classList.add('just-read');
    card.querySelector('.badge-updated')?.remove();
    setTimeout(() => {
      card.classList.remove('just-read');
      card.classList.add('is-read');
    }, GLOW_MS);
    this.updateCounts();
    this.renderEnd();
  }

  private unreadOf(day: Day): NewsItem[] {
    return day.items.filter((i) => !this.removed.has(i.id) && !this.store.isRead(i));
  }

  private renderTabs(): void {
    this.el.tabs.replaceChildren(
      ...this.days.map((day) => {
        const btn = h(
          'button',
          { class: 'day-tab', type: 'button', role: 'tab', 'data-date': day.date },
          h('span', { class: 'day-tab-label' }, shortDayLabel(day.date)),
          h('span', { class: 'day-tab-count' }, ''),
        );
        btn.addEventListener('click', () => {
          this.setActiveDay(day.date);
          document.getElementById(`tag-${day.date}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
        });
        return btn;
      }),
    );
    this.setActiveDay(this.activeDate);
  }

  private setActiveDay(date: string | null): void {
    this.activeDate = date;
    for (const tab of this.el.tabs.querySelectorAll<HTMLElement>('.day-tab')) {
      const on = tab.dataset.date === date;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', String(on));
    }
    this.el.allRead.setAttribute('aria-label', date ? `Alle von ${longDayLabel(date).split(',')[0]} als gelesen markieren` : 'Alle als gelesen markieren');
  }

  private updateActiveDay(): void {
    if (this.view !== 'feed') return;
    const bar = this.el.tabs.parentElement?.getBoundingClientRect().bottom ?? 0;
    let current = this.days[0]?.date ?? null;
    for (const sec of this.el.feed.querySelectorAll<HTMLElement>('.day')) {
      if (sec.getBoundingClientRect().top <= bar + 8) current = sec.dataset.date ?? current;
    }
    if (current !== this.activeDate) this.setActiveDay(current);
  }

  private updateCounts(): void {
    let total = 0;
    for (const day of this.days) {
      const n = this.unreadOf(day).length;
      total += n;
      const tab = this.el.tabs.querySelector<HTMLElement>(`.day-tab[data-date="${day.date}"] .day-tab-count`);
      if (tab) tab.textContent = String(n);
    }
    this.el.navNew.replaceChildren(icon('stack', 18), h('span', {}, `Neu · ${total}`));
    this.el.navSaved.replaceChildren(icon('bookmark', 18), h('span', {}, `Gemerkt · ${this.store.savedCount()}`));
  }

  private renderEnd(): void {
    if (!this.file) return;
    const unread = this.days.reduce((n, d) => n + this.unreadOf(d).length, 0);
    const visible = this.days.reduce((n, d) => n + d.items.filter((i) => !this.removed.has(i.id)).length, 0);
    const readHidden = this.readOutsideFeed().length;
    const parts: Node[] = [];
    if (visible === 0) {
      parts.push(h('div', { class: 'empty' }, h('p', { class: 'empty-title' }, 'Alles gelesen'), h('p', {}, 'Neue Meldungen kommen werktags zwischen 6:30 und 19 Uhr.')));
    } else if (unread === 0) {
      parts.push(h('p', { class: 'end-note' }, 'Alles gelesen'));
    }
    if (readHidden > 0 && !this.el.readFeed.hasChildNodes()) {
      const btn = h('button', { class: 'btn', type: 'button' }, 'Bereits gelesene Meldungen anzeigen');
      btn.addEventListener('click', () => this.showRead());
      parts.push(btn);
    }
    if (this.hasResettable()) parts.push(this.resetButton());
    this.el.end.replaceChildren(...parts);
  }

  /** Read or swiped-away items in the feed days that a reset would bring back. */
  private hasResettable(): boolean {
    return buildFeed(this.items, this.store).some((d) => d.read.some((i) => !this.store.isSaved(i.id)));
  }

  private resetButton(): HTMLElement {
    const btn = h('button', { class: 'btn btn-reset', type: 'button' }, icon('refresh', 18), 'Alles wieder als ungelesen zeigen');
    btn.addEventListener('click', () => this.resetRead());
    return btn;
  }

  /** Brings back everything read or swiped away as unread; saved items stay in the Merkfach. Undo restores it. */
  resetRead(): void {
    this.sheetOpen = false;
    this.el.sheet.hidden = true;
    const before = new Set(this.removed);
    const snap = this.store.resetRead();
    this.removed = new Set([...this.removed].filter((id) => this.store.isSaved(id)));
    this.rebuildFeed();
    window.scrollTo?.({ top: 0, behavior: 'smooth' });
    this.toaster.show('Alles wieder ungelesen', () => {
      this.store.restore(snap);
      this.removed = before;
      this.rebuildFeed();
    });
  }

  /** Read items of the feed days that are not on screen any more. */
  private readOutsideFeed(): { date: string; items: NewsItem[] }[] {
    const onScreen = new Set([...this.shown].filter((id) => !this.removed.has(id)));
    return buildFeed(this.items, this.store)
      .map((d) => ({ date: d.date, items: d.read.filter((i) => !onScreen.has(i.id)) }))
      .filter((d) => d.items.length > 0);
  }

  private showRead(): void {
    const days = this.readOutsideFeed();
    this.el.readFeed.replaceChildren(
      h('h2', { class: 'read-heading' }, 'Bereits gelesen'),
      ...days.map((day) =>
        h(
          'section',
          { class: 'day day-read', 'data-date': day.date },
          h('h3', { class: 'day-heading' }, longDayLabel(day.date)),
          ...day.items.map((item) => {
            const card: HTMLElement = renderCard(item, {
              read: true,
              allowLeft: false,
              onSwipe: () => this.saveFromFeed(item, card),
              onSave: () => this.saveFromFeed(item, card),
            });
            return card;
          }),
        ),
      ),
    );
    this.el.end.replaceChildren();
  }

  private removeCard(card: HTMLElement): { parent: Element | null; next: Element | null } {
    const pos = { parent: card.parentElement, next: card.nextElementSibling };
    this.watcher.unwatch(card);
    // Collapse from the real height, otherwise the transition idles through the large default max-height.
    card.style.maxHeight = `${card.offsetHeight}px`;
    void card.offsetHeight;
    card.classList.add('is-leaving');
    card.style.maxHeight = '0px';
    setTimeout(() => card.remove(), LEAVE_MS);
    return pos;
  }

  private putBack(item: NewsItem, pos: { parent: Element | null; next: Element | null }, inReadFeed: boolean): void {
    if (!pos.parent?.isConnected) return this.rebuildFeed();
    const card = inReadFeed
      ? renderCard(item, { read: true, allowLeft: false, onSave: () => this.saveFromFeed(item, card), onSwipe: () => this.saveFromFeed(item, card) })
      : this.feedCard(item);
    pos.parent.insertBefore(card, pos.next?.isConnected ? pos.next : null);
  }

  dismiss(item: NewsItem, card: HTMLElement): void {
    const snap = this.store.snapshot([item.id]);
    this.store.markRead(item);
    this.removed.add(item.id);
    const pos = this.removeCard(card);
    this.afterRemoval();
    this.toaster.show('Als gelesen markiert', () => {
      this.store.restore(snap);
      this.removed.delete(item.id);
      this.putBack(item, pos, false);
      this.afterRemoval();
    });
  }

  saveFromFeed(item: NewsItem, card: HTMLElement): void {
    const inReadFeed = this.el.readFeed.contains(card);
    const snap = this.store.snapshot([item.id]);
    this.store.save(item);
    this.removed.add(item.id);
    const pos = this.removeCard(card);
    this.afterRemoval();
    this.toaster.show('Gemerkt', () => {
      this.store.restore(snap);
      this.removed.delete(item.id);
      this.putBack(item, pos, inReadFeed);
      this.afterRemoval();
    });
  }

  markDayRead(date: string | undefined): void {
    const day = this.days.find((d) => d.date === date);
    if (!day) return;
    const items = this.unreadOf(day);
    if (items.length === 0) {
      this.toaster.show(`${longDayLabel(day.date).split(',')[0]}: schon alles gelesen`);
      return;
    }
    const snap = this.store.snapshot(items.map((i) => i.id));
    this.store.markAllRead(items);
    const ids = new Set(items.map((i) => i.id));
    for (const id of ids) this.removed.add(id);
    for (const card of this.el.feed.querySelectorAll<HTMLElement>('.card')) {
      if (ids.has(card.dataset.id ?? '')) this.removeCard(card);
    }
    this.afterRemoval();
    this.toaster.show(`${plural(items.length, 'Meldung', 'Meldungen')} als gelesen markiert`, () => {
      this.store.restore(snap);
      for (const i of items) this.removed.delete(i.id);
      this.rebuildFeed();
    });
  }

  private afterRemoval(): void {
    this.updateCounts();
    this.renderEnd();
  }

  // Topic filter

  private openSheet(): void {
    this.sheetOpen = true;
    this.watcher.pauseAll();
    const dates = new Set(this.days.map((d) => d.date));
    const inFeed = this.items.filter((i) => dates.has(i.date));
    const hidden = new Set(this.store.hidden());
    const chips = CATEGORIES.map((cat) => {
      const n = inFeed.filter((i) => i.category === cat).length;
      const chip = h(
        'button',
        { class: 'chip', type: 'button', 'aria-pressed': String(!hidden.has(cat)), 'data-category': cat },
        h('span', {}, CATEGORY_LABELS[cat]),
        h('span', { class: 'chip-count' }, String(n)),
      );
      chip.addEventListener('click', () => {
        const show = chip.getAttribute('aria-pressed') !== 'true';
        chip.setAttribute('aria-pressed', String(show));
        this.store.setHidden(cat, !show);
      });
      return chip;
    });
    const done = h('button', { class: 'btn btn-primary', type: 'button' }, 'Fertig');
    done.addEventListener('click', () => this.closeSheet());
    this.el.sheet.replaceChildren(
      h(
        'div',
        { class: 'sheet-panel' },
        h('h2', {}, 'Themen'),
        h('p', { class: 'sheet-hint' }, 'Ausgeschaltete Themen erscheinen nicht im Feed.'),
        h('div', { class: 'chips' }, ...chips),
        done,
        this.resetButton(),
      ),
    );
    this.el.sheet.hidden = false;
  }

  private closeSheet(): void {
    this.sheetOpen = false;
    this.el.sheet.hidden = true;
    this.rebuildFeed();
  }

  // Saved

  renderSaved(): void {
    const list = this.store.savedList();
    if (list.length === 0) {
      this.el.savedList.replaceChildren(
        h('div', { class: 'empty' }, h('p', { class: 'empty-title' }, 'Noch nichts gemerkt'), h('p', {}, 'Wische eine Meldung nach rechts, um sie hier 14 Tage aufzuheben.')),
      );
    } else {
      this.el.savedList.replaceChildren(...list.map((e) => this.savedRow(e)));
    }
    this.updateCounts();
  }

  private savedRow(entry: SavedEntry): HTMLElement {
    const { item } = entry;
    const left = this.store.daysLeft(entry);
    const soon = left !== null && left <= 2;
    const status =
      left === null
        ? h('div', { class: 'saved-status is-pinned' }, icon('lock', 14), 'festgepinnt')
        : h(
            'div',
            { class: `saved-status${soon ? ' is-soon' : ''}` },
            h('span', { class: 'saved-bar', 'aria-hidden': 'true' }, h('i', { style: `width:${Math.round(this.store.fractionLeft(entry) * 100)}%` })),
            left === 1 ? 'noch 1 Tag' : `noch ${left} Tage`,
          );

    const lock = h(
      'button',
      { class: `icon-btn saved-lock${entry.pinned ? ' is-on' : ''}`, type: 'button', 'aria-pressed': String(entry.pinned), 'aria-label': entry.pinned ? 'Lösen' : 'Festpinnen' },
      icon(entry.pinned ? 'lock' : 'unlock', 20),
    );
    lock.addEventListener('click', () => {
      this.store.togglePin(item.id);
      this.renderSaved();
    });

    const del = h('button', { class: 'icon-btn saved-delete', type: 'button', 'aria-label': 'Löschen' }, icon('trash', 20));
    del.addEventListener('click', () => {
      const snap = this.store.snapshot([item.id]);
      this.store.remove(item.id);
      this.renderSaved();
      this.toaster.show('Gelöscht', () => {
        this.store.restore(snap);
        this.renderSaved();
      });
    });

    const detail = h(
      'div',
      { class: 'saved-detail', hidden: true },
      ...item.paragraphs.map((p) => h('p', {}, p)),
      figure(item),
      h('a', { class: 'source-link', href: item.url, target: '_blank', rel: 'noopener noreferrer' }, `Bei ${SOURCE_NAMES[item.source]} lesen`, icon('external', 14)),
    );
    const main = h(
      'button',
      { class: 'saved-main', type: 'button', 'aria-expanded': 'false' },
      h('span', { class: 'card-label' }, `${CATEGORY_LABELS[item.category].toUpperCase()} · ${numericDayLabel(item.date)} · ${item.time}`),
      h('span', { class: 'saved-title' }, item.title),
      status,
    );
    main.addEventListener('click', () => {
      detail.hidden = !detail.hidden;
      main.setAttribute('aria-expanded', String(!detail.hidden));
    });

    return h('article', { class: `saved-row${entry.pinned ? ' is-pinned' : ''}`, 'data-id': item.id }, h('div', { class: 'saved-line' }, main, lock, del), detail);
  }
}
