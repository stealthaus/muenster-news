/** Share of a card, or of the viewport for tall cards, that has to be visible for the timer to run. */
export const VISIBLE_RATIO = 0.6;

type IOCtor = new (cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) => IntersectionObserver;

interface Watched {
  ms: number;
  onRead: () => void;
  timer: ReturnType<typeof setTimeout> | null;
  visible: boolean;
}

/**
 * Fires `onRead` once a card has stayed in view for its dwell time. Scrolling away resets the timer, so only real
 * pauses count. Each card fires at most once and is then forgotten.
 */
export class DwellWatcher {
  private io: IntersectionObserver | null;
  private watched = new Map<Element, Watched>();

  constructor(IO: IOCtor | undefined = globalThis.IntersectionObserver, private paused = () => false) {
    this.io = IO
      ? new IO((entries) => entries.forEach((e) => this.update(e)), { threshold: [0, 0.25, 0.5, VISIBLE_RATIO, 0.8, 1] })
      : null;
  }

  static isVisibleEnough(e: Pick<IntersectionObserverEntry, 'intersectionRatio' | 'intersectionRect' | 'rootBounds' | 'isIntersecting'>): boolean {
    if (!e.isIntersecting) return false;
    if (e.intersectionRatio >= VISIBLE_RATIO) return true;
    // A card taller than the screen can never be 60 % visible; then it counts when it fills most of the screen.
    const rootH = e.rootBounds?.height ?? 0;
    return rootH > 0 && e.intersectionRect.height / rootH >= VISIBLE_RATIO;
  }

  watch(el: Element, ms: number, onRead: () => void): void {
    this.unwatch(el);
    this.watched.set(el, { ms, onRead, timer: null, visible: false });
    this.io?.observe(el);
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
