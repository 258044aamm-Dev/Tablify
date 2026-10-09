// Long-press state machine for touch input (P5-03). Pure logic with injected timers, so it is
// tested with fake timers in Node. Touch only: mouse and pen keep right-click.
//
// Rules (proposed values from the spec):
// - Long press fires after 500 ms of hold (thresholdMs).
// - Movement farther than 10 px from the press start cancels (moveTolerancePx).
// - A scroll or pointercancel cancels, so a scroll that starts on a cell never opens the menu.
// - A short tap (released before the threshold) never opens the menu.

export interface PressTimers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export const LONG_PRESS_MS = 500;
export const LONG_PRESS_MOVE_PX = 10;

export interface LongPressOptions {
  thresholdMs?: number;
  moveTolerancePx?: number;
  timers?: PressTimers;
  onLongPress: (point: { x: number; y: number }) => void;
}

export type PressPhase = 'idle' | 'pending' | 'fired';

export class LongPressDetector {
  private phase: PressPhase = 'idle';
  private startX = 0;
  private startY = 0;
  private handle: unknown = null;
  private readonly thresholdMs: number;
  private readonly moveTolerancePx: number;
  private readonly timers: PressTimers;

  constructor(private readonly opts: LongPressOptions) {
    this.thresholdMs = opts.thresholdMs ?? LONG_PRESS_MS;
    this.moveTolerancePx = opts.moveTolerancePx ?? LONG_PRESS_MOVE_PX;
    this.timers = opts.timers ?? { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h as number) };
  }

  get state(): PressPhase {
    return this.phase;
  }

  /** True while a touch press is being evaluated (before it fires or is cancelled). */
  isPending(): boolean {
    return this.phase === 'pending';
  }

  /** Start tracking a press. Only touch pointers are tracked. Returns true if tracking started. */
  pointerDown(x: number, y: number, pointerType: string): boolean {
    this.clearTimer();
    if (pointerType !== 'touch') {
      this.phase = 'idle';
      return false;
    }
    this.phase = 'pending';
    this.startX = x;
    this.startY = y;
    this.handle = this.timers.setTimeout(() => this.fire(), this.thresholdMs);
    return true;
  }

  pointerMove(x: number, y: number): void {
    if (this.phase !== 'pending') return;
    const dist = Math.hypot(x - this.startX, y - this.startY);
    if (dist > this.moveTolerancePx) this.cancel();
  }

  /**
   * Pointer released. Returns true when a long press fired during this press.
   * The caller can use this to suppress the click that follows.
   */
  pointerUp(): boolean {
    const fired = this.phase === 'fired';
    this.cancel();
    return fired;
  }

  /** Browser cancelled the pointer (for example, it started a native scroll). */
  pointerCancel(): void {
    this.cancel();
  }

  /** Grid scrolled while pressing: cancel. */
  scroll(): void {
    this.cancel();
  }

  private fire(): void {
    this.handle = null;
    if (this.phase !== 'pending') return;
    this.phase = 'fired';
    this.opts.onLongPress({ x: this.startX, y: this.startY });
  }

  private cancel(): void {
    this.clearTimer();
    this.phase = 'idle';
  }

  private clearTimer(): void {
    if (this.handle !== null) {
      this.timers.clearTimeout(this.handle);
      this.handle = null;
    }
  }
}
