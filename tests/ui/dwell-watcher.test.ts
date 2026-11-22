import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DwellWatcher, zoneMargin } from '../../src/ui/dwell-watcher';
import { FakeIO } from './fakes';

describe('DwellWatcher', () => {
  let el: HTMLElement;
  let paused = false;
  let watcher: DwellWatcher;
  const onRead = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    FakeIO.reset();
    onRead.mockReset();
    paused = false;
    el = document.createElement('div');
    watcher = new DwellWatcher(FakeIO as never, () => paused);
    watcher.watch(el, 3000, onRead);
  });
  afterEach(() => vi.useRealTimers());

  it('fires once after the card stayed fully visible long enough', () => {
    FakeIO.set(el, 1);
    vi.advanceTimersByTime(2999);
    expect(onRead).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onRead).toHaveBeenCalledTimes(1);
    FakeIO.set(el, 1);
    vi.advanceTimersByTime(5000);
    expect(onRead).toHaveBeenCalledTimes(1);
  });

  it('resets when the card centre leaves the zone before the time is up', () => {
    FakeIO.set(el, 1);
    vi.advanceTimersByTime(2000);
    FakeIO.set(el, 0.4);
    vi.advanceTimersByTime(5000);
    expect(onRead).not.toHaveBeenCalled();
    FakeIO.set(el, 0.6);
    vi.advanceTimersByTime(3000);
    expect(onRead).toHaveBeenCalledTimes(1);
  });

  it('starts as soon as the card centre is inside the zone', () => {
    FakeIO.set(el, 0.3);
    vi.advanceTimersByTime(10000);
    expect(onRead).not.toHaveBeenCalled();
    FakeIO.set(el, 0.5);
    vi.advanceTimersByTime(3000);
    expect(onRead).toHaveBeenCalled();
  });

  it('counts cards taller than the zone while they fill it', () => {
    FakeIO.set(el, 0.15, { height: 2000 });
    vi.advanceTimersByTime(10000);
    expect(onRead).not.toHaveBeenCalled();
    FakeIO.set(el, 0.2, { height: 2000 });
    vi.advanceTimersByTime(3000);
    expect(onRead).toHaveBeenCalled();
  });

  it('uses the middle half of the area between the fixed bars as zone', () => {
    FakeIO.reset();
    const w = new DwellWatcher(FakeIO as never, () => false, () => ({ top: 57.6, bottom: 92 }), () => 844);
    w.watch(el, 1000, onRead);
    // 844 - 57.6 - 92 = 694.4 free; a quarter of it (173.6) is cut off at each end.
    expect(FakeIO.instances[0].opts?.rootMargin).toBe('-231px 0px -266px 0px');
    expect(zoneMargin(800, { top: 0, bottom: 0 })).toBe('-200px 0px -200px 0px');
  });

  it('re-measures the zone when the screen height changes', () => {
    FakeIO.reset();
    let h = 800;
    const w = new DwellWatcher(FakeIO as never, () => false, () => ({ top: 0, bottom: 0 }), () => h);
    w.watch(el, 1000, onRead);
    h = 820;
    window.dispatchEvent(new Event('resize'));
    expect(FakeIO.instances).toHaveLength(1);
    h = 400;
    window.dispatchEvent(new Event('resize'));
    expect(FakeIO.instances).toHaveLength(2);
    expect(FakeIO.instances[1].opts?.rootMargin).toBe('-100px 0px -100px 0px');
    expect(FakeIO.instances[1].observed.has(el)).toBe(true);
  });

  it('restarts with a new time after expanding', () => {
    FakeIO.set(el, 1);
    vi.advanceTimersByTime(2500);
    watcher.retime(el, 6000);
    vi.advanceTimersByTime(5999);
    expect(onRead).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onRead).toHaveBeenCalled();
  });

  it('pauses and resumes', () => {
    FakeIO.set(el, 1);
    watcher.pauseAll();
    vi.advanceTimersByTime(5000);
    expect(onRead).not.toHaveBeenCalled();
    watcher.resumeAll();
    vi.advanceTimersByTime(3000);
    expect(onRead).toHaveBeenCalled();
  });

  it('does not arm while the pause condition holds', () => {
    paused = true;
    FakeIO.set(el, 1);
    vi.advanceTimersByTime(5000);
    expect(onRead).not.toHaveBeenCalled();
  });

  it('stops watching on unwatch and disconnect', () => {
    FakeIO.set(el, 1);
    watcher.unwatch(el);
    vi.advanceTimersByTime(5000);
    expect(onRead).not.toHaveBeenCalled();
    watcher.watch(el, 1000, onRead);
    FakeIO.set(el, 1);
    watcher.disconnect();
    vi.advanceTimersByTime(5000);
    expect(onRead).not.toHaveBeenCalled();
  });

  it('works without IntersectionObserver support', () => {
    const w = new DwellWatcher(undefined);
    expect(() => w.watch(el, 1000, onRead)).not.toThrow();
  });
});
