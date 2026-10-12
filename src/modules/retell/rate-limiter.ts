const DEFAULT_CAPACITY = 10;
const DEFAULT_REFILL_RATE = 5;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export interface RateLimiterOptions {
  capacity?: number;
  refillRate?: number;
  maxRetries?: number;
}

export class TokenBucket {
  private tokens: number;
  private capacity: number;
  private refillRate: number;
  private lastRefill: number;

  constructor(opts: RateLimiterOptions = {}) {
    this.capacity = opts.capacity ?? DEFAULT_CAPACITY;
    this.refillRate = opts.refillRate ?? DEFAULT_REFILL_RATE;
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    const waitMs = ((1 - this.tokens) / this.refillRate) * 1000;
    await new Promise((r) => setTimeout(r, waitMs));
    this.tokens = 0;
    this.lastRefill = Date.now();
  }
}

const bucket = new TokenBucket();

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = MAX_RETRIES
): Promise<T> {
  await bucket.acquire();
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const status = (err as { status?: number }).status;
      if (!status || !isRetryable(status) || attempt === maxRetries) throw err;
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
      await bucket.acquire();
    }
  }
  throw lastError;
}
