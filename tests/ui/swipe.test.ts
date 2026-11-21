import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachSwipe, SwipeTracker, wasJustDragged } from '../../src/ui/swipe';
import { drag, pointer } from './fakes';

describe('SwipeTracker', () => {
  const tracker = () => new SwipeTracker(() => 300);

  it('commits a swipe past a third of the width', () => {
    const t = tracker();
    t.start(200, 100, 0);
    expect(t.move(150, 102)).toBe(-50);
    expect(t.end(90, 1000)).toBe('left');
    t.start(10, 100, 0);
    t.move(60, 100);
    expect(t.end(120, 1000)).toBe('right');
  });

  it('snaps back on short slow drags', () => {
    const t = tracker();
    t.start(200, 100, 0);
    t.move(160, 100);
    expect(t.end(150, 1000)).toBeNull();
  });

  it('commits fast flicks even when short', () => {
    const t = tracker();
    t.start(200, 100, 0);
    t.move(170, 100);
    expect(t.end(150, 50)).toBe('left');
  });

  it('ignores small jitter and taps', () => {
    const t = tracker();
    t.start(200, 100, 0);
    expect(t.move(205, 103)).toBeNull();
    expect(t.end(205, 100)).toBeNull();
  });

  it('leaves vertical gestures to scrolling', () => {
    const t = tracker();
    t.start(200, 100, 0);
    expect(t.move(195, 140)).toBeNull();
    expect(t.move(60, 150)).toBeNull();
    expect(t.end(40, 200)).toBeNull();
  });

  it('only rubber-bands in blocked directions', () => {
    const t = new SwipeTracker(() => 300, { left: false, right: true });
    t.start(200, 100, 0);
    expect(t.move(100, 100)).toBeCloseTo(-15);
    expect(t.end(0, 1000)).toBeNull();
  });
});

describe('attachSwipe', () => {
  afterEach(() => vi.useRealTimers());

  function setup(allowLeft = true) {
    const card = document.createElement('article');
    const surface = document.createElement('div');
    card.append(surface);
    document.body.append(card);
    const onSwipe = vi.fn();
    attachSwipe(card, surface, { allowLeft, allowRight: true, onSwipe });
    return { card, surface, onSwipe };
  }

  it('reports left and right swipes and slides the card out', () => {
    const { surface, onSwipe } = setup();
    drag(surface, -150);
    expect(onSwipe).toHaveBeenLastCalledWith('left');
    expect(surface.style.transform).toBe('translateX(-110%)');
    drag(surface, 150);
    expect(onSwipe).toHaveBeenLastCalledWith('right');
  });

  it('shows the direction while dragging and resets after a short drag', () => {
    const { card, surface, onSwipe } = setup();
    pointer(surface, 'pointerdown', 200, 300);
    pointer(surface, 'pointermove', 150, 300);
    expect(card.dataset.swipe).toBe('left');
    expect(card.classList.contains('is-swiping')).toBe(true);
    pointer(surface, 'pointermove', 230, 300);
    expect(card.dataset.swipe).toBe('right');
    pointer(surface, 'pointerup', 230, 300);
    expect(onSwipe).not.toHaveBeenCalled();
    expect(card.dataset.swipe).toBeUndefined();
    expect(surface.style.transform).toBe('');
  });

  it('marks the card as just dragged so the following click is ignored', () => {
    const { card, surface } = setup();
    drag(surface, 60);
    expect(wasJustDragged(card)).toBe(true);
    expect(wasJustDragged(card, Date.now() + 1000)).toBe(false);
  });

  it('resets on pointercancel', () => {
    const { card, surface, onSwipe } = setup();
    pointer(surface, 'pointerdown', 200, 300);
    pointer(surface, 'pointermove', 100, 300);
    pointer(surface, 'pointercancel', 100, 300);
    pointer(surface, 'pointerup', 0, 300);
    expect(onSwipe).not.toHaveBeenCalled();
    expect(card.dataset.swipe).toBeUndefined();
  });

  it('does not swipe left when that is not allowed', () => {
    const { surface, onSwipe } = setup(false);
    drag(surface, -200);
    expect(onSwipe).not.toHaveBeenCalled();
  });
});
