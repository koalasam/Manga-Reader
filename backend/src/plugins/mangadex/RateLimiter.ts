const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const MAX_REQUESTS_PER_SECOND = 4;

export class MangaDexRateLimiter {
  private stamps: number[] = [];
  private chain: Promise<void> = Promise.resolve();
  private max: number;

  constructor(maxPerSecond: number = MAX_REQUESTS_PER_SECOND, private windowMs = 1000) {
    this.max = Math.max(1, Math.min(10, Math.floor(maxPerSecond)));
  }

  setLimit(maxPerSecond: number): void {
    this.max = Math.max(1, Math.min(10, Math.floor(maxPerSecond)));
  }

  acquire(): Promise<void> {
    const slot = this.chain.then(() => this.waitForSlot());
    this.chain = slot.catch(() => undefined);
    return slot;
  }

  private async waitForSlot(): Promise<void> {
    for (;;) {
      const now = Date.now();
      while (this.stamps.length && now - this.stamps[0] >= this.windowMs) {
        this.stamps.shift();
      }
      if (this.stamps.length < this.max) {
        this.stamps.push(now);
        return;
      }
      await sleep(this.stamps[0] + this.windowMs - now + 5);
    }
  }
}

export const mangaDexLimiter = new MangaDexRateLimiter(4);