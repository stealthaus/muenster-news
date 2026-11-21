export type SwipeResult = 'left' | 'right' | null;

/** Horizontal movement before a gesture counts as a swipe instead of a scroll or tap. */
export const LOCK_PX = 12;
/** Share of the card width a swipe has to travel to commit. */
export const COMMIT_RATIO = 0.33;
/** Fast flicks commit earlier (px per ms). */
export const FLICK_SPEED = 0.6;
export const FLICK_MIN_PX = 40;

type Mode = 'idle' | 'pending' | 'swipe' | 'scroll';

/** Pure gesture logic, so it can be tested without a browser. */
export class SwipeTracker {
  private mode: Mode = 'idle';
  private x0 = 0;
  private y0 = 0;
  private t0 = 0;
  dx = 0;

  constructor(
    private width: () => number,
    private allow: { left: boolean; right: boolean } = { left: true, right: true },
  ) {}

  get swiping(): boolean {
    return this.mode === 'swipe';
  }

  start(x: number, y: number, t: number): void {
    this.mode = 'pending';
    this.x0 = x;
    this.y0 = y;
    this.t0 = t;
    this.dx = 0;
  }

  /** Returns the offset to show, or null while the gesture is not a swipe. */
  move(x: number, y: number): number | null {
    if (this.mode === 'idle' || this.mode === 'scroll') return null;
    const dx = x - this.x0;
    const dy = y - this.y0;
    if (this.mode === 'pending') {
      if (Math.abs(dy) > LOCK_PX && Math.abs(dy) > Math.abs(dx)) {
        this.mode = 'scroll';
        return null;
      }
      if (Math.abs(dx) < LOCK_PX) return null;
      this.mode = 'swipe';
    }
    // Directions that are not allowed only give a little rubber band.
    const allowed = dx < 0 ? this.allow.left : this.allow.right;
    this.dx = allowed ? dx : dx * 0.15;
    return this.dx;
  }

  end(x: number, t: number): SwipeResult {
    const wasSwipe = this.mode === 'swipe';
    this.mode = 'idle';
    if (!wasSwipe) return null;
    const dx = x - this.x0;
    const speed = Math.abs(dx) / Math.max(1, t - this.t0);
    const far = Math.abs(dx) >= this.width() * COMMIT_RATIO;
    const flick = speed >= FLICK_SPEED && Math.abs(dx) >= FLICK_MIN_PX;
    if (!far && !flick) return null;
    const dir: SwipeResult = dx < 0 ? 'left' : 'right';
    return (dir === 'left' ? this.allow.left : this.allow.right) ? dir : null;
  }

  cancel(): void {
    this.mode = 'idle';
    this.dx = 0;
  }
}

/** True right after a swipe gesture, so click handlers can ignore the synthetic click. */
export function wasJustDragged(card: HTMLElement, now = Date.now()): boolean {
  const at = Number(card.dataset.draggedAt ?? 0);
  return now - at < 400;
}

export interface SwipeOptions {
  allowLeft: boolean;
  allowRight: boolean;
  onSwipe: (dir: 'left' | 'right') => void;
}

/**
 * Lets a card be swiped sideways. `surface` moves with the finger; `card` gets data-swipe="left|right" while dragging
 * so the underlay can show what will happen. Vertical scrolling stays with the browser (touch-action: pan-y).
 */
export function attachSwipe(card: HTMLElement, surface: HTMLElement, opts: SwipeOptions): () => void {
  const tracker = new SwipeTracker(() => card.clientWidth || 320, { left: opts.allowLeft, right: opts.allowRight });
  let pointer: number | null = null;

  const reset = () => {
    surface.style.transform = '';
    surface.style.transition = '';
    delete card.dataset.swipe;
    card.classList.remove('is-swiping');
  };

  const down = (e: PointerEvent) => {
    if (e.button !== undefined && e.button !== 0) return;
    pointer = e.pointerId ?? 1;
    tracker.start(e.clientX, e.clientY, e.timeStamp || Date.now());
  };
  const move = (e: PointerEvent) => {
    if (pointer === null || (e.pointerId ?? 1) !== pointer) return;
    const dx = tracker.move(e.clientX, e.clientY);
    if (dx === null) return;
    card.classList.add('is-swiping');
    card.dataset.swipe = dx < 0 ? 'left' : 'right';
    surface.style.transition = 'none';
    surface.style.transform = `translateX(${dx}px)`;
    try {
      surface.setPointerCapture?.(pointer);
    } catch {
      // Pointer capture is optional.
    }
  };
  const up = (e: PointerEvent) => {
    if (pointer === null || (e.pointerId ?? 1) !== pointer) return;
    pointer = null;
    const wasSwipe = tracker.swiping;
    const result = tracker.end(e.clientX, e.timeStamp || Date.now());
    // The click that may follow a drag must not toggle the card.
    if (wasSwipe) card.dataset.draggedAt = String(Date.now());
    if (result) {
      surface.style.transition = '';
      surface.style.transform = `translateX(${result === 'left' ? '-110%' : '110%'})`;
      opts.onSwipe(result);
    } else {
      reset();
    }
  };
  const cancel = () => {
    pointer = null;
    tracker.cancel();
    reset();
  };

  surface.addEventListener('pointerdown', down as EventListener);
  surface.addEventListener('pointermove', move as EventListener);
  surface.addEventListener('pointerup', up as EventListener);
  surface.addEventListener('pointercancel', cancel);
  return () => {
    surface.removeEventListener('pointerdown', down as EventListener);
    surface.removeEventListener('pointermove', move as EventListener);
    surface.removeEventListener('pointerup', up as EventListener);
    surface.removeEventListener('pointercancel', cancel);
  };
}
