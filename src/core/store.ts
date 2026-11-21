import { CATEGORIES, textLength, type Category, type NewsItem } from './types';

export const STORAGE_KEY = 'muenster-news:v1';
export const SAVE_DAYS = 14;
export const READ_KEEP_DAYS = 30;
export const DAY_MS = 86_400_000;
/** A read item counts as unread again when its text grew by at least this much. */
export const UPDATE_MIN_CHARS = 120;
export const UPDATE_MIN_RATIO = 1.4;

export interface ReadEntry {
  at: number;
  /** Text length when it was read, to detect substantial updates. */
  len: number;
}

export interface SavedEntry {
  /** Full local copy, so the item survives even when the source drops it. */
  item: NewsItem;
  savedAt: number;
  pinned: boolean;
}

export interface State {
  v: 1;
  read: Record<string, ReadEntry>;
  saved: Record<string, SavedEntry>;
  hidden: Category[];
}

export interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface Snapshot {
  read: Record<string, ReadEntry | undefined>;
  saved: Record<string, SavedEntry | undefined>;
}

function fresh(): State {
  return { v: 1, read: {}, saved: {}, hidden: [] };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Accepts only well-formed entries, so a damaged value never breaks the app. */
export function sanitize(raw: unknown): State {
  const state = fresh();
  if (!isObject(raw) || raw.v !== 1) return state;
  if (isObject(raw.read)) {
    for (const [id, e] of Object.entries(raw.read)) {
      if (isObject(e) && typeof e.at === 'number' && typeof e.len === 'number') state.read[id] = { at: e.at, len: e.len };
    }
  }
  if (isObject(raw.saved)) {
    for (const [id, e] of Object.entries(raw.saved)) {
      if (
        isObject(e) &&
        typeof e.savedAt === 'number' &&
        isObject(e.item) &&
        typeof e.item.title === 'string' &&
        Array.isArray(e.item.paragraphs)
      ) {
        state.saved[id] = { item: e.item as unknown as NewsItem, savedAt: e.savedAt, pinned: e.pinned === true };
      }
    }
  }
  if (Array.isArray(raw.hidden)) {
    state.hidden = raw.hidden.filter((c): c is Category => (CATEGORIES as readonly unknown[]).includes(c));
  }
  return state;
}

export class Store {
  private state: State;
  private listeners = new Set<() => void>();
  /** True when the last write to storage failed (private mode, full quota). */
  writeFailed = false;

  constructor(
    private kv: KeyValue | null,
    private now: () => number = Date.now,
  ) {
    this.state = this.load();
    if (this.prune()) this.persist();
  }

  private load(): State {
    try {
      const raw = this.kv?.getItem(STORAGE_KEY);
      return raw ? sanitize(JSON.parse(raw)) : fresh();
    } catch {
      return fresh();
    }
  }

  private persist(): void {
    try {
      this.kv?.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.writeFailed = false;
    } catch {
      this.writeFailed = true;
    }
  }

  private changed(): void {
    this.persist();
    for (const fn of this.listeners) fn();
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Drops expired saved items and old read marks. Returns whether anything changed. */
  prune(): boolean {
    const now = this.now();
    let changed = false;
    for (const [id, e] of Object.entries(this.state.saved)) {
      if (!e.pinned && now >= e.savedAt + SAVE_DAYS * DAY_MS) {
        delete this.state.saved[id];
        changed = true;
      }
    }
    for (const [id, e] of Object.entries(this.state.read)) {
      if (now - e.at > READ_KEEP_DAYS * DAY_MS) {
        delete this.state.read[id];
        changed = true;
      }
    }
    return changed;
  }

  // Read state

  /** Read before, and its text has grown substantially since. */
  isUpdated(item: NewsItem): boolean {
    const e = this.state.read[item.id];
    if (!e) return false;
    const len = textLength(item);
    return len - e.len >= UPDATE_MIN_CHARS && len >= e.len * UPDATE_MIN_RATIO;
  }

  isRead(item: NewsItem): boolean {
    return item.id in this.state.read && !this.isUpdated(item);
  }

  markRead(item: NewsItem): void {
    this.state.read[item.id] = { at: this.now(), len: textLength(item) };
    this.changed();
  }

  markAllRead(items: NewsItem[]): void {
    const at = this.now();
    for (const item of items) this.state.read[item.id] = { at, len: textLength(item) };
    this.changed();
  }

  markUnread(id: string): void {
    delete this.state.read[id];
    this.changed();
  }

  /**
   * Makes every read item unread again, except saved ones, which stay in the Merkfach and out of the feed.
   * Returns a snapshot for undo.
   */
  resetRead(): Snapshot {
    const ids = Object.keys(this.state.read).filter((id) => !(id in this.state.saved));
    const snap = this.snapshot(ids);
    for (const id of ids) delete this.state.read[id];
    this.changed();
    return snap;
  }

  // Saved items

  isSaved(id: string): boolean {
    return id in this.state.saved;
  }

  /** Saves a copy and marks the item read, since it leaves the feed. */
  save(item: NewsItem): void {
    const now = this.now();
    this.state.saved[item.id] = { item: structuredCloneSafe(item), savedAt: now, pinned: false };
    this.state.read[item.id] = { at: now, len: textLength(item) };
    this.changed();
  }

  remove(id: string): void {
    delete this.state.saved[id];
    this.changed();
  }

  togglePin(id: string): void {
    const e = this.state.saved[id];
    if (!e) return;
    e.pinned = !e.pinned;
    // Unpinning starts a fresh 14-day period, so an old item does not vanish the moment it is unlocked.
    if (!e.pinned) e.savedAt = this.now();
    this.changed();
  }

  /** Newest saved first. */
  savedList(): SavedEntry[] {
    return Object.values(this.state.saved).sort((a, b) => b.savedAt - a.savedAt);
  }

  savedCount(): number {
    return Object.keys(this.state.saved).length;
  }

  /** Whole days left before the item disappears, at least 1 while it exists; null when pinned. */
  daysLeft(entry: SavedEntry): number | null {
    if (entry.pinned) return null;
    const ms = entry.savedAt + SAVE_DAYS * DAY_MS - this.now();
    return Math.max(1, Math.ceil(ms / DAY_MS));
  }

  /** Share of the 14 days that is left, 0..1; 1 when pinned. */
  fractionLeft(entry: SavedEntry): number {
    if (entry.pinned) return 1;
    const ms = entry.savedAt + SAVE_DAYS * DAY_MS - this.now();
    return Math.min(1, Math.max(0, ms / (SAVE_DAYS * DAY_MS)));
  }

  /** Keeps saved copies up to date while the source still lists the item. */
  refreshSaved(items: NewsItem[]): void {
    let changed = false;
    for (const item of items) {
      const e = this.state.saved[item.id];
      if (e && JSON.stringify(e.item) !== JSON.stringify(item)) {
        e.item = structuredCloneSafe(item);
        changed = true;
      }
    }
    if (changed) this.changed();
  }

  // Topic filter

  hidden(): Category[] {
    return [...this.state.hidden];
  }

  setHidden(category: Category, hide: boolean): void {
    const set = new Set(this.state.hidden);
    if (hide) set.add(category);
    else set.delete(category);
    this.state.hidden = CATEGORIES.filter((c) => set.has(c));
    this.changed();
  }

  // Undo

  snapshot(ids: string[]): Snapshot {
    const snap: Snapshot = { read: {}, saved: {} };
    for (const id of ids) {
      snap.read[id] = this.state.read[id] && { ...this.state.read[id] };
      snap.saved[id] = this.state.saved[id] && { ...this.state.saved[id] };
    }
    return snap;
  }

  restore(snap: Snapshot): void {
    for (const [id, e] of Object.entries(snap.read)) {
      if (e) this.state.read[id] = e;
      else delete this.state.read[id];
    }
    for (const [id, e] of Object.entries(snap.saved)) {
      if (e) this.state.saved[id] = e;
      else delete this.state.saved[id];
    }
    this.changed();
  }
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** localStorage, or null when the browser blocks it. */
export function browserStorage(): KeyValue | null {
  try {
    const ls = globalThis.localStorage;
    const probe = '__mn_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}
