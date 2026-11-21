import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DwellWatcher } from '../../src/ui/dwell-watcher';
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

  it('fires once after the card stayed visible long enough', () => {
    FakeIO.set(el, 0.9);
    vi.advanceTimersByTime(2999);
    expect(onRead).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onRead).toHaveBeenCalledTimes(1);
    FakeIO.set(el, 1);
    vi.advanceTimersByTime(5000);
    expect(onRead).toHaveBeenCalledTimes(1);
  });

  it('resets when the card scrolls away before the time is up', () => {
    FakeIO.set(el, 0.9);
    vi.advanceTimersByTime(2000);
    FakeIO.set(el, 0.2);
    vi.advanceTimersByTime(5000);
    expect(onRead).not.toHaveBeenCalled();
    FakeIO.set(el, 0.7);
    vi.advanceTimersByTime(3000);
    expect(onRead).toHaveBeenCalledTimes(1);
  });

  it('does not start while barely visible', () => {
    FakeIO.set(el, 0.5);
    vi.advanceTimersByTime(10000);
    expect(onRead).not.toHaveBeenCalled();
  });

  it('counts tall cards that fill most of the screen', () => {
    FakeIO.set(el, 0.4, { height: 2000, rootHeight: 800 });
    vi.advanceTimersByTime(3000);
    expect(onRead).toHaveBeenCalled();
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
