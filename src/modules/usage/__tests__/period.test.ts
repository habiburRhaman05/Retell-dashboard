import { describe, it, expect } from "vitest";
import { monthlyPeriodStart, periodKey } from "../period";

describe("monthlyPeriodStart", () => {
  it("returns first of the month in UTC", () => {
    const result = monthlyPeriodStart(new Date("2026-10-15T14:30:00Z"));
    expect(result.toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("handles first day of month", () => {
    const result = monthlyPeriodStart(new Date("2026-01-01T00:00:00Z"));
    expect(result.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("handles last day of month", () => {
    const result = monthlyPeriodStart(new Date("2026-12-31T23:59:59Z"));
    expect(result.toISOString()).toBe("2026-12-01T00:00:00.000Z");
  });

  it("defaults to current date", () => {
    const result = monthlyPeriodStart();
    const now = new Date();
    expect(result.getUTCDate()).toBe(1);
    expect(result.getUTCMonth()).toBe(now.getUTCMonth());
  });
});

describe("periodKey", () => {
  it("returns YYYY-MM format", () => {
    expect(periodKey(new Date("2026-10-15T00:00:00Z"))).toBe("2026-10");
  });

  it("pads month with zero", () => {
    expect(periodKey(new Date("2026-03-01T00:00:00Z"))).toBe("2026-03");
  });
});
