// P7-02 — keyed request queue with spacing and penalties.
//
// Requests for the same key (an Airtable base ID, or the account-level key for /meta
// calls) run one at a time, at least `minIntervalMs` apart. A 429 or a 5xx response
// calls `penalize`, which pushes the next start time back. Clock and sleep are injected
// so tests can run on a fake clock.

export type Clock = () => number;
export type Sleep = (ms: number) => Promise<void>;

export const defaultClock: Clock = () => Date.now();
export const defaultSleep: Sleep = (ms) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export class KeyedRateLimiter {
  private readonly nextAt = new Map<string, number>();
  private readonly tails = new Map<string, Promise<void>>();

  constructor(
    private readonly minIntervalMs: number,
    private readonly now: Clock = defaultClock,
    private readonly sleep: Sleep = defaultSleep,
  ) {
    if (!Number.isFinite(minIntervalMs) || minIntervalMs < 0) {
      throw new RangeError('minIntervalMs must be a non-negative number');
    }
  }

  /** Run `task` after earlier tasks for the same key and after the key's spacing. */
  schedule<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const run = previous.then(async () => {
      const now = this.now();
      const at = Math.max(now, this.nextAt.get(key) ?? now);
      this.nextAt.set(key, at + this.minIntervalMs);
      if (at > now) await this.sleep(at - now);
      return task();
    });
    // The queue continues even when a task fails.
    this.tails.set(
      key,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  }

  /** Hold every later request for `key` for at least `ms` milliseconds. */
  penalize(key: string, ms: number): void {
    if (!Number.isFinite(ms) || ms <= 0) return;
    const until = this.now() + ms;
    if ((this.nextAt.get(key) ?? 0) < until) this.nextAt.set(key, until);
  }
}
