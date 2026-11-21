/** A card counts as on screen when this share of it is visible, which leaves room for sub-pixel rounding. */
export const FULL_RATIO = 0.99;
/** Fine steps, so a card taller than the screen is noticed the moment it fills it. */
const THRESHOLDS = Array.from({ length: 101 }, (_, i) => i / 100);

/** Screen edges covered by fixed bars (sticky day bar, tab bar), in pixels. */
export interface Insets {
  top: number;
  bottom: number;
}

type IOCtor = new (cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) => IntersectionObserver;

interface Watched {
  ms: number;
  onRead: () => void;
  timer: ReturnType<typeof setTimeout> | null;
  visible: boolean;
}

/**
 * Fires `onRead` once a card has stayed completely on screen (between the fixed bars) for its dwell time. Scrolling
 * part of it away resets the timer, so only real pauses count. Each card fires at most once and is then forgotten.
 */
export class DwellWatcher {
  private io: IntersectionObserver | null = null;
  private watched = new Map<Element, Watched>();

  constructor(
    private IO: IOCtor | undefined = globalThis.IntersectionObserver,
    private paused = () => false,
    private insets: () => Insets = () => ({ top: 0, bottom: 0 }),
  ) {}

  static isVisibleEnough(e: Pick<IntersectionObserverEntry, 'intersectionRatio' | 'intersectionRect' | 'rootBounds' | 'isIntersecting'>): boolean {
    if (!e.isIntersecting) return false;
    if (e.intersectionRatio >= FULL_RATIO) return true;
    // A card taller than the screen can never be fully visible; then it counts while it fills the whole screen.
    const rootH = e.rootBounds?.height ?? 0;
    return rootH > 0 && e.intersectionRect.height >= rootH - 2;
  }

  /** Created on first use, when the bars are laid out and their heights can be measured. */
  private observer(): IntersectionObserver | null {
    if (!this.io && this.IO) {
      const { top, bottom } = this.insets();
      this.io = new this.IO((entries) => entries.forEach((e) => this.update(e)), {
        threshold: THRESHOLDS,
        rootMargin: `${-Math.round(top)}px 0px ${-Math.round(bottom)}px 0px`,
      });
    }
    return this.io;
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
    w.visible = DwellWatcher.isVisibleEnough(e);
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
