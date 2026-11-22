/** Share of the screen (between the fixed bars) that counts as the reading zone. */
export const ZONE_SHARE = 0.45;
/**
 * Where the zone sits in the room left above and below it: 0 = centred, -1 = against the day bar, 1 = against the tab
 * bar. Slightly high, because the eye reads in the upper part of the screen.
 */
export const ZONE_SHIFT = -0.35;
/** Fine steps, so the observer reports often while a card slides across the zone's edges. */
const THRESHOLDS = Array.from({ length: 101 }, (_, i) => i / 100);
/** Re-measure the zone when the screen height changes by more than this (rotation, iOS toolbars). */
const RESIZE_SLACK = 40;

/** Screen edges covered by fixed bars (sticky day bar, tab bar), in pixels. */
export interface Insets {
  top: number;
  bottom: number;
}

type IOCtor = new (cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) => IntersectionObserver;
type Entry = Pick<IntersectionObserverEntry, 'isIntersecting' | 'intersectionRect' | 'boundingClientRect' | 'rootBounds'>;

interface Watched {
  ms: number;
  onRead: () => void;
  timer: ReturnType<typeof setTimeout> | null;
  visible: boolean;
}

/** Margins that shrink the viewport to the reading zone: `ZONE_SHARE` of the area between the bars, placed by `ZONE_SHIFT`. */
export function zoneMargin(viewportH: number, { top, bottom }: Insets): string {
  const free = Math.max(0, viewportH - top - bottom);
  const room = (free * (1 - ZONE_SHARE)) / 2;
  const shift = ZONE_SHIFT * room;
  return `${-Math.round(top + room + shift)}px 0px ${-Math.round(bottom + room - shift)}px 0px`;
}

/**
 * Fires `onRead` once a card has stayed in the reading zone for its dwell time. The zone is a band a little above the
 * middle of the screen between the fixed bars (see `zoneMargin`); a card is in it while its centre lies inside, or while it covers the whole zone.
 * Scrolling it out resets the timer, so only real pauses count. Each card fires at most once and is then forgotten.
 */
export class DwellWatcher {
  private io: IntersectionObserver | null = null;
  private watched = new Map<Element, Watched>();
  private measuredH = 0;

  constructor(
    private IO: IOCtor | undefined = globalThis.IntersectionObserver,
    private paused = () => false,
    private insets: () => Insets = () => ({ top: 0, bottom: 0 }),
    private viewportH: () => number = () => globalThis.innerHeight ?? 0,
  ) {
    globalThis.addEventListener?.('resize', () => this.remeasure(), { passive: true });
  }

  static inZone(e: Entry): boolean {
    if (!e.isIntersecting || !e.rootBounds) return false;
    const zone = e.rootBounds;
    // A card taller than the zone counts while it fills it.
    if (e.intersectionRect.height >= zone.height - 2) return true;
    const mid = e.boundingClientRect.top + e.boundingClientRect.height / 2;
    return mid >= zone.top && mid <= zone.bottom;
  }

  /** Created on first use, when the bars are laid out and their heights can be measured. */
  private observer(): IntersectionObserver | null {
    if (!this.io && this.IO) {
      this.measuredH = this.viewportH();
      this.io = new this.IO((entries) => entries.forEach((e) => this.update(e)), {
        threshold: THRESHOLDS,
        rootMargin: zoneMargin(this.measuredH, this.insets()),
      });
    }
    return this.io;
  }

  /** Builds a fresh observer for the new screen height; it reports every card once, which re-checks them. */
  private remeasure(): void {
    if (!this.io || Math.abs(this.viewportH() - this.measuredH) <= RESIZE_SLACK) return;
    this.io.disconnect();
    this.io = null;
    const io = this.observer();
    for (const el of this.watched.keys()) io?.observe(el);
  }

  watch(el: Element, ms: number, onRead: () => void): void {
    this.unwatch(el);
    this.watched.set(el, { ms, onRead, timer: null, visible: false });
    this.observer()?.observe(el);
  }

  /** New dwell time, e.g. after expanding; restarts a running timer. */
  retime(el: Element, ms: number): void {
    const w = this.watched.get(el);
    if (!w) return;
    w.ms = ms;
    if (w.timer) {
      clearTimeout(w.timer);
      w.timer = null;
      this.arm(el, w);
    }
  }

  unwatch(el: Element): void {
    const w = this.watched.get(el);
    if (!w) return;
    if (w.timer) clearTimeout(w.timer);
    this.watched.delete(el);
    this.io?.unobserve(el);
  }

  disconnect(): void {
    for (const w of this.watched.values()) if (w.timer) clearTimeout(w.timer);
    this.watched.clear();
    this.io?.disconnect();
  }

  /** Stops all timers, e.g. while a sheet covers the feed or the app is in the background. */
  pauseAll(): void {
    for (const w of this.watched.values()) {
      if (w.timer) clearTimeout(w.timer);
      w.timer = null;
    }
  }

  /** Restarts timers for cards that are still in view. */
  resumeAll(): void {
    for (const [el, w] of this.watched) if (w.visible && !w.timer) this.arm(el, w);
  }

  private update(e: IntersectionObserverEntry): void {
    const w = this.watched.get(e.target);
    if (!w) return;
    w.visible = DwellWatcher.inZone(e);
    if (w.visible && !w.timer) this.arm(e.target, w);
    if (!w.visible && w.timer) {
      clearTimeout(w.timer);
      w.timer = null;
    }
  }

  private arm(el: Element, w: Watched): void {
    if (this.paused()) return;
    w.timer = setTimeout(() => {
      this.unwatch(el);
      w.onRead();
    }, w.ms);
  }
}
