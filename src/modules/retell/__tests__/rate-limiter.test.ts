import { describe, it, expect } from "vitest";
import { TokenBucket, withRetry } from "../rate-limiter";

describe("TokenBucket", () => {
  it("allows requests up to capacity", async () => {
    const bucket = new TokenBucket({ capacity: 3, refillRate: 1 });
    await bucket.acquire();
    await bucket.acquire();
    await bucket.acquire();
  });

  it("refills tokens over time", async () => {
    const bucket = new TokenBucket({ capacity: 1, refillRate: 100 });
    await bucket.acquire();
    await new Promise((r) => setTimeout(r, 50));
    await bucket.acquire();
  });
});

describe("withRetry", () => {
  it("returns result on success", async () => {
    const result = await withRetry(() => Promise.resolve("ok"), 0);
    expect(result).toBe("ok");
  });

  it("throws non-retryable errors immediately", async () => {
    let attempts = 0;
    const err = Object.assign(new Error("bad request"), { status: 400 });
    await expect(
      withRetry(() => {
        attempts++;
        return Promise.reject(err);
      }, 3)
    ).rejects.toThrow("bad request");
    expect(attempts).toBe(1);
  });

  it("retries on 429 status", async () => {
    let attempts = 0;
    const result = await withRetry(async () => {
      attempts++;
      if (attempts < 3) throw Object.assign(new Error("rate limited"), { status: 429 });
      return "ok";
    }, 3);
    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });

  it("retries on 500 status", async () => {
    let attempts = 0;
    const result = await withRetry(async () => {
      attempts++;
      if (attempts < 2) throw Object.assign(new Error("server error"), { status: 500 });
      return "ok";
    }, 3);
    expect(result).toBe("ok");
    expect(attempts).toBe(2);
  });

  it("gives up after max retries", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        () => {
          attempts++;
          return Promise.reject(Object.assign(new Error("overloaded"), { status: 503 }));
        },
        2
      )
    ).rejects.toThrow("overloaded");
    expect(attempts).toBe(3);
  });
});
