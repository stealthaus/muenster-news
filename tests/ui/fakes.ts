/** Minimal IntersectionObserver that tests drive by hand. */
export class FakeIO {
  static instances: FakeIO[] = [];
  observed = new Set<Element>();

  constructor(
    private cb: IntersectionObserverCallback,
    public opts?: IntersectionObserverInit,
  ) {
    FakeIO.instances.push(this);
  }

  observe(el: Element) {
    this.observed.add(el);
  }
  unobserve(el: Element) {
    this.observed.delete(el);
  }
  disconnect() {
    this.observed.clear();
  }
  takeRecords() {
    return [];
  }

  /**
   * Reports `el` with the given share of it inside the observer's zone, sliding in from the zone's bottom edge.
   * Zone: 400px high starting at y=200, unless `rootHeight` says otherwise.
   */
  static set(el: Element, ratio: number, opts: { height?: number; rootHeight?: number } = {}) {
    const height = opts.height ?? 200;
    const rootH = opts.rootHeight ?? 400;
    const rootTop = 200;
    const inside = Math.min(height * ratio, rootH);
    const top = rootTop + rootH - inside;
    for (const io of FakeIO.instances) {
      if (!io.observed.has(el)) continue;
      const entry = {
        target: el,
        isIntersecting: ratio > 0,
        intersectionRatio: ratio,
        intersectionRect: { height: inside },
        boundingClientRect: { top, height },
        rootBounds: { top: rootTop, bottom: rootTop + rootH, height: rootH },
      } as unknown as IntersectionObserverEntry;
      io.cb([entry], io as unknown as IntersectionObserver);
    }
  }

  static reset() {
    FakeIO.instances = [];
  }
}

export function pointer(el: Element, type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel', x: number, y = 0) {
  el.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, button: 0 }));
}

/** Drags horizontally in steps, like a finger. */
export function drag(el: Element, dx: number, dy = 0) {
  pointer(el, 'pointerdown', 200, 300);
  const steps = 6;
  for (let i = 1; i <= steps; i++) pointer(el, 'pointermove', 200 + (dx * i) / steps, 300 + (dy * i) / steps);
  pointer(el, 'pointerup', 200 + dx, 300 + dy);
}
