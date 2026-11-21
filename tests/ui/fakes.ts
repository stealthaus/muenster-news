/** Minimal IntersectionObserver that tests drive by hand. */
export class FakeIO {
  static instances: FakeIO[] = [];
  observed = new Set<Element>();

  constructor(private cb: IntersectionObserverCallback) {
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

  /** Reports `el` with the given visible share to every observer that watches it. */
  static set(el: Element, ratio: number, opts: { height?: number; rootHeight?: number } = {}) {
    const height = opts.height ?? 200;
    for (const io of FakeIO.instances) {
      if (!io.observed.has(el)) continue;
      const entry = {
        target: el,
        isIntersecting: ratio > 0,
        intersectionRatio: ratio,
        intersectionRect: { height: height * ratio },
        rootBounds: { height: opts.rootHeight ?? 800 },
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
