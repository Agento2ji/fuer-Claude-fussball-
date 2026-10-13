/**
 * Token-Bucket je Anbieter und Prozess. Wartet, bis wieder ein Abruf
 * erlaubt ist, statt das Limit des Anbieters zu reißen.
 */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillIntervalMs: number,
    private readonly now: () => number = Date.now,
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((r) => setTimeout(r, ms)),
  ) {
    this.tokens = capacity;
    this.lastRefill = now();
  }

  private refill() {
    const elapsed = this.now() - this.lastRefill;
    const perToken = this.refillIntervalMs / this.capacity;
    const gained = Math.floor(elapsed / perToken);
    if (gained > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + gained);
      this.lastRefill += gained * perToken;
    }
  }

  async take(): Promise<void> {
    for (;;) {
      this.refill();
      if (this.tokens > 0) {
        this.tokens -= 1;
        return;
      }
      const perToken = this.refillIntervalMs / this.capacity;
      await this.sleep(perToken - (this.now() - this.lastRefill));
    }
  }
}

const buckets = new Map<string, TokenBucket>();

export function getBucket(
  provider: string,
  limit: { requests: number; perMs: number },
): TokenBucket {
  let bucket = buckets.get(provider);
  if (!bucket) {
    bucket = new TokenBucket(limit.requests, limit.perMs);
    buckets.set(provider, bucket);
  }
  return bucket;
}
