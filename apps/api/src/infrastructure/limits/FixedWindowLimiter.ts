/**
 * Counts attempts per key in a fixed window, in memory.
 *
 * It is deliberately process-local: the deployment runs one instance, and a
 * shared store would add a service the workbench does not otherwise need. The
 * map is pruned as windows expire so a flood of distinct keys cannot grow it forever.
 */

export interface FixedWindowOptions {
  readonly windowMs: number;
  readonly max: number;
  readonly now?: () => number;
}

const PRUNE_AT = 10_000;

export class FixedWindowLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();
  private readonly now: () => number;

  constructor(private readonly options: FixedWindowOptions) {
    this.now = options.now ?? Date.now;
  }

  /** Records an attempt. Returns `false` once the key has used its allowance for this window. */
  allow(key: string): boolean {
    const at = this.now();
    if (this.windows.size > PRUNE_AT) this.prune(at);

    const current = this.windows.get(key);
    if (!current || at - current.start >= this.options.windowMs) {
      this.windows.set(key, { start: at, count: 1 });
      return true;
    }
    current.count += 1;
    return current.count <= this.options.max;
  }

  private prune(at: number): void {
    for (const [key, window] of this.windows)
      if (at - window.start >= this.options.windowMs) this.windows.delete(key);
  }
}
