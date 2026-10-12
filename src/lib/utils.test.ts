import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatTimestamp, timeAgo } from "./utils";

const NOW = new Date("2026-06-15T12:00:00Z").getTime();

describe("timeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("says 'just now' for the last minute", () => {
    expect(timeAgo(NOW - 30_000)).toBe("just now");
    expect(timeAgo(NOW - 59_000)).toBe("just now");
  });

  it("counts minutes, hours and days", () => {
    expect(timeAgo(NOW - 5 * 60_000)).toBe("5m ago");
    expect(timeAgo(NOW - 3 * 3_600_000)).toBe("3h ago");
    expect(timeAgo(NOW - 2 * 86_400_000)).toBe("2d ago");
  });

  it("falls back to a full timestamp beyond a month", () => {
    const old = NOW - 45 * 86_400_000;
    expect(timeAgo(old)).toBe(formatTimestamp(old));
    expect(timeAgo(old)).not.toMatch(/ago/);
  });
});

describe("formatTimestamp", () => {
  // tests run with TZ=UTC (set in vitest.config.mts) so this is deterministic
  it("formats as a readable en-US date and time", () => {
    expect(formatTimestamp(Date.UTC(2026, 5, 15, 9, 5))).toBe(
      "Jun 15, 2026, 09:05 AM"
    );
  });
});
