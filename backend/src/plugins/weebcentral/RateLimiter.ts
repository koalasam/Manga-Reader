const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Absolute ceiling: never more than this many requests in any 1-second window. */
export const MAX_REQUESTS_PER_SECOND = 19;

/**
 * Sliding-window limiter. At most `maxPerSecond` acquisitions are granted in
 * any rolling 1000 ms window, no matter how many callers are waiting.
 */
export class RateLimiter {
    private stamps: number[] = [];
    private chain: Promise<void> = Promise.resolve();
    private max: number;

    constructor(maxPerSecond: number = MAX_REQUESTS_PER_SECOND, private windowMs = 1000) {
        this.max = RateLimiter.clamp(maxPerSecond);
    }

    private static clamp(n: number): number {
        if (!Number.isFinite(n)) return MAX_REQUESTS_PER_SECOND;
        return Math.max(1, Math.min(MAX_REQUESTS_PER_SECOND, Math.floor(n)));
    }

    setLimit(maxPerSecond: number): void {
        this.max = RateLimiter.clamp(maxPerSecond);
    }

    getLimit(): number {
        return this.max;
    }

    /** Resolves when the caller is allowed to make one request. */
    acquire(): Promise<void> {
        const slot = this.chain.then(() => this.waitForSlot());
        this.chain = slot.catch(() => undefined);
        return slot;
    }

    private async waitForSlot(): Promise<void> {
        for (;;) {
            const now = Date.now();
            while (this.stamps.length && now - this.stamps[0] >= this.windowMs) this.stamps.shift();
            if (this.stamps.length < this.max) {
                this.stamps.push(now);
                return;
            }
            await sleep(this.stamps[0] + this.windowMs - now + 5);
        }
    }
}

/** Shared limiter: every request to the site goes through this one instance. */
export const siteLimiter = new RateLimiter(
    Number(process.env.RATE_LIMIT_PER_SEC) || MAX_REQUESTS_PER_SECOND
);