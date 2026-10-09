import { describe, it, expect, vi } from 'vitest';
import { LongPressDetector, LONG_PRESS_MS, LONG_PRESS_MOVE_PX, type PressTimers } from '../../src/views/longPress.js';

/** Manual timers: deterministic, no real waiting. */
function fakeTimers() {
  let now = 0;
  let nextId = 1;
  const pending = new Map<number, { at: number; fn: () => void }>();
  const timers: PressTimers = {
    setTimeout: (fn, ms) => {
      const id = nextId++;
      pending.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (h) => {
      pending.delete(h as number);
    },
  };
  return {
    timers,
    advance(ms: number) {
      const target = now + ms;
      // run timers in time order up to target
      for (;;) {
        let nextId2: number | null = null;
        let nextAt = Infinity;
        for (const [id, t] of pending) {
          if (t.at <= target && t.at < nextAt) {
            nextAt = t.at;
            nextId2 = id;
          }
        }
        if (nextId2 === null) break;
        now = nextAt;
        const t = pending.get(nextId2)!;
        pending.delete(nextId2);
        t.fn();
      }
      now = target;
    },
    pendingCount: () => pending.size,
  };
}

describe('LongPressDetector (P5-03, touch only)', () => {
  it('uses the proposed values: 500 ms threshold and 10 px tolerance', () => {
    expect(LONG_PRESS_MS).toBe(500);
    expect(LONG_PRESS_MOVE_PX).toBe(10);
  });

  it('fires once at the threshold, not before', () => {
    const t = fakeTimers();
    const onLongPress = vi.fn();
    const d = new LongPressDetector({ onLongPress, timers: t.timers });
    d.pointerDown(50, 50, 'touch');
    t.advance(499);
    expect(onLongPress).not.toHaveBeenCalled();
    t.advance(1);
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onLongPress).toHaveBeenCalledWith({ x: 50, y: 50 });
    expect(d.state).toBe('fired');
  });

  it('a short tap (released before the threshold) never fires', () => {
    const t = fakeTimers();
    const onLongPress = vi.fn();
    const d = new LongPressDetector({ onLongPress, timers: t.timers });
    d.pointerDown(0, 0, 'touch');
    t.advance(200);
    expect(d.pointerUp()).toBe(false);
    t.advance(1000);
    expect(onLongPress).not.toHaveBeenCalled();
    expect(t.pendingCount()).toBe(0);
  });

  it('movement within 10 px keeps the press; beyond 10 px cancels it', () => {
    const t = fakeTimers();
    const onLongPress = vi.fn();
    const d = new LongPressDetector({ onLongPress, timers: t.timers });
    d.pointerDown(100, 100, 'touch');
    d.pointerMove(106, 108); // distance 10 exactly
    t.advance(600);
    expect(onLongPress).toHaveBeenCalledTimes(1);

    const onLongPress2 = vi.fn();
    const d2 = new LongPressDetector({ onLongPress: onLongPress2, timers: t.timers });
    d2.pointerDown(100, 100, 'touch');
    d2.pointerMove(111, 100); // 11 px
    t.advance(600);
    expect(onLongPress2).not.toHaveBeenCalled();
    expect(d2.state).toBe('idle');
  });

  it('movement is measured from the press start, not from the last move', () => {
    const t = fakeTimers();
    const onLongPress = vi.fn();
    const d = new LongPressDetector({ onLongPress, timers: t.timers });
    d.pointerDown(0, 0, 'touch');
    d.pointerMove(8, 0);
    d.pointerMove(16, 0); // 16 px from start: cancels even though each step was small
    t.advance(600);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('a scroll or pointercancel while pressing cancels: no menu', () => {
    const t = fakeTimers();
    const onLongPress = vi.fn();
    const d = new LongPressDetector({ onLongPress, timers: t.timers });
    d.pointerDown(0, 0, 'touch');
    d.scroll();
    t.advance(600);
    expect(onLongPress).not.toHaveBeenCalled();

    d.pointerDown(0, 0, 'touch');
    d.pointerCancel();
    t.advance(600);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('mouse and pen never start a long press (right-click handles them)', () => {
    const t = fakeTimers();
    const onLongPress = vi.fn();
    const d = new LongPressDetector({ onLongPress, timers: t.timers });
    expect(d.pointerDown(0, 0, 'mouse')).toBe(false);
    expect(d.pointerDown(0, 0, 'pen')).toBe(false);
    t.advance(1000);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('pointerUp after a fired press reports it, so the caller can suppress the click', () => {
    const t = fakeTimers();
    const d = new LongPressDetector({ onLongPress: () => undefined, timers: t.timers });
    d.pointerDown(0, 0, 'touch');
    t.advance(500);
    expect(d.pointerUp()).toBe(true);
    expect(d.state).toBe('idle');
  });

  it('a second press works after the first one', () => {
    const t = fakeTimers();
    const onLongPress = vi.fn();
    const d = new LongPressDetector({ onLongPress, timers: t.timers });
    d.pointerDown(0, 0, 'touch');
    t.advance(500);
    d.pointerUp();
    d.pointerDown(0, 0, 'touch');
    t.advance(500);
    expect(onLongPress).toHaveBeenCalledTimes(2);
  });

  it('a new touch down clears any pending timer from the previous press', () => {
    const t = fakeTimers();
    const onLongPress = vi.fn();
    const d = new LongPressDetector({ onLongPress, timers: t.timers });
    d.pointerDown(0, 0, 'touch');
    t.advance(300);
    d.pointerDown(0, 0, 'touch');
    t.advance(300); // 300 ms into the second press: not yet
    expect(onLongPress).not.toHaveBeenCalled();
    t.advance(200);
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });
});
